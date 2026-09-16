import { strengthLimits } from "../constants/strength";
import type { StrengthExercise, StrengthSessionDraft } from "../types/strength";

export function validateStrengthExercise(e: StrengthExercise): void {
  if (!e.exerciseId?.trim() || !e.name?.trim() || e.name.trim().length > 120)
    throw new Error("Choose an exercise with a name of 1–120 characters.");
  if (!Number.isFinite(e.externalLoadKg) || e.externalLoadKg < 0 || e.externalLoadKg > strengthLimits.loadKg)
    throw new Error("Weight must be between 0 and 2000 kg.");
  if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > strengthLimits.sets ||
      !Number.isInteger(e.reps) || e.reps < 1 || e.reps > strengthLimits.reps)
    throw new Error("Enter whole sets (1–50) and reps (1–500).");
  if (!Number.isFinite(e.rpe) || e.rpe < 1 || e.rpe > 10) throw new Error("RPE must be from 1 to 10.");
  if (e.percent1RM !== null && (!Number.isFinite(e.percent1RM) || e.percent1RM <= 0 || e.percent1RM > 100))
    throw new Error("%1RM must be greater than 0 and at most 100.");
  if (!["explosive", "non_explosive", "unknown"].includes(e.movementProfile) ||
      !["curated-id", "name-rule", "unknown"].includes(e.movementProfileSource)) throw new Error("Invalid movement profile.");
  if (e.notes !== null && (typeof e.notes !== "string" || e.notes.length > strengthLimits.notes))
    throw new Error("Exercise notes must be at most 2000 characters.");
}
export function validateStrengthSession(draft: StrengthSessionDraft): StrengthSessionDraft {
  if (!draft.title?.trim() || draft.title.trim().length > 80) throw new Error("Session title must be 1–80 characters.");
  if (!draft.exercises.length || draft.exercises.length > strengthLimits.exercises) throw new Error("Add 1–100 exercises.");
  draft.exercises.forEach(validateStrengthExercise);
  return { title: draft.title.trim(), exercises: draft.exercises.map(e => ({ ...e, name: e.name.trim(), notes: e.notes?.trim() || null })) };
}
export function strengthLogTimeForDate(selectedDate: Date, now = new Date()) {
  const value = new Date(selectedDate);
  value.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  if (!Number.isFinite(value.getTime()) || value.getTime() > now.getTime()) throw new Error("Cannot log a future date.");
  return value;
}
