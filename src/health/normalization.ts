import type { HealthMeasurement, HealthPlatform } from "../recovery/types";
import type { SleepCache, SleepStage } from "./types";

export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function localDateAt(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const field = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function validTimezone(value: unknown): string {
  if (typeof value === "string") {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return value; } catch { /* Preserve unknown source timezone in metadata, use captured import timezone. */ }
  }
  return deviceTimezone();
}

export function unionMinutes(intervals: readonly { start: string; end: string }[]): number {
  const sorted = intervals.map((item) => [Date.parse(item.start), Date.parse(item.end)] as const)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let start = 0;
  let end = 0;
  sorted.forEach(([nextStart, nextEnd], index) => {
    if (index === 0) { start = nextStart; end = nextEnd; }
    else if (nextStart <= end) end = Math.max(end, nextEnd);
    else { total += end - start; start = nextStart; end = nextEnd; }
  });
  return (total + (sorted.length ? end - start : 0)) / 60_000;
}

function intersectionMinutes(left: SleepStage[], right: SleepStage[]): number {
  return unionMinutes(left.flatMap((a) => right.flatMap((b) => {
    const start = Math.max(Date.parse(a.start), Date.parse(b.start));
    const end = Math.min(Date.parse(a.end), Date.parse(b.end));
    return end > start ? [{ start: new Date(start).toISOString(), end: new Date(end).toISOString() }] : [];
  })));
}

/** Group source-consistent contiguous stages, then retain the longest observed session per wake day/source. */
export function normalizeSleep(platform: HealthPlatform, cache: SleepCache, now: string): { measurements: HealthMeasurement[]; emittedIds: string[] } {
  const groups: SleepStage[][] = [];
  const nativeSessions = new Map<string, SleepStage[]>();
  const sorted = [...cache.stages].filter((stage) => Number.isFinite(Date.parse(stage.start)) && Date.parse(stage.end) > Date.parse(stage.start))
    .sort((a, b) => a.source.localeCompare(b.source) || Date.parse(a.start) - Date.parse(b.start));
  for (const stage of sorted) {
    if (stage.sessionId) {
      const key = `${stage.source}:${stage.sessionId}`;
      const session = nativeSessions.get(key) ?? [];
      session.push(stage);
      nativeSessions.set(key, session);
      continue;
    }
    const last = groups.at(-1);
    const groupEnd = last ? Math.max(...last.map((item) => Date.parse(item.end))) : 0;
    // Health Connect session identity is authoritative; HealthKit has only stages.
    const sameSession = last && stage.source === last[0].source && Date.parse(stage.start) <= groupEnd + 120 * 60_000;
    if (sameSession) last.push(stage); else groups.push([stage]);
  }
  groups.push(...nativeSessions.values());
  const principal = new Map<string, { stages: SleepStage[]; asleep: number; end: string }>();
  for (const stages of groups) {
    const asleep = unionMinutes(stages.filter((stage) => stage.kind === "asleep"));
    const conflictingMinutes = intersectionMinutes(stages.filter((stage) => stage.kind === "asleep"), stages.filter((stage) => stage.kind === "awake"));
    if (asleep <= 0 || asleep > 24 * 60 || conflictingMinutes > 0) continue;
    const end = new Date(Math.max(...stages.map((stage) => Date.parse(stage.end)))).toISOString();
    const key = `${stages[0].source}:${localDateAt(end, stages[0].timezone)}`;
    if ((principal.get(key)?.asleep ?? 0) < asleep) principal.set(key, { stages, asleep, end });
  }
  const measurements: HealthMeasurement[] = [];
  const emittedIds: string[] = [];
  for (const [key, { stages, asleep, end }] of principal) {
    const first = stages[0];
    const externalId = `sleep:${key}`;
    emittedIds.push(externalId);
    const inBed = unionMinutes(stages.filter((stage) => stage.kind === "in_bed"));
    const start = new Date(Math.min(...stages.map((stage) => Date.parse(stage.start)))).toISOString();
    const common = {
      platform, externalId, source: first.source, sourceApp: first.sourceApp, sourceDevice: first.sourceDevice,
      measuredAt: end, measuredUntil: end, recordedAt: now, localDate: localDateAt(end, first.timezone), timezone: first.timezone,
      subtype: "source_segmented_sleep", protocol: null, quality: stages.some((stage) => stage.manuallyEntered) ? "unverified" as const : "valid" as const,
      metadata: { onset: start, wake: end, asleepMinutes: asleep, inBedMinutes: inBed || null,
        sourceSampleIds: [...new Set(stages.map((stage) => stage.id))], stages,
        sessionSelection: "longest observed source-consistent session per local wake day",
        timezoneBasis: "source timezone when supplied; otherwise device timezone captured at import" },
    };
    measurements.push({ ...common, id: `${platform}:${externalId}:sleep_duration`, metric: "sleep_duration", value: asleep, unit: "min" });
    // No inferred in-bed duration from a bare sleep-session interval or missing stages.
    const coveredAsleep = intersectionMinutes(stages.filter((stage) => stage.kind === "asleep"), stages.filter((stage) => stage.kind === "in_bed"));
    if (inBed >= asleep && inBed > 0 && Math.abs(coveredAsleep - asleep) < 0.001) measurements.push({ ...common, id: `${platform}:${externalId}:sleep_efficiency`, metric: "sleep_efficiency", value: 100 * asleep / inBed, unit: "%" });
  }
  return { measurements, emittedIds };
}

export function reconcileStages(existing: SleepStage[], upserts: SleepStage[], deleted: string[]): SleepStage[] {
  const deletedIds = new Set(deleted);
  const updatedIds = new Set(upserts.map((stage) => stage.id));
  return [...existing.filter((stage) => !deletedIds.has(stage.id) && !updatedIds.has(stage.id)), ...upserts];
}
