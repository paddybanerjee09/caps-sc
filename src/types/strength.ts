export type MovementProfile = "explosive" | "non_explosive" | "unknown";
export type MovementProfileSource = "curated-id" | "name-rule" | "unknown";
export type StrengthAdaptation = "hypertrophy" | "power" | "endurance";
export type StrengthScores = Record<StrengthAdaptation, number>;

// Provider records are ephemeral. Never pass this object to SQLite.
export type ExerciseDbExercise = {
  exerciseId: string;
  name: string;
  gifUrl: string | null;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  equipments: string[];
  instructions: string[];
  exerciseTypes?: string[];
};

export type StrengthExercise = {
  exerciseId: string;
  name: string; // User-confirmed minimal workout label, not a metadata cache.
  labelConfirmed: boolean;
  movementProfile: MovementProfile;
  movementProfileSource: MovementProfileSource;
  externalLoadKg: number;
  sets: number;
  reps: number;
  rpe: number;
  percent1RM: number | null;
  notes: string | null;
};
export type StrengthSessionDraft = { title: string; exercises: StrengthExercise[] };
export type StoredStrengthTemplate = StrengthSessionDraft & { id: number; createdAt: number; updatedAt: number };
export type StrengthExerciseScore = {
  scores: StrengthScores;
  hardSets: number;
  totalRepetitions: number;
  volumeLoadKg: number;
  percent1RMUsed: number | null;
  estimated1RM: number | null;
  intensitySource: "entered" | "estimated" | "unavailable";
  evidence: "full" | "limited";
  modelVersion: string;
};
export type StrengthScoreResult =
  | { status: "insufficient"; reasons: string[] }
  | { status: "scored"; scores: StrengthScores; primaryAdaptation: StrengthAdaptation;
      evidence: "full" | "limited"; missingInputs: string[]; modelVersion: string;
      exercises: StrengthExerciseScore[] };
export type StrengthCalendarRecord = {
  timelineEntryId: number; title: string; startAt: number;
  primaryAdaptation: StrengthAdaptation; evidence: "full" | "limited";
};
export type StoredStrengthSession = StrengthSessionDraft & StrengthCalendarRecord & {
  sourceTemplateId: number | null;
  score: Extract<StrengthScoreResult, { status: "scored" }>;
};
