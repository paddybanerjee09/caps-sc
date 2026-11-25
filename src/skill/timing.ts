import { DURATION_ASSUMPTIONS, estimateDurationSeconds } from "../strength/duration";
import type { SkillActivityDraft } from "./types";

export type ActivityTiming = {
  elapsedSeconds: number;
  restSeconds: number;
  workSeconds: number;
};

export function activityTiming(activity: SkillActivityDraft): ActivityTiming {
  if (activity.timingMode === "duration") {
    const workSeconds = Math.max(0, activity.durationSeconds);
    return { workSeconds, restSeconds: 0, elapsedSeconds: workSeconds };
  }

  if (activity.timingMode === "reps") {
    const sets = Array.from({ length: activity.sets }, () => ({
      reps: activity.reps, restSeconds: activity.restBetweenSetsSeconds, skipped: false, warmup: false,
    }));
    const elapsed = estimateDurationSeconds([{ sets }]) ?? 0;
    const workSeconds = activity.sets * activity.reps * DURATION_ASSUMPTIONS.secondsPerRep;
    return { workSeconds, restSeconds: elapsed - workSeconds, elapsedSeconds: elapsed };
  }

  const rounds = Math.max(0, activity.rounds);
  const workSeconds = rounds * Math.max(0, activity.secondsPerRound);
  const restSeconds =
    Math.max(0, rounds - 1) * Math.max(0, activity.restBetweenRoundsSeconds);
  return { workSeconds, restSeconds, elapsedSeconds: workSeconds + restSeconds };
}

export function elapsedSeconds(activities: readonly SkillActivityDraft[]) {
  if (activities.length === 0) {
    return null;
  }
  return activities.reduce(
    (total, activity) => total + activityTiming(activity).elapsedSeconds,
    0,
  );
}

export function sessionStartMs(endedAt: number, elapsed: number) {
  return endedAt - elapsed * 1000;
}
