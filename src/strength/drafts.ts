import { createId } from "../conditioning/ids";
import { STRENGTH_REP_RANGES } from "./types";
import type {
  CatalogExercise,
  ExerciseDraft,
  LoadMode,
  RepeatTarget,
  SetDraft,
  StrengthDraft,
  StrengthExerciseRecord,
  StrengthExerciseTarget,
  StrengthRepRange,
  StrengthSessionMode,
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

export function defaultStrengthSessionTime(mode: StrengthSessionMode, now = Date.now()) {
  return mode === "planned" ? Math.floor(now / 60_000) * 60_000 + 3_600_000 : now;
}

export function strengthSessionTime(draft: StrengthDraft) {
  return draft.sessionMode === "planned" ? draft.scheduledStartAt ?? NaN : draft.endedAt;
}

export function createLogDraft(
  timestamp: number,
  sessionId = createId(),
  mode?: StrengthSessionMode,
): StrengthDraft {
  return {
    endedAt: mode === "planned" ? 0 : timestamp,
    exercises: [],
    saveAsTemplate: false,
    sessionId,
    ...(mode ? { sessionMode: mode } : {}),
    ...(mode === "planned" ? { scheduledStartAt: timestamp } : {}),
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
  timestamp: number,
  sessionId = createId(),
  mode?: StrengthSessionMode,
): StrengthDraft {
  return {
    ...createLogDraft(timestamp, sessionId, mode),
    exercises: template.exercises
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((record) => exerciseFromRecord(record, mode)),
    saveAsTemplate: true,
    sourceTemplateId: template.id,
    title: template.title,
  };
}

export function draftToCompletePlan(
  plan: {
    exercises: readonly StrengthExerciseRecord[];
    id: string;
    sourceTemplateId: string | null;
    status: StrengthSessionMode;
    title: string;
  },
  now: number,
): StrengthDraft {
  if (plan.status !== "planned") throw new Error("This workout is already completed.");
  return {
    ...createLogDraft(now, plan.id, "completed"),
    exercises: plan.exercises
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((record) => exerciseFromRecord(record, "completed", record.id)),
    sourceTemplateId: plan.sourceTemplateId,
    title: plan.title,
  };
}

function exerciseFromRecord(
  record: StrengthExerciseRecord,
  mode?: StrengthSessionMode,
  id = createId(),
): ExerciseDraft {
  const ordered = record.sets.slice().sort((left, right) => left.position - right.position);
  const first = ordered[0];
  const repeat: RepeatTarget = record.target
    ? {
        assistanceKg: record.target.assistanceKg,
        loadKg: record.target.loadKg,
        reps: repRangeReps(record.target.repRange),
        restSeconds: record.target.restSeconds,
        rpe: record.target.rpe,
        rir: record.target.rir,
      }
    : first
    ? {
        assistanceKg: first.assistanceKg,
        loadKg: first.loadKg,
        reps: first.reps,
        restSeconds: first.restSeconds,
        rpe: first.rpe,
        ...(first.rir != null ? { rir: first.rir } : {}),
      }
    : emptyRepeat();
  const exercise: ExerciseDraft = {
    catalogExerciseId: record.catalogExerciseId,
    equipment: record.equipment,
    explosiveIntent: record.explosiveIntent,
    id,
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
            ...(set.rir != null ? { rir: set.rir } : {}),
            skipped: false,
            warmup: false,
          }))
        : [makeSet(repeat)],
    ...(record.target ? { target: {
      sets: record.target.sets,
      repRange: record.target.repRange,
      rpe: record.target.rpe,
      rir: record.target.rir,
      restSeconds: record.target.restSeconds,
    } } : {}),
    unilateral: record.unilateral,
  };
  return mode ? initializeStrengthTargets(exercise, mode) : exercise;
}

function sameTarget(set: RepeatTarget, repeat: RepeatTarget) {
  return (
    set.assistanceKg === repeat.assistanceKg &&
    set.loadKg === repeat.loadKg &&
    set.reps === repeat.reps &&
    set.restSeconds === repeat.restSeconds &&
    (set.rir ?? null) === (repeat.rir ?? null) &&
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
  const next: ExerciseDraft = {
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
  };
  return {
    ...draft,
    exercises: [...draft.exercises, draft.sessionMode ? initializeStrengthTargets(next, draft.sessionMode) : next],
  };
}

const representativeReps: Record<StrengthRepRange, number> = {
  "1RM": 1, "1-3": 2, "3-5": 4, "6-8": 7,
  "8-12": 10, "12-15": 14, "15-20": 18, "20+": 20,
};

export function repRangeReps(range: StrengthRepRange) {
  return representativeReps[range];
}

export function getStrengthTarget(exercise: ExerciseDraft): StrengthExerciseTarget {
  if (exercise.target) return exercise.target;
  const { reps, rpe, rir, restSeconds } = exercise.repeat;
  // A legacy single rep could have been submaximal. Never label it a 1RM.
  const rangeIndex = [3, 5, 8, 12, 15, 20].findIndex((upper) => reps <= upper);
  const repRange = rangeIndex < 0 ? "20+" : STRENGTH_REP_RANGES[rangeIndex + 1]!;
  return { sets: Math.max(1, exercise.sets.length), repRange, rpe, rir: rir ?? null, restSeconds };
}

export function plannedSetTarget(exercise: ExerciseDraft): RepeatTarget {
  const target = getStrengthTarget(exercise);
  return {
    ...exercise.repeat,
    reps: repRangeReps(target.repRange),
    rpe: target.rpe,
    rir: target.rir,
    restSeconds: target.restSeconds,
  };
}

function makeActualSet(): SetDraft {
  return {
    ...makeSet(emptyRepeat()),
    followsRepeat: false,
    actual: { reps: "", rpe: "", rir: "" },
  };
}

function initializeStrengthTargets(exercise: ExerciseDraft, mode: StrengthSessionMode) {
  return setStrengthTarget({ ...exercise, sets: [] }, getStrengthTarget(exercise), mode);
}

export function setStrengthTarget(
  exercise: ExerciseDraft,
  patch: Partial<StrengthExerciseTarget>,
  mode: StrengthSessionMode,
): ExerciseDraft {
  const target = { ...getStrengthTarget(exercise), ...patch };
  const sets = mode === "planned" ? [] : exercise.sets.slice(0, target.sets);
  while (mode === "completed" && sets.length < target.sets) {
    sets.push(makeActualSet());
  }
  return { ...exercise, target, sets };
}

function optionalWholeNumber(value: string, min: number, max: number) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  return number >= min && number <= max ? number : NaN;
}

function parseActual(actual: NonNullable<SetDraft["actual"]>) {
  return {
    reps: optionalWholeNumber(actual.reps, 1, MAX_REPS),
    rpe: optionalWholeNumber(actual.rpe, 1, 10),
    rir: actual.rir.trim() === "10+" ? 10 : optionalWholeNumber(actual.rir, 0, 10),
  };
}

export function performedSets(exercise: ExerciseDraft): SetDraft[] {
  return exercise.sets.flatMap((set) => {
    if (!set.actual) return [set];
    const { reps, rpe, rir } = parseActual(set.actual);
    if (reps == null || Number.isNaN(reps) || Number.isNaN(rpe) || Number.isNaN(rir)) return [];
    return [{ ...set, reps, rpe, rir }];
  });
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
      .map((exercise) => exercise.target ? {
        ...exercise,
        sets: [],
      } : {
        ...exercise,
        sets: exercise.sets.filter((set) => !set.skipped && !set.warmup),
      })
      .filter((exercise) => exercise.target || exercise.sets.length > 0),
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
    const timestamp = strengthSessionTime(draft);
    if (draft.sessionMode === "planned") {
      if (!Number.isFinite(timestamp) || timestamp <= now || !Number.isFinite(new Date(timestamp).getTime())) {
        return "Choose a workout start time in the future.";
      }
    } else if (!Number.isFinite(timestamp) || timestamp > now || !Number.isFinite(new Date(timestamp).getTime())) {
      return "Choose a workout end time that is not in the future.";
    }
  }

  let workSets = 0;
  for (const exercise of draft.exercises) {
    const notes = exercise.notes.trim();
    if (notes.length > MAX_NOTES) {
      return "Notes must be 1000 characters or fewer.";
    }
    if (exercise.target) {
      const { sets, repRange, rpe, rir, restSeconds } = exercise.target;
      if (!Number.isInteger(sets) || sets < 1 || sets > MAX_SETS) return "Sets must be from 1 to 20.";
      if (!STRENGTH_REP_RANGES.includes(repRange)) return "Choose a rep range.";
      if (rpe != null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) return "Target RPE must be from 1 to 10.";
      if (rir != null && (!Number.isInteger(rir) || rir < 0 || rir > 10)) return "Target RIR must be from 0 to 10+.";
      if (
        (restSeconds != null && (!Number.isInteger(restSeconds) || restSeconds < 0 || restSeconds > MAX_REST_SECONDS)) ||
        (exercise.restSecondsInput != null && optionalWholeNumber(exercise.restSecondsInput, 0, MAX_REST_SECONDS) !== restSeconds)
      ) return "Rest must be a whole number from 0 to 600 seconds.";
      if (mode === "template" || draft.sessionMode === "planned") {
        workSets += sets;
        continue;
      }
      if (exercise.sets.length !== sets) return `Check the set count for ${exercise.name}.`;
    }
    if (exercise.sets.length === 0) {
      return "Add at least one set.";
    }
    for (const [index, set] of exercise.sets.entries()) {
      const row = `${exercise.name}, set ${index + 1}`;
      if (draft.sessionMode === "completed" && mode === "log" && !set.actual) {
        return `Enter 1 to 100 reps for ${row}.`;
      }
      if (set.actual) {
        const { reps, rpe, rir } = parseActual(set.actual);
        if (reps == null || Number.isNaN(reps)) return `Enter 1 to 100 reps for ${row}.`;
        if (Number.isNaN(rpe)) return `Enter RPE from 1 to 10 for ${row}.`;
        if (Number.isNaN(rir)) return `Enter RIR from 0 to 10+ for ${row}.`;
      }
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
      if (set.rir != null && (!Number.isInteger(set.rir) || set.rir < 0 || set.rir > 10)) {
        return "RIR must be from 0 to 10+.";
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
  // The compact editor does not ask for load. Omitted values stay unknown.
  if (set.loadKg != null && (!Number.isFinite(set.loadKg) || set.loadKg < 0)) {
    return "Enter a valid weight.";
  }
  if (mode === "external" && set.loadKg === 0) {
    return "Enter a positive weight.";
  }
  if (set.assistanceKg != null && (!Number.isFinite(set.assistanceKg) || set.assistanceKg <= 0)) {
    return "Enter positive assistance.";
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
