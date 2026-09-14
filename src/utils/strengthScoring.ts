import { strengthAdaptationOrder, strengthCurves as c, strengthModelVersion } from "../constants/strength";
import type { StrengthExercise, StrengthExerciseScore, StrengthScoreResult, StrengthScores } from "../types/strength";
import { isWeightedDynamicLabel } from "./strengthMovementProfile";
import { validateStrengthExercise } from "./strengthSessionDraft";

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
function preference(n: number, [a, b, d, e]: readonly number[]) {
  return clamp(Math.min((n - a) / (b - a), (e - n) / (e - d)));
}
export function scoreStrengthExercise(e: StrengthExercise): StrengthExerciseScore {
  validateStrengthExercise(e);
  const rir = clamp(10 - e.rpe, 0, 5);
  const estimated1RM = e.percent1RM === null && e.externalLoadKg > 0 && e.reps + rir <= 30 && isWeightedDynamicLabel(e.name)
    ? e.externalLoadKg * (1 + (e.reps + rir) / 30) : null;
  const percent = e.percent1RM ?? (estimated1RM ? 100 * e.externalLoadKg / estimated1RM : null);
  const intensitySource = e.percent1RM !== null ? "entered" : estimated1RM ? "estimated" : "unavailable";
  const intensity = (curve: readonly number[]) => percent === null ? c.missingIntensityPreference : preference(percent, curve);
  const totalRepetitions = e.sets * e.reps;
  const volumeLoadKg = e.externalLoadKg * totalRepetitions;
  const hardSets = e.sets * clamp((e.rpe - c.hardSetRpeFloor) / c.hardSetRpeSpan, 0.1);
  const movement = e.movementProfile === "explosive" ? 1 : e.movementProfile === "unknown" ? c.unknownPowerFactor : c.nonExplosivePowerFactor;
  const hypertrophyVolume = e.externalLoadKg === 0 ? 1
    : c.volumeLoadFloor + (1 - c.volumeLoadFloor) * clamp(volumeLoadKg / c.hypertrophyVolumeLoadKg);
  const scores: StrengthScores = {
    hypertrophy: 100 * preference(e.reps, c.hypertrophyReps) * preference(e.rpe, c.hypertrophyRpe) * intensity(c.hypertrophyIntensity) * hypertrophyVolume,
    power: 100 * movement * preference(e.reps, c.powerReps) * preference(e.rpe, c.powerRpe) * intensity(c.powerIntensity) * preference(totalRepetitions, c.powerExposure),
    endurance: 100 * preference(e.reps, c.enduranceReps) * intensity(c.enduranceIntensity) * clamp(totalRepetitions / c.sessionRepetitions),
  };
  return { scores, hardSets, totalRepetitions, volumeLoadKg,
    percent1RMUsed: percent, estimated1RM, intensitySource,
    evidence: intensitySource === "entered" && e.movementProfile !== "unknown" ? "full" : "limited", modelVersion: strengthModelVersion };
}
export function scoreStrengthSession(exercises: readonly StrengthExercise[]): StrengthScoreResult {
  if (!exercises.length) return { status: "insufficient", reasons: ["Add an exercise with sets, reps, load, and RPE."] };
  try {
    const contributions = exercises.map(scoreStrengthExercise);
    const hardSets = contributions.reduce((sum, e) => sum + e.hardSets, 0);
    const repetitions = contributions.reduce((sum, e) => sum + e.totalRepetitions, 0);
    const exposure = c.exposureFloor + (1 - c.exposureFloor) * clamp(Math.max(hardSets / c.sessionHardSets, repetitions / c.sessionRepetitions));
    const scores: StrengthScores = { hypertrophy: 0, power: 0, endurance: 0 };
    for (const key of strengthAdaptationOrder) scores[key] = Math.round(clamp(contributions.reduce((sum, e) => sum + e.scores[key] * e.hardSets, 0) / hardSets * exposure, 0, 100) * 10) / 10;
    const primaryAdaptation = strengthAdaptationOrder.reduce((best, key) => scores[key] > scores[best] ? key : best);
    const limited = contributions.some(e => e.evidence === "limited");
    return { status: "scored", scores, primaryAdaptation, evidence: limited ? "limited" : "full", modelVersion: strengthModelVersion,
      missingInputs: limited ? ["Some intensity values are estimated or unavailable, or movement intent is unknown."] : [], exercises: contributions };
  } catch (error) { return { status: "insufficient", reasons: [error instanceof Error ? error.message : "Check exercise inputs."] }; }
}
