import {
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_WORK_OCCURRENCES,
  type CircuitConfig,
  type ConditioningFormat,
  type IntervalConfig,
  type OccurrenceActual,
  type SprintConfig,
  type StationCompletionType,
  type StationConfig,
  type TemplateConfig,
  type WorkoutSnapshot,
} from "./types";

export type FieldError = {
  field: string;
  message: string;
};

export class ConditioningValidationError extends Error {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(errors.map((error) => error.message).join("\n"));
    this.name = "ConditioningValidationError";
    this.errors = errors;
  }
}

export function throwIfInvalid(errors: FieldError[]) {
  if (errors.length > 0) {
    throw new ConditioningValidationError(errors);
  }
}

export function validateTitle(title: string) {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_TITLE_LENGTH) {
    return [
      {
        field: "title",
        message: `Title must be 1–${MAX_TITLE_LENGTH} characters`,
      },
    ];
  }

  return [];
}

export function validateNotes(notes: string | null) {
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
    return [
      {
        field: "notes",
        message: `Notes must be at most ${MAX_NOTES_LENGTH} characters`,
      },
    ];
  }

  return [];
}

export function validateOptionalRpe(value: number | null, field: string) {
  if (value === null) {
    return [];
  }

  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return [{ field, message: "RPE must be a whole number from 1 to 10" }];
  }

  return [];
}

export function validateIntervalConfig(config: IntervalConfig) {
  const errors: FieldError[] = [];
  errors.push(
    ...requirePositiveInteger(config.workSeconds, "workSeconds", "Work duration"),
    ...requireNonnegativeInteger(config.restSeconds, "restSeconds", "Rest"),
    ...requirePositiveInteger(
      config.intervalsPerRound,
      "intervalsPerRound",
      "Intervals per round",
    ),
    ...requirePositiveInteger(config.rounds, "rounds", "Rounds"),
    ...requireNonnegativeInteger(
      config.betweenRoundRestSeconds,
      "betweenRoundRestSeconds",
      "Rest between rounds",
    ),
    ...validateOptionalRpe(config.targetWorkRpe, "targetWorkRpe"),
  );

  if (config.targetWorkRpe === null) {
    errors.push({
      field: "targetWorkRpe",
      message: "Time interval workouts require a target work RPE",
    });
  }

  const occurrences = config.rounds * config.intervalsPerRound;
  if (
    Number.isInteger(occurrences) &&
    occurrences > MAX_WORK_OCCURRENCES
  ) {
    errors.push(expansionError());
  }

  return errors;
}

export function validateSprintConfig(config: SprintConfig) {
  const errors: FieldError[] = [
    ...requirePositiveFinite(config.distanceMeters, "distanceMeters", "Distance"),
    ...requirePositiveInteger(config.sprintsPerSet, "sprintsPerSet", "Sprints per set"),
    ...requirePositiveInteger(config.sets, "sets", "Sets"),
    ...requireNonnegativeInteger(config.restSeconds, "restSeconds", "Rest between sprints"),
    ...requireNonnegativeInteger(
      config.betweenSetRestSeconds,
      "betweenSetRestSeconds",
      "Rest between sets",
    ),
    ...validateOptionalRpe(config.targetWorkRpe, "targetWorkRpe"),
  ];

  if (
    config.completionMode !== "manual" &&
    config.completionMode !== "gps_distance"
  ) {
    errors.push({
      field: "completionMode",
      message: "Choose manual or GPS completion",
    });
  }

  if (config.targetElevationGainMeters !== null) {
    errors.push(
      ...requirePositiveFinite(
        config.targetElevationGainMeters,
        "targetElevationGainMeters",
        "Target elevation gain",
      ),
    );
  }

  const occurrences = config.sets * config.sprintsPerSet;
  if (Number.isInteger(occurrences) && occurrences > MAX_WORK_OCCURRENCES) {
    errors.push(expansionError());
  }

  return errors;
}

export function validateStation(station: StationConfig) {
  const errors: FieldError[] = [
    ...validateTitle(station.exerciseName).map((error) => ({
      ...error,
      field: "exerciseName",
      message: error.field === "title" ? "Exercise name must be 1–80 characters" : error.message,
    })),
    ...requireNonnegativeInteger(
      station.recoverySeconds,
      "recoverySeconds",
      "Recovery",
    ),
    ...validateOptionalRpe(station.targetRpe, "targetRpe"),
    ...validateNotes(station.notes),
  ];

  if (station.exerciseName.trim().length > MAX_TITLE_LENGTH) {
    errors.push({
      field: "exerciseName",
      message: "Exercise name must be 1–80 characters",
    });
  }

  errors.push(...targetsForCompletion(station));
  return errors;
}

export function validateCircuitConfig(config: CircuitConfig) {
  const errors: FieldError[] = [
    ...requirePositiveInteger(config.rounds, "rounds", "Rounds"),
    ...requireNonnegativeInteger(
      config.betweenRoundRestSeconds,
      "betweenRoundRestSeconds",
      "Rest between rounds",
    ),
    ...validateOptionalRpe(config.targetRpe, "targetRpe"),
  ];

  if (config.stations.length < 1) {
    errors.push({ field: "stations", message: "Add at least one station" });
  }

  config.stations.forEach((station, index) => {
    for (const error of validateStation(station)) {
      errors.push({
        ...error,
        field: `stations.${index}.${error.field}`,
      });
    }
  });

  const occurrences = config.rounds * config.stations.length;
  if (Number.isInteger(occurrences) && occurrences > MAX_WORK_OCCURRENCES) {
    errors.push(expansionError());
  }

  return errors;
}

export function validateTemplateConfig(config: TemplateConfig) {
  const errors = [
    ...validateTitle(config.title),
    ...validateNotes(config.notes),
    ...validateOptionalRpe(config.targetRpe, "targetRpe"),
  ];

  if (config.format === "time_interval") {
    errors.push(
      ...(config.interval
        ? validateIntervalConfig(config.interval)
        : [{ field: "interval", message: "Interval setup is missing" }]),
    );
  } else if (config.format === "sprint") {
    errors.push(
      ...(config.sprint
        ? validateSprintConfig(config.sprint)
        : [{ field: "sprint", message: "Sprint setup is missing" }]),
    );
  } else if (config.format === "circuit") {
    errors.push(
      ...(config.circuit
        ? validateCircuitConfig(config.circuit)
        : [{ field: "circuit", message: "Circuit setup is missing" }]),
    );
  } else {
    errors.push({ field: "format", message: "Choose a workout format" });
  }

  return errors;
}

export function validateSnapshot(snapshot: WorkoutSnapshot) {
  const errors: FieldError[] = [
    ...validateTitle(snapshot.title),
    ...validateNotes(snapshot.notes),
    ...validateOptionalRpe(snapshot.targetRpe, "targetRpe"),
  ];

  if (snapshot.version !== 1 || snapshot.plannerVersion !== "phases-v1") {
    errors.push({ field: "snapshot", message: "Unsupported workout snapshot" });
  }

  if (snapshot.format === "free") {
    if (snapshot.activityType !== "run" && snapshot.activityType !== "bike") {
      errors.push({ field: "activityType", message: "Choose run or bike" });
    }

    if (snapshot.phases.length > 0) {
      errors.push({
        field: "phases",
        message: "Free sessions do not have prescribed phases",
      });
    }

    return errors;
  }

  if (snapshot.activityType !== null) {
    errors.push({
      field: "activityType",
      message: "Structured workouts do not use a free-session activity",
    });
  }

  const configErrors = validateTemplateConfig({
    circuit: snapshot.circuit,
    format: snapshot.format,
    interval: snapshot.interval,
    notes: snapshot.notes,
    sprint: snapshot.sprint,
    targetRpe: snapshot.targetRpe,
    title: snapshot.title,
    version: 1,
  });
  errors.push(...configErrors);

  const workPhases = snapshot.phases.filter((phase) => phase.type === "work");
  if (workPhases.length > MAX_WORK_OCCURRENCES) {
    errors.push(expansionError());
  }

  if (snapshot.phases.length > 0 && snapshot.phases.at(-1)?.type !== "work") {
    errors.push({
      field: "phases",
      message: "A workout cannot end with recovery",
    });
  }

  if (snapshot.phases.some((phase) => phase.type === "preparation")) {
    errors.push({
      field: "phases",
      message: "Preparation is not part of the stored workout",
    });
  }

  return errors;
}

export function validateActual(actual: OccurrenceActual | null) {
  if (actual === null) {
    return [];
  }

  const errors: FieldError[] = [];

  if (actual.reps !== null) {
    errors.push(...requirePositiveInteger(actual.reps, "reps", "Actual reps"));
  }

  if (actual.loadKg !== null) {
    errors.push(...requireNonnegativeFinite(actual.loadKg, "loadKg", "Actual load"));
  }

  if (actual.distanceMeters !== null) {
    errors.push(
      ...requirePositiveFinite(actual.distanceMeters, "distanceMeters", "Actual distance"),
    );
  }

  if (actual.machineCalories !== null) {
    errors.push(
      ...requirePositiveFinite(
        actual.machineCalories,
        "machineCalories",
        "Actual machine calories",
      ),
    );
  }

  return errors;
}

export function incompatibleStationFields(
  station: StationConfig,
  nextType: StationCompletionType,
) {
  const discarded: string[] = [];

  for (const field of numericFields) {
    if (station[field] === null || compatibleFields[nextType].has(field)) {
      continue;
    }

    discarded.push(field);
  }

  if (
    station.instructions &&
    station.instructions.trim() &&
    nextType !== "manual"
  ) {
    discarded.push("instructions");
  }

  return discarded;
}

export function applyStationCompletionType(
  station: StationConfig,
  nextType: StationCompletionType,
) {
  const next: StationConfig = {
    ...station,
    completionType: nextType,
    distanceMeters: null,
    instructions: nextType === "manual" ? station.instructions : null,
    loadKg: null,
    machineCalories: null,
    targetReps: null,
    workSeconds: null,
  };

  for (const field of compatibleFields[nextType]) {
    next[field] = station[field];
  }

  return next;
}

export function moveStation(
  stations: StationConfig[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= stations.length) {
    return stations;
  }

  const reordered = stations.slice();
  const [station] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, station);
  return reordered.map((item, position) => ({ ...item, position }));
}

export function effectiveStationRpe(
  station: StationConfig,
  circuitTargetRpe: number | null,
) {
  return station.targetRpe ?? circuitTargetRpe;
}

export function expectedWorkCount(format: ConditioningFormat, snapshot: {
  circuit: CircuitConfig | null;
  interval: IntervalConfig | null;
  sprint: SprintConfig | null;
}) {
  if (format === "time_interval" && snapshot.interval) {
    return snapshot.interval.rounds * snapshot.interval.intervalsPerRound;
  }

  if (format === "sprint" && snapshot.sprint) {
    return snapshot.sprint.sets * snapshot.sprint.sprintsPerSet;
  }

  if (format === "circuit" && snapshot.circuit) {
    return snapshot.circuit.rounds * snapshot.circuit.stations.length;
  }

  return 0;
}

const numericFields = [
  "workSeconds",
  "targetReps",
  "loadKg",
  "distanceMeters",
  "machineCalories",
] as const;

const compatibleFields: Record<
  StationCompletionType,
  Set<(typeof numericFields)[number]>
> = {
  time: new Set(["workSeconds"]),
  repetitions: new Set(["targetReps", "loadKg"]),
  distance: new Set(["distanceMeters", "loadKg"]),
  machine_calories: new Set(["machineCalories"]),
  manual: new Set(),
};

function targetsForCompletion(station: StationConfig) {
  switch (station.completionType) {
    case "time":
      return requirePositiveInteger(station.workSeconds, "workSeconds", "Work duration");
    case "repetitions":
      return [
        ...requirePositiveInteger(station.targetReps, "targetReps", "Target reps"),
        ...(station.loadKg === null
          ? []
          : requireNonnegativeFinite(station.loadKg, "loadKg", "Load")),
      ];
    case "distance":
      return [
        ...requirePositiveFinite(station.distanceMeters, "distanceMeters", "Distance"),
        ...(station.loadKg === null
          ? []
          : requireNonnegativeFinite(station.loadKg, "loadKg", "Load")),
      ];
    case "machine_calories":
      return requirePositiveFinite(
        station.machineCalories,
        "machineCalories",
        "Machine calories",
      );
    case "manual":
      return [];
    default:
      return [{ field: "completionType", message: "Choose how this station ends" }];
  }
}

function requirePositiveInteger(
  value: number | null,
  field: string,
  label: string,
) {
  if (value === null || !Number.isInteger(value) || value <= 0) {
    return [{ field, message: `${label} must be a positive whole number` }];
  }

  return [];
}

function requireNonnegativeInteger(value: number | null, field: string, label: string) {
  if (value === null || !Number.isInteger(value) || value < 0) {
    return [{ field, message: `${label} must be a whole number of zero or more` }];
  }

  return [];
}

function requirePositiveFinite(value: number | null, field: string, label: string) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return [{ field, message: `${label} must be greater than zero` }];
  }

  return [];
}

function requireNonnegativeFinite(value: number | null, field: string, label: string) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return [{ field, message: `${label} cannot be negative` }];
  }

  return [];
}

function expansionError() {
  return {
    field: "occurrences",
    message: `A workout can include at most ${MAX_WORK_OCCURRENCES} work occurrences`,
  };
}
