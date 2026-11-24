import { MAX_NOTES, MAX_REPS, MAX_REST_SECONDS, MAX_SETS, resizeSets } from "./drafts";
import type { ExerciseDraft, SetDraft } from "./types";

export type ExerciseForm = {
  sets: string;
  reps: string;
  rpe: string;
  restSeconds: string;
  notes: string;
};

function setValue(exercise: ExerciseDraft, field: "reps" | "rpe" | "restSeconds") {
  const first = exercise.sets[0]?.[field] ?? null;
  return exercise.sets.some((set) => set[field] !== first) ? "Mixed" : first == null ? "" : String(first);
}

export function exerciseFormValues(exercise: ExerciseDraft): ExerciseForm {
  return {
    sets: String(exercise.sets.length),
    reps: setValue(exercise, "reps"),
    rpe: setValue(exercise, "rpe"),
    restSeconds: setValue(exercise, "restSeconds"),
    notes: exercise.notes,
  };
}

/** Compact fields change their targets only; existing load and performed flags survive. */
export function exerciseFromForm(exercise: ExerciseDraft, form: ExerciseForm): {
  error: string | null;
  exercise: ExerciseDraft | null;
} {
  const initial = exerciseFormValues(exercise);
  const count = Number(form.sets);
  if (!/^\d+$/.test(form.sets.trim()) || count < 1 || count > MAX_SETS) {
    return { error: `Sets must be from 1 to ${MAX_SETS}.`, exercise: null };
  }
  const targets: Partial<Pick<SetDraft, "reps" | "rpe" | "restSeconds">> = {};
  for (const [field, label, minimum, maximum] of [
    ["reps", "Reps", 1, MAX_REPS],
    ["rpe", "RPE", 1, 10],
    ["restSeconds", "Rest", 0, MAX_REST_SECONDS],
  ] as const) {
    const text = form[field].trim();
    if (text === "Mixed" && initial[field] === "Mixed") continue;
    if (!text && field !== "reps") {
      targets[field] = null;
      continue;
    }
    const value = Number(text);
    if (!/^\d+$/.test(text) || value < minimum || value > maximum) {
      return { error: `${label} must be from ${minimum} to ${maximum}.`, exercise: null };
    }
    targets[field] = value;
  }
  if (form.notes.length > MAX_NOTES) {
    return { error: `Notes must be ${MAX_NOTES} characters or fewer.`, exercise: null };
  }
  const resized = resizeSets(exercise, count);
  const repeat = { ...resized.repeat, ...targets };
  return {
    error: null,
    exercise: {
      ...resized,
      notes: form.notes,
      repeat,
      sets: resized.sets.map((set) => {
        const next = { ...set, ...targets };
        return {
          ...next,
          followsRepeat: next.reps === repeat.reps && next.rpe === repeat.rpe &&
            next.restSeconds === repeat.restSeconds && next.loadKg === repeat.loadKg &&
            next.assistanceKg === repeat.assistanceKg,
        };
      }),
    },
  };
}
