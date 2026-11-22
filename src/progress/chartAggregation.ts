export type Timeframe = "week" | "month" | "year" | "lifetime";
export type Resolution = "day" | "month" | "year";
export type Observation = { date: string; value: number; source: string; measuredAt?: string; version?: string; detail?: string; sampleCount?: number; eligibleDayCount?: number };
export type ChartBucket = { key: string; start: string; end: string; label: string; eligibleDayCount: number };
export type ChartPeriod = { start: string; end: string; resolution: Resolution; buckets: ChartBucket[]; title: string };
export type ChartPoint = { key: string; value: number | null; sampleCount: number; eligibleDayCount: number; coveragePercent: number; aggregationMethod: string; observations: Observation[] };

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
  const title = timeframe === "year" ? start.slice(0, 4) : timeframe === "month" ? fromDateKey(start).toLocaleDateString([], { month: "long", year: "numeric" }) : `${fromDateKey(start).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} – ${fromDateKey(end).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
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
      aggregationMethod: !compatible ? "incompatible sources or formula versions" : period.resolution === "day" ? "latest valid daily value" : `mean of valid daily values (${period.resolution})`, observations: values };
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
