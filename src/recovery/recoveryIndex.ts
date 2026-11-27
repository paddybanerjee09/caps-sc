import { trainingMetric, type MetricReason, type MetricResult } from "../domain/training/metric";
import { lnRMSSD, manualSleep } from "./calculations";
import { isInstant, isLocalDate, isValidTimezone, localDateInZone, shiftDate } from "./dates";
import type { HealthMeasurement, PreferredSources, Questionnaire } from "./types";

/** V1 engineering defaults for modeled deficits. Source compatibility is part of the method. */
export const RECOVERY_INDEX_CONFIG = {
  sleepNights: 3,
  sleepDeficitHours: 2,
  baselineDays: 42,
  baselineMinimum: 14,
  madScale: 1.4826,
  zLimit: 3,
  noiseFloor: { rhr: 1, hrv: 0.05 },
} as const;

type DeviceMetric = "rhr" | "hrv" | "sleep_duration";
type AutonomicMetric = Exclude<DeviceMetric, "sleep_duration">;

export type ManualRecoverySleep = {
  id: string;
  localDate: string;
  hours: number;
  endedAt: string;
  correctedAt?: string;
  source?: string;
};

export type RecoveryIndexInput = {
  localDate: string;
  asOf: number;
  checkIn?: { localDate?: string; readiness?: number | null; soreness?: number | null; availableAt?: string } | null;
  sleepTargetHours?: number | null;
  manualSleep?: readonly ManualRecoverySleep[];
  measurements?: readonly HealthMeasurement[];
  preferred?: PreferredSources;
  allowWearables?: boolean;
  blockedWearableMetrics?: readonly DeviceMetric[];
};

type RecoverySleepNight = {
  localDate: string;
  hours: number;
  source: string;
  identity: string;
  wearable: boolean;
};

type AutonomicReading = {
  severity: MetricResult;
  measurement: HealthMeasurement | null;
  identity: string | null;
  baselineCount: number;
  z: number | null;
};

export type RecoveryIndexResult = {
  index: MetricResult;
  checkIn: { severity: MetricResult; readiness: number | null; soreness: number | null };
  sleep: { severity: MetricResult; latest: RecoverySleepNight | null; nights: RecoverySleepNight[]; targetHours: number | null };
  autonomic: { severity: MetricResult; rhr: AutonomicReading; hrv: AutonomicReading };
  method: "Manual" | "Wearable assisted" | null;
  comparisonKey: string | null;
};

/** A saved questionnaire contributes explicitly reported sleep. */
export function questionnaireRecoverySleep(q: Questionnaire): ManualRecoverySleep | null {
  if (q.status !== "completed" || !q.completedAt || !isInstant(q.completedAt) || !isLocalDate(q.localDate)
      || !isValidTimezone(q.timezone) || q.localDate > localDateInZone(q.completedAt, q.timezone)) return null;
  const wakeTime = q.wakeTime && isInstant(q.wakeTime) && localDateInZone(q.wakeTime, q.timezone) === q.localDate
    && Date.parse(q.wakeTime) <= Date.parse(q.completedAt) ? q.wakeTime : null;
  const asleep = wakeTime && q.sleepOnset && isInstant(q.sleepOnset) ? manualSleep(q).asleepMinutes : null;
  const hours = q.sleepHours ?? (asleep === null ? null : asleep / 60);
  if (!bounded(hours, 0, 24)) return null;
  return {
    id: `questionnaire:${q.localDate}`,
    localDate: q.localDate,
    hours,
    endedAt: wakeTime ?? q.completedAt,
    correctedAt: q.completedAt,
    source: "Morning questionnaire",
  };
}

function bounded(value: number | null | undefined, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validAnchor(input: RecoveryIndexInput) {
  return isLocalDate(input.localDate) && Number.isFinite(new Date(input.asOf).getTime());
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}

function deficit(metricId: string, method: string, value: number | null, valid: number, total: number, usedInputs: string[], missingInputs: string[], reasonCodes: MetricReason[] = []) {
  return trainingMetric({ metricId, method, value, unit: "severity", status: value === null ? "unavailable" : valid < total ? "partial" : "available", coverage: { valid, total }, usedInputs, missingInputs, reasonCodes });
}

function checkInDeficit(input: RecoveryIndexInput): RecoveryIndexResult["checkIn"] {
  const { checkIn } = input;
  const method = "Explicit check-in readiness";
  function timingReason(): MetricReason | null {
    if (!validAnchor(input)) return "invalid";
    if (checkIn?.localDate !== undefined && !isLocalDate(checkIn.localDate)) return "invalid";
    if (checkIn?.localDate !== undefined && checkIn.localDate !== input.localDate) return "stale";
    if (checkIn?.availableAt !== undefined && (!isInstant(checkIn.availableAt) || Date.parse(checkIn.availableAt) > input.asOf)) return "invalid";
    return null;
  }
  const timing = timingReason();
  const current = timing === null;
  const readiness = current && bounded(checkIn?.readiness, 0, 10) ? checkIn.readiness : null;
  const reason = timing ?? (readiness !== null ? null : checkIn?.readiness == null ? "missing" : "invalid");
  const soreness = current && bounded(checkIn?.soreness, 0, 10) ? checkIn.soreness : null;
  return { readiness, soreness, severity: deficit("recovery-check-in", method, readiness === null ? null : (10 - readiness) / 10,
    readiness === null ? 0 : 1, 1, readiness === null ? [] : ["Current explicit readiness"], readiness === null ? ["Current explicit readiness (0–10)"] : [], reason ? [reason] : []) };
}

function deviceAllowed(input: RecoveryIndexInput, metric: DeviceMetric) {
  return input.allowWearables !== false && !input.blockedWearableMetrics?.includes(metric);
}

function sourceMatches(input: RecoveryIndexInput, observation: HealthMeasurement) {
  const preferred = input.preferred?.[observation.metric];
  return !preferred || observation.source === preferred;
}

function endInstant(observation: HealthMeasurement) {
  return observation.measuredUntil ?? observation.measuredAt;
}

function hasObservedTimes(observation: HealthMeasurement, asOf: number) {
  const end = endInstant(observation);
  return !!observation.id?.trim() && !!observation.externalId?.trim() && !!observation.source?.trim() && isLocalDate(observation.localDate)
    && isValidTimezone(observation.timezone) && isInstant(observation.measuredAt)
    && isInstant(end) && isInstant(observation.recordedAt) && Date.parse(end) >= Date.parse(observation.measuredAt)
    && Date.parse(end) <= asOf && Date.parse(observation.recordedAt) <= asOf
    && localDateInZone(end, observation.timezone) === observation.localDate;
}

function sourceIdentity(observation: HealthMeasurement) {
  return [observation.platform, observation.source, observation.sourceDevice ?? null, observation.sourceApp ?? null];
}

function observationKey(observation: HealthMeasurement) {
  return JSON.stringify([observation.platform, observation.externalId]);
}

function newestReading(a: HealthMeasurement, b: HealthMeasurement) {
  return Date.parse(endInstant(b)) - Date.parse(endInstant(a)) || Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || a.id.localeCompare(b.id);
}

function validSleep(observation: HealthMeasurement, asOf: number) {
  return observation.quality === "valid" && observation.unit === "min" && bounded(observation.value, 0, 1440) && hasObservedTimes(observation, asOf);
}

function sleepDeficit(input: RecoveryIndexInput): RecoveryIndexResult["sleep"] {
  const method = "Sleep shortfall against personal target";
  const missingLatest = "Sleep for the latest completed night";
  const missingTarget = "Personal sleep target";
  const nights: RecoverySleepNight[] = [];
  const targetHours = bounded(input.sleepTargetHours, Number.MIN_VALUE, 24) ? input.sleepTargetHours : null;
  const total = RECOVERY_INDEX_CONFIG.sleepNights;
  if (!validAnchor(input)) return { nights, latest: null, targetHours, severity: deficit("recovery-sleep", method, null, 0, total, [], [missingLatest], ["invalid"]) };

  const enabled = deviceAllowed(input, "sleep_duration");
  const manual = (input.manualSleep ?? []).filter((night) => isLocalDate(night.localDate) && night.localDate <= input.localDate);
  const device = enabled ? (input.measurements ?? []).filter((observation) => observation.metric === "sleep_duration" && observation.localDate <= input.localDate && sourceMatches(input, observation)) : [];
  const validManual = (night: ManualRecoverySleep) => !!night.id?.trim() && bounded(night.hours, 0, 24) && isInstant(night.endedAt) && Date.parse(night.endedAt) <= input.asOf
    && (!night.correctedAt || (isInstant(night.correctedAt) && Date.parse(night.correctedAt) >= Date.parse(night.endedAt) && Date.parse(night.correctedAt) <= input.asOf));
  for (let daysBack = 0; daysBack < total; daysBack++) {
    const day = shiftDate(input.localDate, -daysBack);
    const selectedManual = manual.filter((night) => night.localDate === day && validManual(night)).sort((a, b) =>
      Date.parse(b.correctedAt ?? b.endedAt) - Date.parse(a.correctedAt ?? a.endedAt) || Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id))[0];
    if (selectedManual) {
      const source = selectedManual.source ?? "Manual sleep log";
      nights.push({ localDate: day, hours: selectedManual.hours, source, identity: JSON.stringify(["manual", source]), wearable: false });
      continue;
    }
    const selectedDevice = device.filter((observation) => observation.localDate === day && validSleep(observation, input.asOf)).sort(newestReading)[0];
    if (selectedDevice) nights.push({ localDate: day, hours: selectedDevice.value / 60, source: selectedDevice.source,
      identity: JSON.stringify(["device", ...sourceIdentity(selectedDevice), selectedDevice.subtype, selectedDevice.protocol]), wearable: true });
  }
  const latest = nights.find((night) => night.localDate === input.localDate) ?? null;
  const reasonCodes: MetricReason[] = [];
  if (!latest) {
    if (manual.some((night) => night.localDate === input.localDate) || device.some((observation) => observation.localDate === input.localDate)) reasonCodes.push("invalid");
    else if (manual.some(validManual) || device.some((observation) => validSleep(observation, input.asOf))) reasonCodes.push("stale");
    else reasonCodes.push("missing");
    if (!enabled) reasonCodes.push("opted-out");
  }
  if (targetHours === null) reasonCodes.push(input.sleepTargetHours == null ? "missing" : "invalid");
  if (latest && nights.length < total) reasonCodes.push("incomplete-coverage");
  const value = latest && targetHours !== null
    ? clamp(mean(nights.map((night) => Math.max(0, targetHours - night.hours))) / RECOVERY_INDEX_CONFIG.sleepDeficitHours, 0, 1) : null;
  const missing = [...(latest ? [] : [missingLatest]), ...(targetHours === null ? [missingTarget] : []),
    ...(latest && nights.length < total ? ["Some earlier nights are unrecorded"] : [])];
  return { severity: deficit("recovery-sleep", method, value, nights.length, total,
    [...nights.map((night) => `${night.localDate}: ${night.source}`), ...(targetHours === null ? [] : [missingTarget])], missing, reasonCodes), latest, targetHours, nights };
}

function autonomicIdentity(observation: HealthMeasurement) {
  // The existing protocol slot identifies a documented measurement method AND window.
  // A native metric type with a source/device name alone cannot establish window compatibility.
  if (!observation.source.trim() || !observation.sourceDevice?.trim() || !observation.protocol?.trim()) return null;
  return JSON.stringify([observation.metric, ...sourceIdentity(observation), observation.subtype, observation.protocol, observation.unit]);
}

function autonomicValue(observation: HealthMeasurement) {
  if (observation.quality !== "valid") return null;
  if (observation.metric === "rhr" && observation.unit === "bpm" && bounded(observation.value, Number.MIN_VALUE, 300)) return observation.value;
  if (observation.metric === "hrv" && observation.unit === "ms" && bounded(observation.value, Number.MIN_VALUE, 10_000)) return lnRMSSD(observation.value, observation.subtype ?? "");
  return null;
}

function autonomicReading(metric: AutonomicMetric, input: RecoveryIndexInput): AutonomicReading {
  const label = metric === "rhr" ? "resting heart rate" : "RMSSD heart-rate variability";
  const metricId = `recovery-${metric}`;
  const method = `Personal ${label} baseline (median/MAD)`;
  const unavailable = (reason: MetricReason, missing: string, measurement: HealthMeasurement | null = null, identity: string | null = null, baselineCount = 0): AutonomicReading => ({
    severity: deficit(metricId, method, null, Math.min(baselineCount, RECOVERY_INDEX_CONFIG.baselineMinimum), RECOVERY_INDEX_CONFIG.baselineMinimum, measurement ? [label] : [], [missing], [reason]),
    measurement, identity, baselineCount, z: null,
  });
  if (!validAnchor(input)) return unavailable("invalid", `A valid date for ${label}`);
  if (!deviceAllowed(input, metric)) return unavailable("opted-out", `Permission to use ${label}`);
  const start = shiftDate(input.localDate, -RECOVERY_INDEX_CONFIG.baselineDays);
  const observations = (input.measurements ?? []).filter((observation) => observation.metric === metric && observation.localDate <= input.localDate && sourceMatches(input, observation));
  const current = observations.filter((observation) => observation.localDate === input.localDate && hasObservedTimes(observation, input.asOf));
  const candidates = current.filter((observation) => autonomicValue(observation) !== null);
  const sample = candidates.sort(newestReading)[0];
  if (!sample) {
    if (current.some((observation) => metric === "hrv" && observation.quality === "valid" && observation.unit === "ms" && observation.subtype !== "RMSSD")) {
      return unavailable("incompatible", "Current RMSSD reading");
    }
    if (observations.some((observation) => observation.localDate === input.localDate)) return unavailable("invalid", `A valid current ${label} reading`);
    if (observations.some((observation) => autonomicValue(observation) !== null && hasObservedTimes(observation, input.asOf))) return unavailable("stale", `Current ${label} reading`);
    return unavailable("missing", `Current ${label} reading`);
  }
  const identity = autonomicIdentity(sample);
  if (!identity) return unavailable("incompatible", `Identified device, measurement method and window for ${label}`, sample);

  const earlier = observations.filter((observation) => observation.localDate >= start && observation.localDate < input.localDate
    && Date.parse(endInstant(observation)) < Date.parse(sample.measuredAt) && autonomicIdentity(observation) === identity
    && autonomicValue(observation) !== null && hasObservedTimes(observation, input.asOf))
    .sort(newestReading);
  const seenDays = new Set<string>();
  const seenRecords = new Set([observationKey(sample)]);
  const values: number[] = [];
  for (const observation of earlier) {
    const key = observationKey(observation);
    if (seenDays.has(observation.localDate) || seenRecords.has(key)) continue;
    const value = autonomicValue(observation);
    if (value === null) continue;
    seenDays.add(observation.localDate);
    seenRecords.add(key);
    values.push(value);
  }
  const count = values.length;
  const currentValue = autonomicValue(sample);
  if (count < RECOVERY_INDEX_CONFIG.baselineMinimum || currentValue === null) return unavailable("insufficient-history", `${RECOVERY_INDEX_CONFIG.baselineMinimum} comparable prior days of ${label}`, sample, identity, count);

  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  const scale = Math.max(RECOVERY_INDEX_CONFIG.madScale * mad, RECOVERY_INDEX_CONFIG.noiseFloor[metric]);
  const { zLimit } = RECOVERY_INDEX_CONFIG;
  const z = clamp((currentValue - center) / scale, -zLimit, zLimit);
  const value = Math.max(0, metric === "rhr" ? z : -z) / zLimit;
  return { measurement: sample, identity, baselineCount: count, z,
    severity: deficit(metricId, method, value, RECOVERY_INDEX_CONFIG.baselineMinimum, RECOVERY_INDEX_CONFIG.baselineMinimum,
      [`Current ${label}`, `${count} comparable prior days`], []) };
}

export function calculateRecoveryIndex(input: RecoveryIndexInput): RecoveryIndexResult {
  const checkIn = checkInDeficit(input);
  const sleep = sleepDeficit(input);
  const rhr = autonomicReading("rhr", input);
  const hrv = autonomicReading("hrv", input);
  const readings = [rhr, hrv];
  const autonomicValues = readings.flatMap(({ severity }) => severity.value === null ? [] : [severity.value]);
  const autonomic = { rhr, hrv, severity: deficit("recovery-autonomic", "Comparable autonomic readings",
    autonomicValues.length ? mean(autonomicValues) : null, autonomicValues.length, readings.length,
    readings.flatMap(({ severity }) => severity.value === null ? [] : severity.usedInputs), readings.flatMap(({ severity }) => severity.missingInputs),
    [...new Set(readings.flatMap(({ severity }) => severity.reasonCodes))]) };
  const domains = [checkIn.severity, sleep.severity, autonomic.severity];
  const valid = domains.flatMap((domain) => domain.value === null ? [] : [domain.value]);
  const eligible = checkIn.severity.value !== null && valid.length >= 2;
  const sleepIdentities = sleep.severity.value === null ? [] : sleep.nights.map((night) => night.identity).sort();
  const autonomicIdentities = readings.flatMap(({ severity, identity }) => severity.value === null || identity === null ? [] : [identity]);
  const usesDevice = autonomicIdentities.length > 0 || (sleep.severity.value !== null && sleep.nights.some((night) => night.wearable));
  const method = eligible ? usesDevice ? "Wearable assisted" : "Manual" : null;
  const comparisonKey = eligible ? JSON.stringify([method, sleepIdentities, sleep.severity.value === null ? null : [sleep.nights.length, sleep.targetHours], autonomicIdentities]) : null;
  const index = trainingMetric({ metricId: "recovery-index", value: eligible ? 100 * (1 - mean(valid)) : null, unit: "/100",
    method: method ?? "Modeled recovery deficits", status: !eligible ? "unavailable" : valid.length < domains.length ? "partial" : "available",
    coverage: { valid: valid.length, total: domains.length },
    usedInputs: domains.filter((domain) => domain.value !== null).map((domain) => domain.method),
    missingInputs: eligible ? domains.filter((domain) => domain.value === null).flatMap((domain) => domain.missingInputs)
      : [...checkIn.severity.missingInputs, ...(valid.length === (checkIn.severity.value === null ? 0 : 1) ? ["A sleep deficit or comparable autonomic reading"] : [])],
    reasonCodes: [...new Set(domains.flatMap((domain) => domain.reasonCodes))],
  });
  return { index, checkIn, sleep, autonomic, method, comparisonKey };
}
