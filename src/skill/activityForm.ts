import { MAX_REPS, MAX_REST_SECONDS, MAX_SETS } from "../strength/drafts";
import { rpeBandFor } from "./energy";
import type { SessionMode, SkillActivityDraft } from "./types";

export type SkillActivityForm = {
  mode: "reps" | "rounds";
  sets: string;
  reps: string;
  rpe: string;
  restBetweenSets: string;
  work: string;
  rest: string;
  rounds: string;
  sessionMode: SessionMode | null;
};

export function activityFormValues(activity: SkillActivityDraft): SkillActivityForm {
  const legacyDuration = activity.timingMode === "duration";
  return {
    mode: activity.timingMode === "reps" ? "reps" : "rounds",
    sets: String(activity.sets), reps: String(activity.reps),
    rpe: activity.rpe == null ? "" : String(activity.rpe),
    restBetweenSets: activity.restBetweenSetsSeconds == null ? "" : String(activity.restBetweenSetsSeconds),
    work: String(legacyDuration ? activity.durationSeconds : activity.secondsPerRound),
    rest: String(legacyDuration ? 0 : activity.restBetweenRoundsSeconds),
    rounds: String(legacyDuration ? 1 : activity.rounds),
    sessionMode: activity.sessionMode,
  };
}

function integer(text: string, minimum: number, maximum: number) {
  const value = Number(text);
  return /^\d+$/.test(text.trim()) && Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

export function activityFromForm(activity: SkillActivityDraft, form: SkillActivityForm): { activity: SkillActivityDraft | null; error: string | null } {
  const rpe = form.rpe.trim() ? integer(form.rpe, 1, 10) : null;
  if (form.rpe.trim() && rpe == null) return { activity: null, error: "RPE must be from 1 to 10." };
  const next = { ...activity, rpe, rpeBand: rpeBandFor(rpe, activity.rpeBand), sessionMode: form.sessionMode };
  if (form.mode === "reps") {
    const sets = integer(form.sets, 1, MAX_SETS);
    const reps = integer(form.reps, 1, MAX_REPS);
    const rest = form.restBetweenSets.trim() ? integer(form.restBetweenSets, 0, MAX_REST_SECONDS) : null;
    if (sets == null) return { activity: null, error: "Sets must be from 1 to 20." };
    if (reps == null) return { activity: null, error: "Reps must be from 1 to 100." };
    if (form.restBetweenSets.trim() && rest == null) return { activity: null, error: "Rest must be from 0 to 600 seconds." };
    return { activity: { ...next, timingMode: "reps", sets, reps, restBetweenSetsSeconds: rest }, error: null };
  }
  const rounds = integer(form.rounds, 1, 2000);
  const work = integer(form.work, 1, 86400);
  const rest = integer(form.rest, 0, 86400);
  if (rounds == null) return { activity: null, error: "Rounds must be from 1 to 2000." };
  if (work == null) return { activity: null, error: "Enter a positive work time in seconds." };
  if (rest == null) return { activity: null, error: "Enter a nonnegative rest time in seconds." };
  return { activity: { ...next, timingMode: "rounds", rounds, secondsPerRound: work, restBetweenRoundsSeconds: rest }, error: null };
}
