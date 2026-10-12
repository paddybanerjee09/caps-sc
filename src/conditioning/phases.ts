import { createId } from "./ids";
import {
  PLANNER_VERSION,
  SNAPSHOT_VERSION,
  type CircuitConfig,
  type FreeActivity,
  type IntervalConfig,
  type PhaseDefinition,
  type PhaseTarget,
  type SprintConfig,
  type StationConfig,
  type TemplateConfig,
  type WorkoutSnapshot,
} from "./types";
import { throwIfInvalid, validateSnapshot, validateTemplateConfig } from "./validation";

export const PREPARATION_SECONDS = 5;

export function intervalDurations(config: IntervalConfig) {
  const workSeconds = config.rounds * config.intervalsPerRound * config.workSeconds;
  const ordinaryRecoverySeconds =
    config.rounds * (config.intervalsPerRound - 1) * config.restSeconds;
  const betweenRoundRecoverySeconds =
    (config.rounds - 1) * config.betweenRoundRestSeconds;

  return {
    betweenRoundRecoverySeconds,
    ordinaryRecoverySeconds,
    preparationSeconds: PREPARATION_SECONDS,
    workSeconds,
    workoutSeconds:
      workSeconds + ordinaryRecoverySeconds + betweenRoundRecoverySeconds,
  };
}

export function sprintRecoveryDurations(config: SprintConfig) {
  const ordinaryRecoverySeconds =
    config.sets * (config.sprintsPerSet - 1) * config.restSeconds;
  const betweenSetRecoverySeconds = (config.sets - 1) * config.betweenSetRestSeconds;

  return {
    betweenSetRecoverySeconds,
    ordinaryRecoverySeconds,
    prescribedRecoverySeconds: ordinaryRecoverySeconds + betweenSetRecoverySeconds,
  };
}

export function circuitTiming(config: CircuitConfig) {
  let knownWorkSeconds = 0;
  let stationRecoverySeconds = 0;
  let fullyKnown = true;

  for (const station of config.stations) {
    if (station.completionType === "time" && station.workSeconds) {
      knownWorkSeconds += station.workSeconds * config.rounds;
    } else {
      fullyKnown = false;
    }

    stationRecoverySeconds += station.recoverySeconds;
  }

  const ordinaryRecoverySeconds =
    config.rounds *
    config.stations.slice(0, -1).reduce((total, station) => total + station.recoverySeconds, 0);
  const betweenRoundRecoverySeconds =
    (config.rounds - 1) * config.betweenRoundRestSeconds;

  return {
    betweenRoundRecoverySeconds,
    fullyKnown,
    knownRecoverySeconds: ordinaryRecoverySeconds + betweenRoundRecoverySeconds,
    knownWorkSeconds,
    stationRecoverySeconds,
  };
}

export function buildIntervalPhases(
  config: IntervalConfig,
  nextId: () => string,
) {
  const phases: PhaseDefinition[] = [];

  for (let round = 1; round <= config.rounds; round += 1) {
    for (let interval = 1; interval <= config.intervalsPerRound; interval += 1) {
      phases.push(
        workPhase({
          completion: "timer",
          durationSeconds: config.workSeconds,
          intervalIndex: interval,
          label: `Round ${round}, interval ${interval}`,
          nextId,
          roundIndex: round,
          setIndex: null,
          stationId: null,
          target: {
            completionType: "interval",
            distanceMeters: null,
            loadKg: null,
            machineCalories: null,
            reps: null,
            rpe: config.targetWorkRpe,
            workSeconds: config.workSeconds,
          },
        }),
      );

      const lastInterval = interval === config.intervalsPerRound;
      const lastRound = round === config.rounds;

      if (!lastInterval && config.restSeconds > 0) {
        phases.push(
          recoveryPhase(
            "ordinary_rest",
            config.restSeconds,
            `Rest after interval ${interval}`,
            nextId,
            round,
          ),
        );
      } else if (lastInterval && !lastRound && config.betweenRoundRestSeconds > 0) {
        phases.push(
          recoveryPhase(
            "round_recovery",
            config.betweenRoundRestSeconds,
            `Rest after round ${round}`,
            nextId,
            round,
          ),
        );
      }
    }
  }

  return phases;
}

export function buildSprintPhases(config: SprintConfig, nextId: () => string) {
  const phases: PhaseDefinition[] = [];

  for (let set = 1; set <= config.sets; set += 1) {
    for (let sprint = 1; sprint <= config.sprintsPerSet; sprint += 1) {
      phases.push(
        workPhase({
          completion: config.completionMode === "gps_distance" ? "gps_distance" : "manual",
          durationSeconds: 0,
          intervalIndex: sprint,
          label: `Set ${set}, sprint ${sprint}`,
          nextId,
          roundIndex: null,
          setIndex: set,
          stationId: null,
          target: {
            completionType: "sprint",
            distanceMeters: config.distanceMeters,
            loadKg: null,
            machineCalories: null,
            reps: null,
            rpe: config.targetWorkRpe,
            workSeconds: null,
          },
        }),
      );

      const lastSprint = sprint === config.sprintsPerSet;
      const lastSet = set === config.sets;

      if (!lastSprint && config.restSeconds > 0) {
        phases.push(
          recoveryPhase(
            "ordinary_rest",
            config.restSeconds,
            `Rest after sprint ${sprint}`,
            nextId,
            null,
            set,
          ),
        );
      } else if (lastSprint && !lastSet && config.betweenSetRestSeconds > 0) {
        phases.push(
          recoveryPhase(
            "set_recovery",
            config.betweenSetRestSeconds,
            `Rest after set ${set}`,
            nextId,
            null,
            set,
          ),
        );
      }
    }
  }

  return phases;
}

export function buildCircuitPhases(config: CircuitConfig, nextId: () => string) {
  const phases: PhaseDefinition[] = [];

  for (let round = 1; round <= config.rounds; round += 1) {
    config.stations.forEach((station, index) => {
      const inheritedRpe = station.targetRpe ?? config.targetRpe;
      phases.push(
        workPhase({
          completion: station.completionType === "time" ? "timer" : "manual",
          durationSeconds:
            station.completionType === "time" ? station.workSeconds ?? 0 : 0,
          intervalIndex: index + 1,
          label: station.exerciseName.trim(),
          nextId,
          roundIndex: round,
          setIndex: null,
          stationId: station.id,
          target: stationTarget(station, inheritedRpe),
        }),
      );

      const lastStation = index === config.stations.length - 1;
      const lastRound = round === config.rounds;

      if (!lastStation && station.recoverySeconds > 0) {
        phases.push(
          recoveryPhase(
            "ordinary_rest",
            station.recoverySeconds,
            `Rest after ${station.exerciseName.trim()}`,
            nextId,
            round,
          ),
        );
      } else if (lastStation && !lastRound && config.betweenRoundRestSeconds > 0) {
        phases.push(
          recoveryPhase(
            "round_recovery",
            config.betweenRoundRestSeconds,
            `Rest after round ${round}`,
            nextId,
            round,
          ),
        );
      }
    });
  }

  return phases;
}

export function buildWorkoutSnapshot(
  config: TemplateConfig & { activityType?: FreeActivity | null },
  nextId: () => string = createId,
): WorkoutSnapshot {
  throwIfInvalid(validateTemplateConfig(config));
  const targetRpe =
    config.format === "time_interval"
      ? (config.interval?.targetWorkRpe ?? null)
      : config.format === "sprint"
        ? (config.sprint?.targetWorkRpe ?? null)
        : config.format === "circuit"
          ? (config.circuit?.targetRpe ?? null)
          : config.targetRpe;
  const phases =
    config.format === "time_interval" && config.interval
      ? buildIntervalPhases(config.interval, nextId)
      : config.format === "sprint" && config.sprint
        ? buildSprintPhases(config.sprint, nextId)
        : config.format === "circuit" && config.circuit
          ? buildCircuitPhases(config.circuit, nextId)
          : [];

  const snapshot: WorkoutSnapshot = {
    activityType: null,
    circuit: config.circuit,
    format: config.format,
    interval: config.interval,
    notes: normalizeNotes(config.notes),
    phases,
    plannerVersion: PLANNER_VERSION,
    sprint: config.sprint,
    targetRpe,
    title: config.title.trim(),
    version: SNAPSHOT_VERSION,
  };
  throwIfInvalid(validateSnapshot(snapshot));
  return snapshot;
}

export function buildFreeSnapshot(
  activity: FreeActivity,
  notes: string | null = null,
): WorkoutSnapshot {
  const snapshot: WorkoutSnapshot = {
    activityType: activity,
    circuit: null,
    format: "free",
    interval: null,
    notes: normalizeNotes(notes),
    phases: [],
    plannerVersion: PLANNER_VERSION,
    sprint: null,
    targetRpe: null,
    title: activity === "run" ? "Run" : "Bike",
    version: SNAPSHOT_VERSION,
  };
  throwIfInvalid(validateSnapshot(snapshot));
  return snapshot;
}

export function sumPhaseSeconds(phases: PhaseDefinition[]) {
  return phases.reduce(
    (totals, phase) => {
      if (phase.type === "work") {
        totals.workSeconds += phase.durationSeconds;
      } else if (phase.type === "ordinary_rest") {
        totals.ordinaryRecoverySeconds += phase.durationSeconds;
      } else if (phase.type === "round_recovery") {
        totals.betweenRoundRecoverySeconds += phase.durationSeconds;
      } else if (phase.type === "set_recovery") {
        totals.betweenSetRecoverySeconds += phase.durationSeconds;
      }

      return totals;
    },
    {
      betweenRoundRecoverySeconds: 0,
      betweenSetRecoverySeconds: 0,
      ordinaryRecoverySeconds: 0,
      workSeconds: 0,
    },
  );
}

function workPhase(input: {
  completion: PhaseDefinition["completion"];
  durationSeconds: number;
  intervalIndex: number | null;
  label: string;
  nextId: () => string;
  roundIndex: number | null;
  setIndex: number | null;
  stationId: string | null;
  target: PhaseTarget;
}): PhaseDefinition {
  return {
    completion: input.completion,
    durationSeconds: input.durationSeconds,
    id: input.nextId(),
    intervalIndex: input.intervalIndex,
    label: input.label,
    occurrenceId: input.nextId(),
    roundIndex: input.roundIndex,
    setIndex: input.setIndex,
    stationId: input.stationId,
    target: input.target,
    type: "work",
  };
}

function recoveryPhase(
  type: "ordinary_rest" | "round_recovery" | "set_recovery",
  durationSeconds: number,
  label: string,
  nextId: () => string,
  roundIndex: number | null,
  setIndex: number | null = null,
): PhaseDefinition {
  return {
    completion: "timer",
    durationSeconds,
    id: nextId(),
    intervalIndex: null,
    label,
    occurrenceId: null,
    roundIndex,
    setIndex,
    stationId: null,
    target: null,
    type,
  };
}

function stationTarget(station: StationConfig, rpe: number | null): PhaseTarget {
  return {
    completionType: station.completionType,
    distanceMeters: station.distanceMeters,
    loadKg: station.loadKg,
    machineCalories: station.machineCalories,
    reps: station.targetReps,
    rpe,
    workSeconds: station.workSeconds,
  };
}

function normalizeNotes(notes: string | null) {
  if (notes === null) {
    return null;
  }

  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}
