import { convertKilogramsToWeight } from "../utils/weight";
import { appColorPalette } from "../theme/theme";
import { BASELINE_DAYS, BASELINE_MINIMUM, manualSleep } from "../recovery/calculations";
import type { HealthMeasurement, Questionnaire, RecoverySnapshot } from "../recovery/types";
import { aggregateSeries, dateKey, latestDaily, rollingWeightAverage, shiftDay, type ChartPeriod, type Observation } from "./chartAggregation";
import type { PlotSeries, Subgraph } from "./ProgressCharts";

export type ProgressGroup = "weight" | "recovery" | "cardiac" | "sleep" | "fatigue";
export type ProgressRecords = { questionnaires: Questionnaire[]; measurements: HealthMeasurement[]; snapshots: RecoverySnapshot[]; weights: { measuredAt: number; kg: number }[] };
export type RawSeries = { id: string; label: string; unit: string; observations: Observation[]; subtype?: string };
export type RawSubgraph = Omit<Subgraph, "series"> & { series: RawSeries[] };
const COLORS = [appColorPalette.turquoise, appColorPalette.orange, appColorPalette.purple, appColorPalette.blue, appColorPalette.pink, appColorPalette.yellow, appColorPalette.green];
export const emptyProgressRecords: ProgressRecords = { questionnaires: [], measurements: [], snapshots: [], weights: [] };

/** Individual source/type/protocol/model identities are retained as separate series. */
export function measurementIdentity(m: HealthMeasurement): string {
  return JSON.stringify([m.metric, m.platform, m.source, m.subtype ?? "", m.protocol ?? "", m.unit, m.sourceDevice ?? "", m.sourceApp ?? ""]);
}
function healthSeries(records: HealthMeasurement[], metric: HealthMeasurement["metric"]): RawSeries[] {
  const groups = new Map<string, RawSeries>();
  for (const m of records) {
    if (m.metric !== metric || m.quality !== "valid" || !Number.isFinite(m.value)) continue;
    if (m.metric === "hrr60" && !m.protocol) continue;
    if (m.metric === "hrv" && m.subtype !== "RMSSD" && m.subtype !== "SDNN") continue;
    const id = measurementIdentity(m);
    const divisor = m.metric === "sleep_duration" ? 60 : 1;
    if (m.metric === "sleep_duration" && m.unit !== "min") continue;
    if (!groups.has(id)) groups.set(id, { id, subtype: m.subtype ?? undefined, label: [m.subtype, m.platform === "healthkit" ? "Apple Health" : "Health Connect", m.source, m.sourceDevice, m.protocol].filter(Boolean).join(" · "), unit: divisor === 60 ? "h" : m.unit, observations: [] });
    groups.get(id)!.observations.push({ date: m.localDate, value: m.value / divisor, source: `${m.platform} · ${m.source}`, measuredAt: m.measuredAt, detail: `${m.quality} · acquisition zone ${m.timezone}${m.subtype ? ` · ${m.subtype}` : ""}${m.protocol ? ` · protocol ${m.protocol}` : ""}`, version: "normalized_measurement_v1" });
  }
  return [...groups.values()];
}
function questionnaireSeries(questionnaires: Questionnaire[], field: "fatigue" | "soreness" | "stress" | "motivation" | "mood" | "sleepQuality" | "awakenings", label: string): RawSeries {
  return { id: `questionnaire:${field}`, label, unit: field === "awakenings" ? "count" : "/10", observations: questionnaires.flatMap((q) => q.status !== "completed" || q[field] === null ? [] : [{ date: q.localDate, value: q[field]!, source: "Manual questionnaire", measuredAt: q.completedAt ?? undefined, version: "questionnaire_v1", detail: `revision ${q.revision} · recovery zone ${q.timezone}` }]) };
}
function baselineSeries(series: RawSeries): RawSeries {
  const daily = latestDaily(series.observations);
  let windowIndex = 0;
  let sum = 0;
  const observations: Observation[] = [];
  for (let index = 0; index < daily.length; index++) {
    const reading = daily[index];
    const windowStart = shiftDay(reading.date, -BASELINE_DAYS);
    while (windowIndex < index && daily[windowIndex].date < windowStart) sum -= daily[windowIndex++].value;
    const count = index - windowIndex;
    if (count >= BASELINE_MINIMUM) observations.push({ date: reading.date, value: sum / count, source: reading.source, version: "preceding_28d_mean_v1", detail: `${count} preceding comparable days; minimum ${BASELINE_MINIMUM}; current day excluded` });
    sum += reading.value;
  }
  return { ...series, id: `${series.id}:baseline`, label: `${series.label} · ${BASELINE_DAYS}d baseline`, observations };
}
function indexSeries(snapshots: RecoverySnapshot[]): RawSeries[] {
  const versions = [...new Set(snapshots.map((s) => s.sriVersion))];
  const result = versions.map((version) => ({ id: `sri:${version}`, label: `SRI · ${version}`, unit: "/100", observations: snapshots.flatMap((s) => s.sriVersion !== version || s.sri === null ? [] : [{ date: s.localDate, value: s.sri, source: "Morning questionnaire", measuredAt: s.computedAt, version: s.sriVersion, detail: `6/6 required subjective inputs; computed ${new Date(s.computedAt).toLocaleString()}` }]) }));
  if (!result.length) result.push({ id: "sri:sri_v1", label: "SRI · sri_v1", unit: "/100", observations: [] });
  const sets = [...new Set(snapshots.filter(s => s.ori !== null && s.oriDetails).map(s => JSON.stringify([s.oriVersion,s.oriDetails!.inputSet])))];
  const objective = sets.map(key => ({id: 'ori:'+key,label:'Experimental ORI · '+JSON.parse(key)[0]+' · '+[...new Set(snapshots.find(s=>s.oriDetails && JSON.stringify([s.oriVersion,s.oriDetails.inputSet])===key)!.oriDetails!.contributors.map(c=>c.source))].join(', '),unit:'/100',observations:snapshots.flatMap(s => s.ori === null || !s.oriDetails || JSON.stringify([s.oriVersion,s.oriDetails.inputSet]) !== key ? [] : [{date:s.localDate,value:s.ori,source:'CAPS biometrics · '+s.oriDetails.contributors.map(c=>c.metric+': '+c.source).join('; '),measuredAt:s.computedAt,version:s.oriVersion ?? undefined,detail:s.oriDetails.coverage+'% input coverage · '+s.oriDetails.contributors.map(c=>c.metric+': '+c.score+' ('+c.source+')').join('; ')}])}));
  return [...result, ...objective.length ? objective : [{id:'ori:waiting',label:'Experimental ORI · building baseline',unit:'/100',observations:[]}]];
}
export function buildRawGraphs(records: ProgressRecords, group: ProgressGroup, imperial: boolean, today: string): RawSubgraph[] {
  const q = records.questionnaires;
  const indices = indexSeries(records.snapshots);
  if (group === "weight") {
    const weights: Observation[] = records.weights.filter((w) => Number.isFinite(w.kg) && w.kg > 0 && dateKey(new Date(w.measuredAt)) <= today).map((w) => ({ date: dateKey(new Date(w.measuredAt)), value: convertKilogramsToWeight(w.kg, imperial ? "imperial" : "metric"), source: "CAPS weigh-ins", measuredAt: new Date(w.measuredAt).toISOString() }));
    const unit = imperial ? "lb" : "kg";
    return [{ id: "weight", title: "Body weight", unit, series: [{ id: "weight:daily", label: "Daily weight", unit, observations: latestDaily(weights) }, { id: "weight:7d", label: "7-day average · min 4 days", unit, observations: rollingWeightAverage(weights, today) }] }];
  }
  if (group === "recovery") return [{ id: "recovery", title: "Recovery indices", unit: "0–100", range: [0, 100], series: indices }];
  if (group === "cardiac") {
    const hrv = healthSeries(records.measurements, "hrv");
    const rhr = healthSeries(records.measurements, "rhr");
    const hrr = healthSeries(records.measurements, "hrr60");
    const graphs: RawSubgraph[] = [];
    for (const subtype of ["RMSSD", "SDNN"]) {
      const matching = hrv.filter((s) => s.subtype === subtype);
      graphs.push({ id: `hrv:${subtype}`, title: `HRV ${subtype}`, unit: "ms", series: matching.length ? matching.flatMap((s) => [s, baselineSeries(s)]) : [{ id: `hrv:${subtype}:empty`, label: `${subtype} · unavailable`, unit: "ms", observations: [] }] });
    }
    graphs.push({ id: "rhr", title: "Resting heart rate", unit: "bpm", series: rhr.length ? rhr.flatMap((s) => [s, baselineSeries(s)]) : [{ id: "rhr:empty", label: "RHR · unavailable", unit: "bpm", observations: [] }] });
    graphs.push({ id: "hrr60", title: "Standardized HRR60", unit: "bpm drop", series: hrr.length ? hrr : [{ id: "hrr60:empty", label: "HRR60 · no comparable test", unit: "bpm drop", observations: [] }] });
    return graphs;
  }
  if (group === "sleep") {
    const duration = healthSeries(records.measurements, "sleep_duration");
    const manual: RawSeries = { id: "sleep:manual", label: "Estimated asleep · manual", unit: "h", observations: q.flatMap((entry) => {
      if (entry.status !== "completed" || !entry.sleepOnset || !entry.wakeTime || entry.minutesAwake === null) return [];
      const asleep = manualSleep(entry).asleepMinutes;
      return asleep === null || !Number.isFinite(asleep) || asleep < 0 ? [] : [{ date: entry.localDate, value: asleep / 60, source: "Manual questionnaire", measuredAt: entry.completedAt ?? undefined, version: "manual_asleep_v1", detail: "Sleep interval minus explicitly reported minutes awake; estimate" }];
    }) };
    const efficiency = healthSeries(records.measurements, "sleep_efficiency");
    return [{ id: "sleep:duration", title: "Sleep duration", unit: "h", series: [...duration, manual] }, { id: "sleep:quality", title: "Sleep quality", unit: "0–10", range: [0, 10], series: [questionnaireSeries(q, "sleepQuality", "Sleep quality · manual")] }, { id: "sleep:efficiency", title: "Sleep efficiency", unit: "%", range: [0, 100], series: efficiency.length ? efficiency : [{ id: "sleep:efficiency:empty", label: "Efficiency · unavailable", unit: "%", observations: [] }] }, { id: "sleep:awakenings", title: "Awakenings per recorded night", unit: "count", series: [questionnaireSeries(q, "awakenings", "Awakenings · manual")] }];
  }
  return [{ id: "fatigue:questionnaire", title: "Subjective wellness", unit: "0–10", range: [0, 10], series: [questionnaireSeries(q, "fatigue", "Fatigue ↑ worse"), questionnaireSeries(q, "mood", "Mood ↑ better"), questionnaireSeries(q, "soreness", "Soreness ↑ worse"), questionnaireSeries(q, "stress", "Stress ↑ worse"), questionnaireSeries(q, "motivation", "Motivation ↑ better")] }, { id: "fatigue:indices", title: "Recovery indices", unit: "0–100", range: [0, 100], series: indices }];
}
export function aggregateGraphs(graphs: RawSubgraph[], period: ChartPeriod): Subgraph[] {
  return graphs.map((graph) => ({ ...graph, series: graph.series.map((series, index): PlotSeries => ({ id: series.id, label: series.label, unit: series.unit, color: COLORS[index % COLORS.length], points: aggregateSeries(series.observations, period) })) }));
}
export function firstProgressDate(records: ProgressRecords): string | null {
  const dates = [...records.questionnaires.map((q) => q.localDate), ...records.snapshots.map((s) => s.localDate), ...records.measurements.map((m) => m.localDate), ...records.weights.map((w) => dateKey(new Date(w.measuredAt)))].sort();
  return dates[0] ?? null;
}





