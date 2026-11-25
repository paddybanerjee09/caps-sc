import { baseMetFor } from "./catalog";
import { activityTiming, elapsedSeconds } from "./timing";
import {
  RECOVERY_MET,
  REFERENCE_WEIGHT_KG,
  SKILL_ENERGY_VERSION,
  type RpeBand,
  type SkillActivityDraft,
  type WeightBasis,
} from "./types";

export function rpeBandFor(rpe: number | null, fallback: RpeBand): RpeBand {
  return rpe == null ? fallback : rpe <= 6 ? "easy" : rpe <= 8 ? "moderate" : "hard";
}

export const RPE_MULTIPLIER: Record<RpeBand, number> = {
  easy: 0.8,
  moderate: 1,
  hard: 1.1,
};

export type ActivityEnergy = {
  baseMet: number;
  elapsedSeconds: number;
  energyKcal: number;
  id: string;
  restSeconds: number;
  rpeMultiplier: number;
  workSeconds: number;
};

export function activityEnergyKcal(input: {
  baseMet: number;
  restSeconds: number;
  rpeBand: RpeBand;
  weightKg: number;
  workSeconds: number;
}) {
  const multiplier = RPE_MULTIPLIER[input.rpeBand];
  return (
    (input.weightKg *
      (input.baseMet * multiplier * input.workSeconds +
        RECOVERY_MET * input.restSeconds)) /
    3600
  );
}

export function estimateActivities(
  activities: readonly SkillActivityDraft[],
  weightKg: number,
) {
  const estimates: ActivityEnergy[] = [];
  for (const activity of activities) {
    const baseMet = baseMetFor(activity.activityKey, activity.sessionMode);
    if (baseMet == null) {
      continue;
    }
    const timing = activityTiming(activity);
    estimates.push({
      id: activity.id,
      baseMet,
      rpeMultiplier: RPE_MULTIPLIER[rpeBandFor(activity.rpe, activity.rpeBand)],
      ...timing,
      energyKcal: activityEnergyKcal({
        baseMet,
        restSeconds: timing.restSeconds,
        rpeBand: rpeBandFor(activity.rpe, activity.rpeBand),
        weightKg,
        workSeconds: timing.workSeconds,
      }),
    });
  }
  return estimates;
}

export function sumEnergyKcal(activities: readonly { energyKcal: number }[]) {
  return activities.reduce((total, activity) => total + activity.energyKcal, 0);
}

export function displayKcal(unrounded: number) {
  return Math.round(unrounded);
}

export function weightForEstimate(loggedKg: number | null): {
  basis: WeightBasis;
  kg: number;
} {
  if (loggedKg != null && Number.isFinite(loggedKg) && loggedKg > 0) {
    return { basis: "logged", kg: loggedKg };
  }
  return { basis: "reference", kg: REFERENCE_WEIGHT_KG };
}

export { SKILL_ENERGY_VERSION, elapsedSeconds };
