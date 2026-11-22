import { isLocalDate, isValidTimezone, shiftDate, validateSleepTimes } from "./dates";
import type { HealthMeasurement, PersonalBaseline, Questionnaire, SriVersion } from "./types";

export const SRI_VERSION = "sri_v2" as const;
export const BASELINE_DAYS = 28;
export const BASELINE_MINIMUM = 14;
const requiredRatings = ["sleepQuality", "fatigue", "soreness", "stress", "motivation"] as const;

export function createEmptyQuestionnaire(localDate: string, timezone: string): Questionnaire {
  return { localDate, timezone, sriVersion: SRI_VERSION, sleepOnset: null, wakeTime: null, awakenings: 0, awakeningsAtLeast: false, sleepQuality: 5, fatigue: 5, soreness: 5, stress: 5, motivation: 5, mood: 5, minutesAwake: null, status: "not_started", revision: 0, completedAt: null };
}

function ratingValid(value: number | null) { return value !== null && Number.isInteger(value) && value >= 0 && value <= 10; }

export function validateQuestionnaire(q: Questionnaire, complete: boolean) {
  const errors: string[] = [];
  if (!isLocalDate(q.localDate)) errors.push("Recovery date is invalid.");
  if (!isValidTimezone(q.timezone)) errors.push("Timezone is invalid.");
  if (!Number.isInteger(q.revision) || q.revision < 0) errors.push("Questionnaire revision is invalid.");
  for (const field of requiredRatings) {
    if (q[field] === null && !complete) continue;
    if (!ratingValid(q[field])) errors.push(`${field} must be an integer from 0 to 10.`);
  }
  if (q.sriVersion !== undefined && !["sri_v1", "sri_v2"].includes(q.sriVersion)) errors.push("Unknown SRI version.");
  if (complete && q.sriVersion === "sri_v2" && q.mood === null) errors.push("Mood is required.");
  if (q.awakeningsAtLeast && (q.awakenings === null || q.awakenings < 10)) errors.push("10+ awakenings must have a lower bound of at least 10.");
  if (q.mood !== null && !ratingValid(q.mood)) errors.push("Mood must be an integer from 0 to 10.");
  if ((complete && q.awakenings === null) || (q.awakenings !== null && (!Number.isSafeInteger(q.awakenings) || q.awakenings < 0))) errors.push("Awakenings must be a nonnegative integer.");
  if (q.minutesAwake !== null && (!Number.isSafeInteger(q.minutesAwake) || q.minutesAwake < 0)) errors.push("Minutes awake must be a nonnegative integer.");
  if ([q.sleepOnset, q.wakeTime].some((value) => value !== null && Date.parse(value) > Date.now())) errors.push("Reported sleep times cannot be in the future.");
  errors.push(...validateSleepTimes(q, complete));
  return errors;
}

export function calculateSRI(q: Pick<Questionnaire, "sleepQuality" | "fatigue" | "soreness" | "stress" | "motivation" | "awakenings"> & { mood?: number | null; sriVersion?: SriVersion }) {
  if (!requiredRatings.every((key) => ratingValid(q[key])) || q.awakenings === null || !Number.isInteger(q.awakenings) || q.awakenings < 0) return null;
  if (q.sriVersion === 'sri_v2') {
    if (q.mood === undefined || !ratingValid(q.mood)) return null;
    return Math.round(100 * (0.30*q.sleepQuality!/10 + 0.25*(1-q.fatigue!/10) + 0.20*(1-q.soreness!/10) + 0.10*(1-q.stress!/10) + 0.05*q.motivation!/10 + 0.05*q.mood!/10 + 0.05*(1-Math.min(q.awakenings,10)/10)));
  }
  const total = q.sleepQuality! / 10 + 1 - q.fatigue! / 10 + 1 - q.soreness! / 10 + 1 - q.stress! / 10 + q.motivation! / 10 + 1 - Math.min(q.awakenings, 5) / 5;
  return Math.round(100 * total / 6);
}

export function rmssd(intervals: number[]) {
  if (intervals.length < 2 || intervals.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const result = Math.sqrt(intervals.slice(1).reduce((sum, value, index) => sum + (value - intervals[index]) ** 2, 0) / (intervals.length - 1));
  return Number.isFinite(result) ? result : null;
}
export function lnRMSSD(value: number, subtype: string = "RMSSD") { return subtype === "RMSSD" && Number.isFinite(value) && value > 0 ? Math.log(value) : null; }
export function hrr60(endHr: number, afterHr: number, endProtocol: string, afterProtocol: string) { return endProtocol.trim() && endProtocol === afterProtocol && Number.isFinite(endHr) && Number.isFinite(afterHr) && endHr > 0 && afterHr > 0 ? endHr - afterHr : null; }
export function sleepEfficiency(asleepMinutes: number | null, inBedMinutes: number | null) { return asleepMinutes !== null && inBedMinutes !== null && Number.isFinite(asleepMinutes) && Number.isFinite(inBedMinutes) && asleepMinutes >= 0 && inBedMinutes > 0 && asleepMinutes <= inBedMinutes ? 100 * (asleepMinutes / inBedMinutes) : null; }
export function standardizedDeviation(value: number, mean: number, sd: number) { const result = (value - mean) / sd; return [value, mean, sd, result].every(Number.isFinite) && sd > 0 ? result : null; }
export function manualSleep(q: Pick<Questionnaire, "sleepOnset" | "wakeTime" | "minutesAwake">) {
  if (!q.sleepOnset || !q.wakeTime) return { intervalMinutes: null, asleepMinutes: null };
  const intervalMinutes = (Date.parse(q.wakeTime) - Date.parse(q.sleepOnset)) / 60_000;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0 || intervalMinutes > 1440) return { intervalMinutes: null, asleepMinutes: null };
  const asleepMinutes = q.minutesAwake !== null && Number.isFinite(q.minutesAwake) && q.minutesAwake >= 0 && q.minutesAwake <= intervalMinutes ? intervalMinutes - q.minutesAwake : null;
  return { intervalMinutes, asleepMinutes };
}

export function comparableKey(value: HealthMeasurement) { return JSON.stringify([value.metric, value.platform, value.source, value.subtype, value.protocol, value.unit]); }
export function personalBaseline(today: HealthMeasurement, observations: HealthMeasurement[], minimum = BASELINE_MINIMUM): PersonalBaseline {
  const windowStart = shiftDate(today.localDate, -BASELINE_DAYS);
  const windowEnd = shiftDate(today.localDate, -1);
  // One latest valid reading per comparable day prevents dense sampling from dominating.
  const days = new Map<string, HealthMeasurement>();
  for (const observation of observations) {
    if (observation.localDate < windowStart || observation.localDate >= today.localDate || observation.quality !== "valid" || comparableKey(observation) !== comparableKey(today) || !Number.isFinite(observation.value)) continue;
    const current = days.get(observation.localDate);
    if (!current || Date.parse(observation.measuredAt) > Date.parse(current.measuredAt)) days.set(observation.localDate, observation);
  }
  const values = [...days.values()].map((item) => today.metric === "hrv" && today.subtype === "RMSSD" ? lnRMSSD(item.value) : item.value).filter((value): value is number => value !== null);
  const count = values.length;
  const mean = count ? values.reduce((sum, value) => sum + value, 0) / count : null;
  const sd = count > 1 && mean !== null ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1)) : null;
  const current = today.metric === "hrv" && today.subtype === "RMSSD" ? lnRMSSD(today.value) : today.value;
  return { windowStart, windowEnd, count, mean, sd, zScore: count >= minimum && sd !== null && sd > 0 && current !== null && today.quality === "valid" ? (current - mean!) / sd : null, coefficientOfVariation: mean !== null && mean !== 0 && sd !== null ? 100 * sd / Math.abs(mean) : null };
}

/** Clock-time standard deviation after unwrapping around a habitual anchor. */
export function sleepTimingSd(minutes: number[], anchor: number) {
  if (minutes.length < 2 || !Number.isFinite(anchor) || minutes.some((value) => !Number.isFinite(value) || value < 0 || value >= 1440)) return null;
  const values = minutes.map((value) => anchor + ((value - anchor + 2160) % 1440) - 720);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}
