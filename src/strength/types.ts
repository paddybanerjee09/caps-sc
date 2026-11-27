export type LoadMode = "external" | "bodyweight" | "assisted";

export type CatalogSource = "free_exercise_db" | "custom";

export const STRENGTH_REP_RANGES = [
  "1RM", "1-3", "3-5", "6-8", "8-12", "12-15", "15-20", "20+",
] as const;

export type StrengthRepRange = (typeof STRENGTH_REP_RANGES)[number];
export type StrengthSessionMode = "planned" | "completed";

export type StrengthExerciseTarget = {
  sets: number;
  repRange: StrengthRepRange;
  rpe: number | null;
  /** 10 represents 10 or more reps in reserve. */
  rir: number | null;
  restSeconds: number | null;
};

export type CatalogExercise = {
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
  rir?: number | null;
  rpe: number | null;
};

export type SetDraft = RepeatTarget & {
  actual?: { reps: string; rpe: string; rir: string };
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
  restSecondsInput?: string;
  sets: SetDraft[];
  target?: StrengthExerciseTarget;
  unilateral: boolean;
};

export type StrengthDraft = {
  endedAt: number;
  exercises: ExerciseDraft[];
  saveAsTemplate: boolean;
  scheduledStartAt?: number;
  sessionId: string;
  sessionMode?: StrengthSessionMode;
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
  target?: StrengthExerciseTarget & Pick<RepeatTarget, "loadKg" | "assistanceKg">;
  unilateral: boolean;
};

export type StrengthSetRecord = {
  assistanceKg: number | null;
  id: string;
  loadKg: number | null;
  position: number;
  reps: number;
  restSeconds: number | null;
  rir?: number | null;
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
