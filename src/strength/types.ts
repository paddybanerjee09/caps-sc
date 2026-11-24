export type LoadMode = "external" | "bodyweight" | "assisted";

export type CatalogSource = "free_exercise_db" | "custom";

export type CatalogExercise = {
  imageUrl?: string | null;
  aliases: string[];
  defaultLoadMode: LoadMode;
  defaultUnilateral: boolean;
  equipment: string;
  id: string;
  muscleGroups: string[];
  name: string;
  source: CatalogSource;
  sourceRevision: string | null;
  suggestsExplosive: boolean;
  upstreamId: string | null;
};

/** Load and reps copied onto each set that still follows the repeat fields. */
export type RepeatTarget = {
  assistanceKg: number | null;
  loadKg: number | null;
  reps: number;
  restSeconds: number | null;
  rpe: number | null;
};

export type SetDraft = RepeatTarget & {
  followsRepeat: boolean;
  id: string;
  skipped: boolean;
  warmup: boolean;
};

export type ExerciseDraft = {
  catalogExerciseId: string | null;
  equipment: string;
  explosiveIntent: boolean;
  id: string;
  loadMode: LoadMode;
  muscleGroups: string[];
  name: string;
  notes: string;
  repeat: RepeatTarget;
  sets: SetDraft[];
  unilateral: boolean;
};

export type StrengthDraft = {
  endedAt: number;
  exercises: ExerciseDraft[];
  saveAsTemplate: boolean;
  sessionId: string;
  sourceTemplateId: string | null;
  title: string;
};

export type StrengthExerciseRecord = {
  catalogExerciseId: string | null;
  equipment: string;
  explosiveIntent: boolean;
  id: string;
  loadMode: LoadMode;
  muscleGroups: string[];
  name: string;
  notes: string;
  position: number;
  sets: StrengthSetRecord[];
  unilateral: boolean;
};

export type StrengthSetRecord = {
  assistanceKg: number | null;
  id: string;
  loadKg: number | null;
  position: number;
  reps: number;
  restSeconds: number | null;
  rpe: number | null;
  skipped: boolean;
  warmup: boolean;
};

export type StrengthTemplateRecord = {
  archivedAt: number | null;
  exercises: StrengthExerciseRecord[];
  id: string;
  title: string;
  updatedAt: number;
};
