import type { ExerciseDraft, SetDraft } from "./types";

/**
 * First-pass duration. These are product assumptions, not measurements.
 * Unilateral sets use the entered per-side rep count once.
 * Omitted rest (null) is the 90 second default. Explicit 0 rest stays 0.
 * Rest on the last work set of an exercise is not counted.
 * Skipped and warm-up sets are left out, including any rest stored on them.
 */
export const DURATION_ASSUMPTIONS = {
  betweenExerciseSeconds: 60,
  missingBetweenSetRestSeconds: 90,
  secondsPerRep: 3,
} as const;

export type DurationExercise = {
  sets: readonly Pick<SetDraft, "reps" | "restSeconds" | "skipped" | "warmup">[];
};

function workSets(sets: DurationExercise["sets"]) {
  return sets.filter((set) => !set.skipped && !set.warmup && set.reps > 0);
}

export function estimateDurationSeconds(
  exercises: readonly DurationExercise[],
): number | null {
  const blocks = exercises
    .map((exercise) => workSets(exercise.sets))
    .filter((sets) => sets.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  let seconds = 0;
  blocks.forEach((sets, blockIndex) => {
    for (const set of sets) {
      seconds += DURATION_ASSUMPTIONS.secondsPerRep * set.reps;
    }
    for (let index = 0; index < sets.length - 1; index += 1) {
      const rest = sets[index]?.restSeconds;
      seconds +=
        rest == null
          ? DURATION_ASSUMPTIONS.missingBetweenSetRestSeconds
          : rest;
    }
    if (blockIndex < blocks.length - 1) {
      seconds += DURATION_ASSUMPTIONS.betweenExerciseSeconds;
    }
  });

  return seconds;
}

export function estimateDraftDurationSeconds(exercises: readonly ExerciseDraft[]) {
  return estimateDurationSeconds(exercises);
}

export function sessionStartMs(endedAt: number, durationSeconds: number) {
  return endedAt - durationSeconds * 1000;
}

export function formatDurationSeconds(seconds: number | null) {
  if (seconds == null) {
    return "--";
  }
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remain = rounded % 60;
  if (minutes === 0) {
    return `${remain}s`;
  }
  return `${minutes}m ${String(remain).padStart(2, "0")}s`;
}
