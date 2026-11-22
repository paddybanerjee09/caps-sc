import { createId } from "../conditioning/ids";
import type {
  CatalogExercise,
  ExerciseDraft,
  LoadMode,
  RepeatTarget,
  SetDraft,
  StrengthDraft,
  StrengthExerciseRecord,
} from "./types";

export const MAX_EXERCISES = 40;
export const MAX_NOTES = 1000;
export const MAX_REPS = 100;
export const MAX_REST_SECONDS = 600;
export const MAX_SETS = 20;
export const TITLE_MAX = 80;

const emptyRepeat = (): RepeatTarget => ({
  assistanceKg: null,
  loadKg: null,
  reps: 5,
  restSeconds: null,
  rpe: null,
});

export function createLogDraft(now: number, sessionId = createId()): StrengthDraft {
  return {
    endedAt: now,
    exercises: [],
    saveAsTemplate: false,
    sessionId,
    sourceTemplateId: null,
    title: "",
  };
}

export function createTemplateDraft(sessionId = createId()): StrengthDraft {
  return createLogDraft(0, sessionId);
}

export function draftFromTemplate(
  template: {
    exercises: StrengthExerciseRecord[];
    id: string;
    title: string;
  },
  now: number,
  sessionId = createId(),
): StrengthDraft {
  return {
    endedAt: now,
    exercises: template.exercises
      .slice()
      .sort((left, right) => left.position - right.position)
      .map(exerciseFromRecord),
    saveAsTemplate: true,
    sessionId,
    sourceTemplateId: template.id,
    title: template.title,
  };
}

function exerciseFromRecord(record: StrengthExerciseRecord): ExerciseDraft {
  const ordered = record.sets.slice().sort((left, right) => left.position - right.position);
  const first = ordered[0];
  const repeat: RepeatTarget = first
    ? {
        assistanceKg: first.assistanceKg,
        loadKg: first.loadKg,
        reps: first.reps,
        restSeconds: first.restSeconds,
        rpe: first.rpe,
      }
    : emptyRepeat();
  return {
    catalogExerciseId: record.catalogExerciseId,
    equipment: record.equipment,
    explosiveIntent: record.explosiveIntent,
    id: createId(),
    loadMode: record.loadMode,
    muscleGroups: record.muscleGroups,
    name: record.name,
    notes: record.notes,
    repeat,
    sets:
      ordered.length > 0
        ? ordered.map((set) => ({
            assistanceKg: set.assistanceKg,
            followsRepeat: sameTarget(set, repeat),
            id: createId(),
            loadKg: set.loadKg,
            reps: set.reps,
            restSeconds: set.restSeconds,
            rpe: set.rpe,
            skipped: false,
            warmup: false,
          }))
        : [makeSet(repeat)],
    unilateral: record.unilateral,
  };
}

function sameTarget(set: RepeatTarget, repeat: RepeatTarget) {
  return (
    set.assistanceKg === repeat.assistanceKg &&
    set.loadKg === repeat.loadKg &&
    set.reps === repeat.reps &&
    set.restSeconds === repeat.restSeconds &&
    set.rpe === repeat.rpe
  );
}

function makeSet(repeat: RepeatTarget, id = createId()): SetDraft {
  return {
    ...repeat,
    followsRepeat: true,
    id,
    skipped: false,
    warmup: false,
  };
}

export function addCatalogExercise(
  draft: StrengthDraft,
  exercise: CatalogExercise,
): StrengthDraft {
  if (draft.exercises.length >= MAX_EXERCISES) {
    return draft;
  }
  const repeat = emptyRepeat();
  return {
    ...draft,
    exercises: [
      ...draft.exercises,
      {
        catalogExerciseId: exercise.id,
        equipment: exercise.equipment,
        explosiveIntent: exercise.suggestsExplosive,
        id: createId(),
        loadMode: exercise.defaultLoadMode,
        muscleGroups: exercise.muscleGroups,
        name: exercise.name,
        notes: "",
        repeat,
        sets: [makeSet(repeat)],
        unilateral: exercise.defaultUnilateral,
      },
    ],
  };
}

export function removeExercise(draft: StrengthDraft, exerciseId: string): StrengthDraft {
  return {
    ...draft,
    exercises: draft.exercises.filter((exercise) => exercise.id !== exerciseId),
  };
}

export function moveExercise(
  draft: StrengthDraft,
  exerciseId: string,
  direction: -1 | 1,
): StrengthDraft {
  const index = draft.exercises.findIndex((exercise) => exercise.id === exerciseId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= draft.exercises.length) {
    return draft;
  }
  const exercises = draft.exercises.slice();
  const [row] = exercises.splice(index, 1);
  if (!row) {
    return draft;
  }
  exercises.splice(nextIndex, 0, row);
  return { ...draft, exercises };
}

export function updateExercise(
  draft: StrengthDraft,
  exerciseId: string,
  update: (exercise: ExerciseDraft) => ExerciseDraft,
): StrengthDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.id === exerciseId ? update(exercise) : exercise,
    ),
  };
}

export function applyRepeat(
  exercise: ExerciseDraft,
  repeat: RepeatTarget,
): ExerciseDraft {
  return {
    ...exercise,
    repeat,
    sets: exercise.sets.map((set) =>
      set.followsRepeat ? { ...set, ...repeat, followsRepeat: true } : set,
    ),
  };
}

export function resizeSets(exercise: ExerciseDraft, count: number): ExerciseDraft {
  const nextCount = Math.min(MAX_SETS, Math.max(1, Math.round(count)));
  const sets = exercise.sets.slice(0, nextCount);
  while (sets.length < nextCount) {
    sets.push(makeSet(exercise.repeat));
  }
  return { ...exercise, sets };
}

export function customizeSet(exercise: ExerciseDraft, setId: string): ExerciseDraft {
  return updateSet(exercise, setId, (set) => ({ ...set, followsRepeat: false }));
}

export function matchSetToRepeat(exercise: ExerciseDraft, setId: string): ExerciseDraft {
  return updateSet(exercise, setId, (set) => makeSet(exercise.repeat, set.id));
}

export function updateSet(
  exercise: ExerciseDraft,
  setId: string,
  update: (set: SetDraft) => SetDraft,
): ExerciseDraft {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => (set.id === setId ? update(set) : set)),
  };
}

export function setLoadMode(exercise: ExerciseDraft, loadMode: LoadMode): ExerciseDraft {
  const repeat: RepeatTarget = {
    ...exercise.repeat,
    assistanceKg: loadMode === "assisted" ? exercise.repeat.assistanceKg : null,
    loadKg: loadMode === "assisted" ? null : exercise.repeat.loadKg,
  };
  const next = applyRepeat({ ...exercise, loadMode }, repeat);
  return {
    ...next,
    sets: next.sets.map((set) => {
      if (set.followsRepeat) {
        return set;
      }
      if (loadMode === "assisted") {
        return { ...set, loadKg: null };
      }
      return { ...set, assistanceKg: null };
    }),
  };
}

export function projectTemplateDraft(draft: StrengthDraft): StrengthDraft {
  return {
    ...draft,
    exercises: draft.exercises
      .map((exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => !set.skipped && !set.warmup),
      }))
      .filter((exercise) => exercise.sets.length > 0),
    saveAsTemplate: true,
  };
}

export function saveWorkoutConsequence(draft: StrengthDraft) {
  if (draft.sourceTemplateId) {
    return draft.saveAsTemplate
      ? "Logging updates the saved workout to match this draft."
      : "Logging with this off removes the saved workout from your list, and the session you log still stays on your calendar.";
  }
  return draft.saveAsTemplate
    ? "Logging also saves this as a reusable workout."
    : "This log stays in history only.";
}

export function validateStrengthDraft(
  draft: StrengthDraft,
  mode: "log" | "template",
  now: number,
) {
  const title = draft.title.trim();
  if (!title) {
    return "Enter a workout title.";
  }
  if (title.length > TITLE_MAX) {
    return "Title must be 80 characters or fewer.";
  }
  if (draft.exercises.length === 0) {
    return "Add an exercise.";
  }
  if (mode === "log") {
    if (!Number.isFinite(draft.endedAt) || draft.endedAt > now) {
      return "Choose an end time that is not in the future.";
    }
  }

  let workSets = 0;
  for (const exercise of draft.exercises) {
    const notes = exercise.notes.trim();
    if (notes.length > MAX_NOTES) {
      return "Notes must be 1000 characters or fewer.";
    }
    if (exercise.sets.length === 0) {
      return "Add at least one set.";
    }
    for (const set of exercise.sets) {
      if (!Number.isInteger(set.reps) || set.reps <= 0 || set.reps > MAX_REPS) {
        return "Reps must be a positive whole number.";
      }
      if (
        set.restSeconds != null &&
        (!Number.isInteger(set.restSeconds) ||
          set.restSeconds < 0 ||
          set.restSeconds > MAX_REST_SECONDS)
      ) {
        return "Rest cannot be negative.";
      }
      if (
        set.rpe != null &&
        (!Number.isInteger(set.rpe) || set.rpe < 1 || set.rpe > 10)
      ) {
        return "RPE must be from 1 to 10.";
      }
      if (set.skipped || set.warmup) {
        continue;
      }
      workSets += 1;
      const weightError = weightErrorFor(exercise.loadMode, set);
      if (weightError) {
        return weightError;
      }
    }
  }

  if (workSets === 0) {
    return "Add at least one work set.";
  }
  return null;
}

function weightErrorFor(mode: LoadMode, set: SetDraft) {
  if (mode === "external") {
    if (set.loadKg == null || !(set.loadKg > 0)) {
      return "Enter a weight or choose bodyweight.";
    }
  }
  if (mode === "assisted") {
    if (set.assistanceKg == null || !(set.assistanceKg > 0)) {
      return "Enter assistance.";
    }
  }
  if (mode === "bodyweight" && set.loadKg != null && set.loadKg < 0) {
    return "Enter a weight or choose bodyweight.";
  }
  return null;
}

export function tableField<Set extends RepeatTarget>(
  sets: readonly Set[],
  read: (set: Set) => string,
): string {
  if (sets.length === 0) {
    return "--";
  }
  const first = read(sets[0]!);
  return sets.some((set, index) => index > 0 && read(set) !== first) ? "Mixed" : first;
}
