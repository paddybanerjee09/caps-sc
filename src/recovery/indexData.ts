import type { SleepTarget } from "../data/trainingIndexRepository";
import { calculateRecoveryIndex, questionnaireRecoverySleep, type ManualRecoverySleep } from "./recoveryIndex";
import type { HealthMeasurement, HealthState, PreferredSources, Questionnaire } from "./types";

export type IndexSources = {
  questionnaires: readonly Questionnaire[];
  sleepTargets: readonly SleepTarget[];
  measurements: readonly HealthMeasurement[];
  health: HealthState | null;
  preferred: PreferredSources;
};

const wearableMetrics = ["rhr", "hrv", "sleep_duration"] as const;

export function recoveryInputs(sources: IndexSources) {
  const { questionnaires, sleepTargets, measurements, health, preferred } = sources;
  const manualSleep = questionnaires.flatMap(entry => questionnaireRecoverySleep(entry) ?? []);
  const byDay = new Map(questionnaires.map(entry => [entry.localDate, entry]));
  const allowWearables = health?.status === "ready" || health?.status === "sync_error" && health?.capabilities.authorization_requested === "true";
  const blockedWearableMetrics = wearableMetrics.filter(metric => /not granted/i.test(health?.capabilities[metric] ?? ""));
  const permitted = allowWearables ? measurements.filter(item => item.platform === health.platform && !blockedWearableMetrics.some(metric => metric === item.metric)) : [];
  return {
    manualSleep,
    permitted,
    calculate(localDate: string, asOf: number, extraManualSleep: readonly ManualRecoverySleep[] = []) {
      const q = byDay.get(localDate);
      return calculateRecoveryIndex({ localDate, asOf, checkIn: q?.status === "completed" ? { localDate, readiness: q.readiness, soreness: q.soreness, availableAt: q.completedAt ?? undefined } : null,
        sleepTargetHours: sleepTargets.findLast(entry => entry.effectiveDate <= localDate)?.hours ?? null,
        manualSleep: extraManualSleep.length ? [...manualSleep, ...extraManualSleep] : manualSleep, measurements: permitted, preferred, allowWearables, blockedWearableMetrics });
    },
  };
}
