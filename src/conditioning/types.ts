export const MAX_WORK_OCCURRENCES = 2000;
export const MAX_TITLE_LENGTH = 80;
export const MAX_NOTES_LENGTH = 1000;
export const SNAPSHOT_VERSION = 1;
export const PLANNER_VERSION = "phases-v1";

export const sessionStatuses = [
  "planned",
  "in_progress",
  "finished_draft",
  "completed",
  "ended_early",
  "cancelled",
] as const;

export const syncStatuses = [
  "local_only",
  "pending",
  "uploading",
  "synced",
  "failed",
] as const;

export const structuredFormats = ["time_interval", "sprint", "circuit"] as const;

export const conditioningFormats = [...structuredFormats, "free"] as const;

export const freeActivities = ["run", "bike"] as const;

export const stationCompletionTypes = [
  "time",
  "repetitions",
  "distance",
  "machine_calories",
  "manual",
] as const;

export const phaseTypes = [
  "preparation",
  "work",
  "ordinary_rest",
  "round_recovery",
  "set_recovery",
] as const;

export const phaseCompletions = ["timer", "manual", "gps_distance"] as const;

export const occurrenceStatuses = ["pending", "completed", "partial"] as const;

export type SessionStatus = (typeof sessionStatuses)[number];
export type SyncStatus = (typeof syncStatuses)[number];
export type StructuredFormat = (typeof structuredFormats)[number];
export type ConditioningFormat = (typeof conditioningFormats)[number];
export type FreeActivity = (typeof freeActivities)[number];
export type StationCompletionType = (typeof stationCompletionTypes)[number];
export type PhaseType = (typeof phaseTypes)[number];
export type PhaseCompletion = (typeof phaseCompletions)[number];
export type OccurrenceStatus = (typeof occurrenceStatuses)[number];
export type SessionSource = "live" | "manual";
export type SprintCompletionMode = "manual" | "gps_distance";

export type IntervalConfig = {
  betweenRoundRestSeconds: number;
  intervalsPerRound: number;
  restSeconds: number;
  rounds: number;
  targetWorkRpe: number;
  workSeconds: number;
};

export type SprintConfig = {
  betweenSetRestSeconds: number;
  completionMode: SprintCompletionMode;
  distanceMeters: number;
  restSeconds: number;
  sets: number;
  sprintsPerSet: number;
  targetElevationGainMeters: number | null;
  targetWorkRpe: number | null;
};

export type StationConfig = {
  completionType: StationCompletionType;
  distanceMeters: number | null;
  exerciseName: string;
  id: string;
  instructions: string | null;
  loadKg: number | null;
  machineCalories: number | null;
  notes: string | null;
  position: number;
  recoverySeconds: number;
  targetReps: number | null;
  targetRpe: number | null;
  workSeconds: number | null;
};

export type CircuitConfig = {
  betweenRoundRestSeconds: number;
  rounds: number;
  stations: StationConfig[];
  targetRpe: number | null;
};

export type PhaseTarget = {
  completionType: StationCompletionType | "sprint" | "interval";
  distanceMeters: number | null;
  loadKg: number | null;
  machineCalories: number | null;
  reps: number | null;
  rpe: number | null;
  workSeconds: number | null;
};

export type PhaseDefinition = {
  completion: PhaseCompletion;
  durationSeconds: number;
  id: string;
  intervalIndex: number | null;
  label: string;
  occurrenceId: string | null;
  roundIndex: number | null;
  setIndex: number | null;
  stationId: string | null;
  target: PhaseTarget | null;
  type: PhaseType;
};

export type WorkoutSnapshot = {
  activityType: FreeActivity | null;
  circuit: CircuitConfig | null;
  format: ConditioningFormat;
  interval: IntervalConfig | null;
  notes: string | null;
  phases: PhaseDefinition[];
  plannerVersion: typeof PLANNER_VERSION;
  sprint: SprintConfig | null;
  targetRpe: number | null;
  title: string;
  version: typeof SNAPSHOT_VERSION;
};

export type TemplateConfig = {
  circuit: CircuitConfig | null;
  format: StructuredFormat;
  interval: IntervalConfig | null;
  notes: string | null;
  sprint: SprintConfig | null;
  targetRpe: number | null;
  title: string;
  version: typeof SNAPSHOT_VERSION;
};

export type OccurrenceActual = {
  distanceMeters: number | null;
  loadKg: number | null;
  machineCalories: number | null;
  reps: number | null;
};

export type OccurrenceInput = {
  actual: OccurrenceActual | null;
  completionMethod: string | null;
  completionStatus: OccurrenceStatus;
  endedAt: number | null;
  id: string;
  phaseType: PhaseType;
  position: number;
  roundIndex: number | null;
  setIndex: number | null;
  startedAt: number | null;
  stationId: string | null;
  target: PhaseTarget | null;
  workSeconds: number | null;
};

export type LocationPointInput = {
  acceptance: "accepted" | "rejected";
  altitude: number | null;
  altitudeAccuracy: number | null;
  distanceDeltaMeters: number;
  horizontalAccuracy: number | null;
  latitude: number;
  longitude: number;
  recordedAt: number;
  rejectionReason: string | null;
  segmentId: string | null;
  sequence: number;
};

export type SplitInput = {
  activeSeconds: number;
  complete: boolean;
  distanceMeters: number;
  ordinal: number;
  partial: boolean;
  unitSystem: "kilometer" | "mile";
};

export type SegmentInput = {
  breakReason: string | null;
  endedAt: number | null;
  id: string;
  sequence: number;
  startedAt: number;
};
