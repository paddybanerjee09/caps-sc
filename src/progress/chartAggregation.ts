import { formatDisplayDate, formatDisplayMonth } from "../utils/displayDate";

export type Timeframe = "week" | "month" | "year" | "lifetime";
export type Resolution = "day" | "month" | "year";
export type Observation = { date: string; value: number; source: string; measuredAt?: string; version?: string; detail?: string; sampleCount?: number; eligibleDayCount?: number; lowerBound?: boolean };
export type ChartBucket = { key: string; start: string; end: string; label: string; eligibleDayCount: number };
export type ChartPeriod = { start: string; end: string; resolution: Resolution; buckets: ChartBucket[]; title: string };
export type ChartPoint = { key: string; value: number | null; sampleCount: number; eligibleDayCount: number; coveragePercent: number; aggregationMethod: string; observations: Observation[]; lowerBound?: boolean };

/** Calendar arithmetic uses local noon rather than fixed milliseconds across DST. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromDateKey(key: string): Date { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12); }
export function shiftDay(key: string, days: number): string { const date = fromDateKey(key); date.setDate(date.getDate() + days); return dateKey(date); }
export function daysBetween(start: string, end: string): number {
  const a = fromDateKey(start), b = fromDateKey(end);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}
export function shiftPeriod(anchor: string, timeframe: Timeframe, direction: number): string {
  const date = fromDateKey(anchor);
  if (timeframe === "week") date.setDate(date.getDate() + direction * 7);
  if (timeframe === "month") { date.setDate(1); date.setMonth(date.getMonth() + direction); }
  if (timeframe === "year") { date.setMonth(0, 1); date.setFullYear(date.getFullYear() + direction); }
  return dateKey(date);
}
export function buildPeriod(timeframe: Timeframe, anchor: string, firstRecord: string | null, today: string): ChartPeriod {
  const date = fromDateKey(anchor);
  let start: string, end: string, resolution: Resolution = "day";
  if (timeframe === "week") { date.setDate(date.getDate() - (date.getDay() + 6) % 7); start = dateKey(date); end = shiftDay(start, 6); }
  else if (timeframe === "month") { start = dateKey(new Date(date.getFullYear(), date.getMonth(), 1, 12)); end = dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)); }
  else if (timeframe === "year") { start = `${date.getFullYear()}-01-01`; end = `${date.getFullYear()}-12-31`; resolution = "month"; }
  else { start = firstRecord && firstRecord < today ? firstRecord : today; end = today; const span = daysBetween(start, end); resolution = span <= 120 ? "day" : span <= 8 * 366 ? "month" : "year"; }
  const buckets: ChartBucket[] = [];
  for (let cursor = start; cursor <= end;) {
    const current = fromDateKey(cursor);
    const bucketEnd = resolution === "day" ? cursor : resolution === "month" ? dateKey(new Date(current.getFullYear(), current.getMonth() + 1, 0, 12)) : `${current.getFullYear()}-12-31`;
    const clippedEnd = bucketEnd < end ? bucketEnd : end;
    const eligibleEnd = clippedEnd < today ? clippedEnd : today;
    buckets.push({ key: resolution === "day" ? cursor : resolution === "month" ? cursor.slice(0, 7) : cursor.slice(0, 4), start: cursor, end: clippedEnd,
      label: resolution === "year" ? String(current.getFullYear()) : resolution === "month" ? current.toLocaleDateString([], { month: "short" }) : timeframe === "week" ? current.toLocaleDateString([], { weekday: "short" }) : timeframe === "lifetime" ? current.toLocaleDateString([], { month: "short", day: "numeric" }) : String(current.getDate()),
      eligibleDayCount: Math.max(0, daysBetween(cursor, eligibleEnd) + 1) });
    cursor = shiftDay(clippedEnd, 1);
  }
  const title = timeframe === "year" ? start.slice(0, 4) : timeframe === "month" ? formatDisplayMonth(start) : `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  return { start, end, resolution, buckets, title };
}
/** Latest valid reading per date. Call independently for each comparable source/model. */
export function latestDaily(observations: Observation[]): Observation[] {
  const dates = new Map<string, Observation>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.value)) continue;
    const previous = dates.get(observation.date);
    if (!previous || (observation.measuredAt ?? "") >= (previous.measuredAt ?? "")) dates.set(observation.date, observation);
  }
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function aggregateSeries(observations: Observation[], period: ChartPeriod): ChartPoint[] {
  const daily = latestDaily(observations);
  return period.buckets.map((bucket) => {
    const values = daily.filter((o) => o.date >= bucket.start && o.date <= bucket.end);
    const compatible = new Set(values.map((o) => o.version ?? "")).size <= 1 && new Set(values.map((o) => o.source)).size <= 1;
    const sampleCount = values.length;
    return { key: bucket.key, value: sampleCount && compatible ? values.reduce((sum, o) => sum + o.value, 0) / sampleCount : null,
      sampleCount, eligibleDayCount: bucket.eligibleDayCount, coveragePercent: bucket.eligibleDayCount ? 100 * sampleCount / bucket.eligibleDayCount : 0,
      lowerBound: values.some(o => o.lowerBound), aggregationMethod: !compatible ? "incompatible sources or formula versions" : period.resolution === "day" ? "latest valid daily value" : `mean of valid daily values (${period.resolution})`, observations: values };
  });
}
export function rollingWeightAverage(weights: Observation[], through: string, minimumDays = 4): Observation[] {
  const daily = latestDaily(weights.filter((w) => w.value > 0));
  if (!daily.length) return [];
  const byDate = new Map(daily.map((w) => [w.date, w]));
  const result: Observation[] = [];
  for (let date = daily[0].date; date <= through; date = shiftDay(date, 1)) {
    const values: Observation[] = [];
    for (let offset = -6; offset <= 0; offset++) { const value = byDate.get(shiftDay(date, offset)); if (value) values.push(value); }
    if (values.length < minimumDays) continue;
    result.push({ date, value: values.reduce((sum, v) => sum + v.value, 0) / values.length, source: "CAPS weigh-ins", version: "trailing_calendar_7d_v1", sampleCount: values.length, eligibleDayCount: 7,
      detail: `${values.length}/7 observed days${values.length < 7 ? " · partial coverage" : ""}; trailing seven calendar days` });
  }
  return result;
}
/** Null breaks the path; recorded zero remains a real point. */
export function contiguousRuns(points: ChartPoint[]): number[][] {
  const runs: number[][] = [];
  for (let i = 0; i < points.length; i++) { if (points[i].value === null) continue; if (i === 0 || points[i - 1].value === null) runs.push([]); runs[runs.length - 1].push(i); }
  return runs;
}
/** Chart bounds are display policy; recorded observations are never clamped. */
export function chartAxis(values: readonly number[], range?: readonly [number, number], zeroBased = false, minimumMax = 1) {
  const finite = values.filter(Number.isFinite);
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : minimumMax;
  const padding = Math.max((max - min) * 0.12, Math.abs(max) * 0.02, 0.5);
  const low = range?.[0] ?? (zeroBased ? 0 : min - padding);
  const high = range?.[1] ?? (zeroBased ? Math.max(minimumMax, max) : max + padding);
  const step = low === 0 && high === 10 ? 2 : low === 0 && high === 100 ? 10 : zeroBased && minimumMax === 16 ? 2 : niceStep((high - low) / 5);
  const axisLow = range ? low : zeroBased ? 0 : Math.floor(low / step) * step;
  const axisHigh = range ? high : Math.max(axisLow + step, Math.ceil(high / step) * step);
  const ticks = Array.from({ length: Math.round((axisHigh - axisLow) / step) + 1 }, (_, i) => Number((axisLow + i * step).toFixed(6)));
  return { low: axisLow, high: axisHigh, ticks };
}
function niceStep(value: number) {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

/** Fit labels to their real spacing; thin ticks only after reaching a readable font floor. */
export function chartXTicks(labels: readonly string[], width: number, preferred: number, fontScale = 1) {
  if (!labels.length) return { indices: [], fontSize: 10 };
  let count = Math.min(labels.length, preferred);
  let indices: number[] = [];
  let fontSize = 10;
  while (count > 0) {
    indices = [...new Set(Array.from({ length: count }, (_, i) => Math.round(i / (count - 1 || 1) * (labels.length - 1))))];
    const longest = Math.max(1, ...indices.map(i => labels[i].length));
    const spacing = count <= 1 ? width : width / (count - 1);
    fontSize = Math.min(11, Math.floor((spacing - 3) / (longest * 0.58 * Math.max(1, fontScale) * (count === 2 ? 2 : 1.5))));
    if (fontSize >= 8 || count === 1) break;
    count--;
  }
  return { indices, fontSize: Math.max(8, fontSize) };
}
/** Use one Y-label gutter for all synchronized panels so dates share the same X position. */
export function chartLeftInset(axes: readonly { ticks: readonly number[] }[], fontScale = 1) {
  const labelLength = Math.max(1, ...axes.flatMap(axis => axis.ticks.map(value => String(Number(value.toFixed(1))).length)));
  return Math.max(44, Math.ceil(labelLength * 10 * fontScale * 0.65) + 12);
}
