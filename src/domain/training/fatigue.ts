import { isLocalDate, shiftDate } from "../../recovery/dates";
import { personalPercentile, trainingMetric, type MetricResult } from "./metric";

export const FATIGUE_V1 = { windowDays: 14, acuteHalfLife: 2, accumulatedHalfLife: 7, referenceMaximum: 60, referenceMinimum: 14, hardSessionRpe: 8 } as const;

export type CompletedTraining = {
  id: string;
  localDate: string;
  endAt: number;
  title: string;
  modality: "conditioning" | "strength" | "skill";
  sourceId?: string;
  sourceOwnerId?: string | null;
  minutes: number | null;
  sessionRpe: number | null;
};
export type TrainingDayConfirmation = { localDate: string; kind: "rest" | "complete" };
export type FatigueDay = {
  date: string;
  index: MetricResult;
  acute: MetricResult;
  accumulated: MetricResult;
  completeDays: number;
  observedSessions: number;
  lastHardDay: string | null;
  daysSinceLastHard: number | null;
  referenceCount: number;
};

export function sessionLoad(minutes: number | null, rpe: number | null): number | null {
  if (minutes === null || rpe === null || !Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(rpe) || rpe < 0 || rpe > 10) return null;
  const load = minutes * rpe;
  return Number.isFinite(load) ? load : null;
}

export type ComparableOutput = { observedAt: number; comparisonKey: string; output: number; direction: "higher" | "elapsed-time" };
export function observedOutputLoss(current: ComparableOutput, reference: ComparableOutput): number | null {
  if (!current.comparisonKey.trim() || current.comparisonKey !== reference.comparisonKey || current.direction !== reference.direction ||
      ![current.observedAt, reference.observedAt, current.output, reference.output].every(Number.isFinite) ||
      reference.observedAt >= current.observedAt || reference.output <= 0 || current.output < 0 || (current.direction === "elapsed-time" && current.output === 0)) return null;
  const loss = 100 * (current.direction === "higher" ? reference.output - current.output : current.output - reference.output) / reference.output;
  return Number.isFinite(loss) ? loss : null;
}

export function fatigueHistory(today: string, asOf: number, sessions: readonly CompletedTraining[], confirmations: readonly TrainingDayConfirmation[]): FatigueDay[] {
  if (!isLocalDate(today) || !Number.isFinite(asOf)) return [];
  const daily = new Map<string, { sum: number; valid: number; count: number; hard: boolean; invalid: boolean }>();
  const seen = new Set<string>();
  for (const session of sessions) {
    if (!session.id || !isLocalDate(session.localDate) || session.localDate >= today || !Number.isFinite(session.endAt) || session.endAt > asOf || seen.has(session.id)) continue;
    seen.add(session.id);
    const day = daily.get(session.localDate) ?? { sum: 0, valid: 0, count: 0, hard: false, invalid: false };
    const load = sessionLoad(session.minutes, session.sessionRpe);
    day.count++;
    if (load !== null) { day.sum += load; day.valid++; }
    else if (session.minutes !== null && session.sessionRpe !== null) day.invalid = true;
    if (session.sessionRpe !== null && session.sessionRpe >= FATIGUE_V1.hardSessionRpe && session.sessionRpe <= 10) day.hard = true;
    daily.set(session.localDate, day);
  }
  const confirmed = new Map(confirmations.filter(day => isLocalDate(day.localDate) && day.localDate < today).map(day => [day.localDate, day.kind]));
  const dates = [...new Set([...daily.keys(), ...confirmed.keys()].map(day => shiftDate(day, 1)).concat(today))].sort();
  const references: number[] = [];
  let lastHardDay: string | null = null;
  return dates.map(date => {
    let acute = 0;
    let accumulated = 0;
    let observedDays = 0;
    let completeDays = 0;
    let observedSessions = 0;
    const precedingDay = shiftDate(date, -1);
    if (daily.get(precedingDay)?.hard) lastHardDay = precedingDay;
    let invalid = false;
    for (let back = 1; back <= FATIGUE_V1.windowDays; back++) {
      const day = shiftDate(date, -back);
      const value = daily.get(day);
      const confirmation = confirmed.get(day);
      const complete = value ? confirmation === "complete" && value.valid === value.count : confirmation === "rest";
      if (complete) completeDays++;
      if (value?.valid || complete) {
        observedDays++;
        const load = value?.sum ?? 0;
        acute += load * 2 ** (-back / FATIGUE_V1.acuteHalfLife);
        accumulated += load * 2 ** (-back / FATIGUE_V1.accumulatedHalfLife);
      }
      observedSessions += value?.count ?? 0;
      invalid ||= value?.invalid ?? false;
    }
    const complete = completeDays === FATIGUE_V1.windowDays && Number.isFinite(acute) && Number.isFinite(accumulated);
    const coverage = { valid: completeDays, total: FATIGUE_V1.windowDays };
    const referenceCount = references.length;
    const value = complete && referenceCount >= FATIGUE_V1.referenceMinimum ? personalPercentile(acute, references) : null;
    const missingDays = complete ? [] : ["complete daily workout logs or confirmed rest"];
    const index = trainingMetric({ metricId: "fatigue-index", value, status: value === null ? "unavailable" : "available", unit: "/ 100", method: "Personal training-burden percentile", coverage,
      usedInputs: observedDays ? ["completed session minutes and session RPE", "day confirmations"] : [],
      missingInputs: [...missingDays, ...(referenceCount < FATIGUE_V1.referenceMinimum ? ["14 earlier valid daily snapshots"] : [])],
      reasonCodes: [...(complete ? [] : ["incomplete-coverage" as const]), ...(referenceCount < FATIGUE_V1.referenceMinimum ? ["insufficient-history" as const] : []), ...(invalid ? ["invalid" as const] : [])] });
    const burden = (metricId: string, amount: number, method: string) => trainingMetric({ metricId, value: observedDays ? amount : null, status: complete ? "available" : "partial", unit: "sRPE units",
      method: complete ? method : `Known-load subtotal · ${method}`, coverage, usedInputs: observedDays ? ["completed session minutes and session RPE", "day confirmations"] : [], missingInputs: missingDays,
      reasonCodes: complete ? [] : [observedDays ? "incomplete-coverage" : "missing"] });
    if (complete) {
      references.push(acute);
      if (references.length > FATIGUE_V1.referenceMaximum) references.shift();
    }
    const daysSinceLastHard = lastHardDay === null ? null : (Date.parse(date) - Date.parse(lastHardDay)) / 86_400_000;
    return { date, index, acute: burden("recent-training-burden", acute, "2-day half-life"), accumulated: burden("accumulated-training-burden", accumulated, "7-day half-life"), completeDays, observedSessions, lastHardDay, daysSinceLastHard, referenceCount };
  });
}
