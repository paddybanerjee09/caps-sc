import { convertKilogramsToWeight } from "../utils/weight";
import { appColorPalette } from "../theme/theme";
import { BASELINE_DAYS, BASELINE_MINIMUM, manualSleep } from "../recovery/calculations";
import type { HealthMeasurement, HealthState, PreferredSources, Questionnaire } from "../recovery/types";
import { fatigueHistory, type CompletedTraining, type TrainingDayConfirmation } from "../domain/training/fatigue";
import { recoveryInputs } from "../recovery/indexData";
import type { SleepTarget } from "../data/trainingIndexRepository";
import { aggregateSeries, dateKey, latestDaily, rollingWeightAverage, shiftDay, type ChartPeriod, type Observation } from "./chartAggregation";
import type { PlotSeries, Subgraph } from "./ProgressCharts";

export type ProgressGroup = "weight" | "recovery" | "cardiac" | "sleep" | "fatigue";
export type ProgressRecords = { questionnaires: Questionnaire[]; measurements: HealthMeasurement[]; sessions?: CompletedTraining[]; confirmations?: TrainingDayConfirmation[]; sleepTargets?: SleepTarget[]; health?: HealthState | null; preferred?: PreferredSources; asOf?: number; weights: { measuredAt: number; kg: number }[] };
export type RawSeries = { id: string; label: string; unit: string; observations: Observation[]; subtype?: string; unavailableHelp?: string };
export type RawSubgraph = Omit<Subgraph, "series"> & { series: RawSeries[] };
const COLORS = [appColorPalette.turquoise, appColorPalette.orange, appColorPalette.purple, appColorPalette.blue, appColorPalette.pink, appColorPalette.yellow, appColorPalette.green];
export const emptyProgressRecords: ProgressRecords = { questionnaires: [], measurements: [], weights: [] };

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
  const inverted = field === "fatigue" || field === "soreness" || field === "stress";
  return { id: `questionnaire:${field}`, label, unit: field === "awakenings" ? "count" : "/10", observations: questionnaires.flatMap((q) => q.status !== "completed" || q[field] === null ? [] : [{ date: q.localDate, value: inverted ? 10 - q[field]! : q[field]!, lowerBound: field === "awakenings" && q.awakeningsAtLeast === true, source: "Manual questionnaire", measuredAt: q.completedAt ?? undefined, version: "questionnaire_v1", detail: `revision ${q.revision} · recovery zone ${q.timezone}` }]) };
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
const recoveryHelp = "A daily score needs a readiness check-in and either sleep with a personal target or a comparable autonomic reading. Open Home → Recovery to add inputs.";
const fatigueHelp = "The index needs 14 complete prior days and 14 earlier valid snapshots. Confirm workouts and rest days in Home → Recovery.";

function recoverySeries(records: ProgressRecords, today: string): RawSeries[] {
  const source = recoveryInputs({ ...records, sleepTargets: records.sleepTargets ?? [], health: records.health ?? null, preferred: records.preferred ?? {} });
  const groups = new Map<string, RawSeries>();
  for (const q of records.questionnaires) {
    if (q.localDate > today || q.status !== "completed" || q.readiness == null) continue;
    const result = source.calculate(q.localDate, records.asOf ?? Date.now());
    if (result.index.value === null || result.comparisonKey === null) continue;
    const id = "recovery-index:" + result.comparisonKey;
    const context = [
      result.sleep.severity.value === null ? null : result.sleep.nights.length + " sleep " + (result.sleep.nights.length === 1 ? "night" : "nights") + " / " + result.sleep.targetHours + " h target",
      result.autonomic.rhr.severity.value === null ? null : "RHR",
      result.autonomic.hrv.severity.value === null ? null : "RMSSD",
    ].filter(Boolean).join(", ");
    const deviceSources = [...new Set([
      ...result.sleep.nights.filter(night => night.wearable && result.sleep.severity.value !== null).map(night => night.source),
      ...[result.autonomic.rhr, result.autonomic.hrv].filter(reading => reading.severity.value !== null && reading.measurement).map(reading => [reading.measurement!.source, reading.measurement!.sourceDevice, reading.measurement!.protocol].filter(Boolean).join(" / ")),
    ])].join(", ");
    const label = ["Recovery Index", result.method, result.index.coverage.valid + "/" + result.index.coverage.total + " domains", context, deviceSources].filter(Boolean).join(" · ");
    const series = groups.get(id) ?? { id, label, unit: "/100", observations: [], unavailableHelp: recoveryHelp };
    series.observations.push({ date: q.localDate, value: result.index.value, source: result.index.method, measuredAt: q.completedAt ?? undefined, version: result.index.modelVersion, detail: label });
    groups.set(id, series);
  }
  return groups.size ? [...groups.values()] : [{ id: "recovery-index", label: "Recovery Index", unit: "/100", observations: [], unavailableHelp: recoveryHelp }];
}

function fatigueSeries(records: ProgressRecords, today: string): RawSeries[] {
  const days = fatigueHistory(today, records.asOf ?? Date.now(), records.sessions ?? [], records.confirmations ?? []);
  return [{ id: "fatigue-index", label: "Fatigue Index · personal percentile", unit: "/100", unavailableHelp: fatigueHelp,
    observations: days.flatMap(day => day.index.value === null ? [] : [{ date: day.date, value: day.index.value, source: "Recent training burden", version: day.index.modelVersion, detail: day.referenceCount + " earlier comparable days" }]) }];
}

export function buildRawGraphs(records: ProgressRecords, group: ProgressGroup, imperial: boolean, today: string): RawSubgraph[] {
  const q = records.questionnaires;
  if (group === "weight") {
    const weights: Observation[] = records.weights.filter((w) => Number.isFinite(w.kg) && w.kg > 0 && dateKey(new Date(w.measuredAt)) <= today).map((w) => ({ date: dateKey(new Date(w.measuredAt)), value: convertKilogramsToWeight(w.kg, imperial ? "imperial" : "metric"), source: "CAPS weigh-ins", measuredAt: new Date(w.measuredAt).toISOString() }));
    const unit = imperial ? "lb" : "kg";
    return [{ id: "weight", title: "Body weight", unit, series: [{ id: "weight:daily", label: "Daily weight", unit, observations: latestDaily(weights) }, { id: "weight:7d", label: "7-day average · min 4 days", unit, observations: rollingWeightAverage(weights, today) }] }];
  }
  if (group === "recovery") return [{ id: "recovery", title: "Recovery Index", unit: "0–100", range: [0, 100], series: recoverySeries(records, today) }];
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
      if (entry.status !== "completed") return [];
      const asleep = entry.sleepHours != null ? 60 * entry.sleepHours : manualSleep(entry).asleepMinutes;
      return asleep === null || !Number.isFinite(asleep) || asleep < 0 ? [] : [{ date: entry.localDate, value: asleep / 60, source: "Manual questionnaire", measuredAt: entry.completedAt ?? undefined, version: "manual_asleep_v1", detail: entry.sleepHours != null ? "Explicit hours reported" : "Sleep interval minus explicitly reported minutes awake" }];
    }) };
    const efficiency = healthSeries(records.measurements, "sleep_efficiency");
    return [{ id: "sleep:duration", title: "Sleep duration", unit: "h", zeroBased: true, minimumMax: 16, series: [...duration, manual] }, { id: "sleep:quality", title: "Sleep quality", unit: "0–10", range: [0, 10], series: [questionnaireSeries(q, "sleepQuality", "Sleep quality · manual")] }, { id: "sleep:efficiency", title: "Sleep efficiency", unit: "%", range: [0, 100], series: efficiency.length ? efficiency : [{ id: "sleep:efficiency:empty", label: "Efficiency · unavailable", unit: "%", observations: [] }] }, { id: "sleep:awakenings", title: "Awakenings per recorded night", unit: "count", zeroBased: true, minimumMax: 2, series: [questionnaireSeries(q, "awakenings", "Awakenings · manual")] }];
  }
  return [{ id: "fatigue:questionnaire", title: "Subjective wellness", unit: "0–10", range: [0, 10], series: [questionnaireSeries(q, "fatigue", "Fatigue recovery (higher is better)"), questionnaireSeries(q, "mood", "Mood (higher is better)"), questionnaireSeries(q, "soreness", "Soreness recovery (higher is better)"), questionnaireSeries(q, "stress", "Stress recovery (higher is better)"), questionnaireSeries(q, "motivation", "Motivation (higher is better)")] }, { id: "fatigue:indices", title: "Fatigue Index", unit: "0–100", range: [0, 100], series: fatigueSeries(records, today) }];
}
export function aggregateGraphs(graphs: RawSubgraph[], period: ChartPeriod): Subgraph[] {
  return graphs.map((graph) => ({ ...graph, series: graph.series.map((series, index): PlotSeries => ({ id: series.id, label: series.label, unit: series.unit, unavailableHelp: series.unavailableHelp, color: COLORS[index % COLORS.length], points: aggregateSeries(series.observations, period) })) }));
}
export function firstProgressDate(records: ProgressRecords): string | null {
  const dates = [...records.questionnaires.map((q) => q.localDate), ...(records.confirmations ?? []).map((s) => s.localDate), ...(records.sessions ?? []).map((s) => s.localDate), ...records.measurements.map((m) => m.localDate), ...records.weights.map((w) => dateKey(new Date(w.measuredAt)))].sort();
  return dates[0] ?? null;
}





