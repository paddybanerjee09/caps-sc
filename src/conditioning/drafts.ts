import { createId } from "./ids";
import type {
  CircuitConfig,
  IntervalConfig,
  SprintConfig,
  StationCompletionType,
  StationConfig,
  StructuredFormat,
  TemplateConfig,
} from "./types";
import { SNAPSHOT_VERSION } from "./types";

export type WorkoutDraft = {
  betweenRoundRestSeconds: string;
  betweenSetRestSeconds: string;
  circuitRounds: string;
  circuitTargetRpe: string;
  completionMode: SprintConfig["completionMode"];
  distanceMeters: number | null;
  elevationMeters: number | null;
  format: StructuredFormat;
  intervalsPerRound: string;
  notes: string;
  restSeconds: string;
  rounds: string;
  scheduledDate: string;
  scheduledTime: Date | null;
  sets: string;
  sprintRestSeconds: string;
  sprintTargetRpe: string;
  sprintsPerSet: string;
  stations: StationConfig[];
  targetWorkRpe: string;
  title: string;
  workSeconds: string;
};

export function createWorkoutDraft(
  format: StructuredFormat,
  scheduledDate: string,
): WorkoutDraft {
  return {
    betweenRoundRestSeconds: format === "time_interval" ? "60" : "0",
    betweenSetRestSeconds: "0",
    circuitRounds: "3",
    circuitTargetRpe: "",
    completionMode: "manual",
    distanceMeters: null,
    elevationMeters: null,
    format,
    intervalsPerRound: "4",
    notes: "",
    restSeconds: format === "time_interval" ? "15" : "0",
    rounds: "3",
    scheduledDate,
    scheduledTime: null,
    sets: "4",
    sprintRestSeconds: "60",
    sprintTargetRpe: "",
    sprintsPerSet: "4",
    stations: [],
    targetWorkRpe: "",
    title: "",
    workSeconds: "30",
  };
}

export function draftFromTemplate(
  config: TemplateConfig,
  scheduledDate: string,
  scheduledTime: Date | null = null,
): WorkoutDraft {
  const draft = createWorkoutDraft(config.format, scheduledDate);
  draft.title = config.title;
  draft.notes = config.notes ?? "";
  draft.scheduledTime = scheduledTime;

  if (config.interval) {
    draft.workSeconds = String(config.interval.workSeconds);
    draft.restSeconds = String(config.interval.restSeconds);
    draft.intervalsPerRound = String(config.interval.intervalsPerRound);
    draft.rounds = String(config.interval.rounds);
    draft.betweenRoundRestSeconds = String(config.interval.betweenRoundRestSeconds);
    draft.targetWorkRpe = String(config.interval.targetWorkRpe);
  }

  if (config.sprint) {
    draft.distanceMeters = config.sprint.distanceMeters;
    draft.sprintsPerSet = String(config.sprint.sprintsPerSet);
    draft.sets = String(config.sprint.sets);
    draft.sprintRestSeconds = String(config.sprint.restSeconds);
    draft.betweenSetRestSeconds = String(config.sprint.betweenSetRestSeconds);
    draft.sprintTargetRpe =
      config.sprint.targetWorkRpe === null ? "" : String(config.sprint.targetWorkRpe);
    draft.elevationMeters = config.sprint.targetElevationGainMeters;
    draft.completionMode = config.sprint.completionMode;
  }

  if (config.circuit) {
    draft.stations = config.circuit.stations.map((station) => ({ ...station }));
    draft.circuitRounds = String(config.circuit.rounds);
    draft.betweenRoundRestSeconds = String(config.circuit.betweenRoundRestSeconds);
    draft.circuitTargetRpe =
      config.circuit.targetRpe === null ? "" : String(config.circuit.targetRpe);
  }

  return draft;
}

export function templateConfigFromDraft(draft: WorkoutDraft): TemplateConfig {
  const notes = draft.notes.trim() ? draft.notes.trim() : null;
  const title = draft.title;
  if (draft.format === "time_interval") {
    const interval: IntervalConfig = {
      betweenRoundRestSeconds: Number(draft.betweenRoundRestSeconds),
      intervalsPerRound: Number(draft.intervalsPerRound),
      restSeconds: Number(draft.restSeconds),
      rounds: Number(draft.rounds),
      targetWorkRpe: Number(draft.targetWorkRpe),
      workSeconds: Number(draft.workSeconds),
    };
    return {
      circuit: null,
      format: draft.format,
      interval,
      notes,
      sprint: null,
      targetRpe: interval.targetWorkRpe,
      title,
      version: SNAPSHOT_VERSION,
    };
  }

  if (draft.format === "sprint") {
    const sprint: SprintConfig = {
      betweenSetRestSeconds: Number(draft.betweenSetRestSeconds),
      completionMode: draft.completionMode,
      distanceMeters: draft.distanceMeters ?? Number.NaN,
      restSeconds: Number(draft.sprintRestSeconds),
      sets: Number(draft.sets),
      sprintsPerSet: Number(draft.sprintsPerSet),
      targetElevationGainMeters: draft.elevationMeters,
      targetWorkRpe: draft.sprintTargetRpe.trim()
        ? Number(draft.sprintTargetRpe)
        : null,
    };
    return {
      circuit: null,
      format: draft.format,
      interval: null,
      notes,
      sprint,
      targetRpe: sprint.targetWorkRpe,
      title,
      version: SNAPSHOT_VERSION,
    };
  }

  const circuit: CircuitConfig = {
    betweenRoundRestSeconds: Number(draft.betweenRoundRestSeconds),
    rounds: Number(draft.circuitRounds),
    stations: draft.stations.map((station, position) => ({ ...station, position })),
    targetRpe: draft.circuitTargetRpe.trim() ? Number(draft.circuitTargetRpe) : null,
  };
  return {
    circuit,
    format: "circuit",
    interval: null,
    notes,
    sprint: null,
    targetRpe: circuit.targetRpe,
    title,
    version: SNAPSHOT_VERSION,
  };
}

export function createStation(position: number): StationConfig {
  return {
    completionType: "repetitions",
    distanceMeters: null,
    exerciseName: "",
    id: createId(),
    instructions: null,
    loadKg: null,
    machineCalories: null,
    notes: null,
    position,
    recoverySeconds: 0,
    targetReps: null,
    targetRpe: null,
    workSeconds: null,
  };
}

export function emptyStationTarget(type: StationCompletionType): Pick<
  StationConfig,
  | "completionType"
  | "distanceMeters"
  | "instructions"
  | "loadKg"
  | "machineCalories"
  | "targetReps"
  | "workSeconds"
> {
  return {
    completionType: type,
    distanceMeters: null,
    instructions: null,
    loadKg: null,
    machineCalories: null,
    targetReps: null,
    workSeconds: null,
  };
}
