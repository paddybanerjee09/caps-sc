import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";

import {
  conditioningAdaptationOrder,
  conditioningValidationLimits,
} from "../constants/conditioning";
import type {
  AthleteConditioningBaselines,
  CircuitStation,
  ConditioningActivity,
  ConditioningAdaptationKey,
  ConditioningAdaptationScores,
  ConditioningCalendarRecord,
  ConditioningIntensityInput,
  ConditioningProtocol,
  ConditioningProtocolMetrics,
  ConditioningProtocolType,
  ConditioningValidationIssue,
  LoggedConditioningSessionResult,
  NewConditioningLog,
  NewConditioningTemplate,
  ScoredConditioningResult,
  SnapshottedConditioningIntensity,
  StoredConditioningSession,
  StoredConditioningTemplate,
  UpdateConditioningLog,
} from "../types/conditioning";
import {
  evaluateConditioningProtocol,
  getConditioningEndAt,
} from "../utils/conditioningProtocol";
import { scoreConditioningSession } from "../utils/conditioningScoring";

type BaselineRow = {
  maximum_heart_rate_bpm: number | null;
  threshold_pace_seconds_per_km: number | null;
  maximum_aerobic_speed_kph: number | null;
};

type StoredDefinitionRow = {
  activity: string;
  protocol_type: string;
  intensity_method: string | null;
  intensity_value: number | null;
  intensity_reference: string | null;
  continuous_duration_seconds: number | null;
  continuous_distance_meters: number | null;
  interval_work_duration_seconds: number | null;
  interval_work_distance_meters: number | null;
  distance_total_duration_seconds: number | null;
  distance_work_duration_seconds: number | null;
  rest_between_repetitions_seconds: number | null;
  repetitions_per_set: number | null;
  set_count: number | null;
  rest_between_sets_seconds: number | null;
  circuit_round_count: number | null;
  circuit_rest_between_stations_seconds: number | null;
  circuit_rest_between_rounds_seconds: number | null;
};

type TemplateJoinRow = StoredDefinitionRow & {
  id: number;
  title: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
  station_position: number | null;
  station_name: string | null;
  station_work_duration_seconds: number | null;
};

type ScoreColumns = {
  aerobic_base_score: number;
  aerobic_power_score: number;
  alactic_power_score: number;
  alactic_capacity_score: number;
  lactic_power_score: number;
  lactic_capacity_score: number;
  recovery_score: number;
  primary_adaptation: string;
  evidence_level: string;
  scoring_model_version: string;
};

type CalendarRow = {
  timeline_entry_id: number;
  title: string;
  start_at: number;
  end_at: number;
  activity: string;
  protocol_type: string;
  primary_adaptation: string;
  evidence_level: string;
};

type SessionJoinRow = StoredDefinitionRow &
  ScoreColumns & {
    timeline_entry_id: number;
    source_template_id: number | null;
    title: string;
    start_at: number;
    end_at: number;
    status: string;
    notes: string | null;
    created_at: number;
    updated_at: number;
    intensity_baseline_value: number | null;
    station_position: number | null;
    station_name: string | null;
    station_work_duration_seconds: number | null;
  };

type NormalizedDefinition = {
  title: string;
  activity: ConditioningActivity;
  protocol: ConditioningProtocol;
  intensity: ConditioningIntensityInput;
  notes: string | null;
  metrics: ConditioningProtocolMetrics;
};

type StoredConditioningProtocolType =
  | "continuous"
  | "time_intervals"
  | "distance_intervals"
  | "circuit";

const ACTIVITY_VALUES = new Set<ConditioningActivity>([
  "running",
  "hill_sprints",
  "assault_bike",
  "rowing",
  "swimming",
  "circuit",
  "other",
]);

const PROTOCOL_VALUES = new Set<ConditioningProtocolType>([
  "continuous",
  "intervals",
  "circuit",
]);

const STORED_PROTOCOL_VALUES = new Set<StoredConditioningProtocolType>([
  "continuous",
  "time_intervals",
  "distance_intervals",
  "circuit",
]);

const ADAPTATION_VALUES = new Set<ConditioningAdaptationKey>(
  conditioningAdaptationOrder,
);

const DEFINITION_COLUMNS = [
  "activity",
  "protocol_type",
  "intensity_method",
  "intensity_value",
  "intensity_reference",
  "continuous_duration_seconds",
  "continuous_distance_meters",
  "interval_work_duration_seconds",
  "interval_work_distance_meters",
  "distance_total_duration_seconds",
  "distance_work_duration_seconds",
  "rest_between_repetitions_seconds",
  "repetitions_per_set",
  "set_count",
  "rest_between_sets_seconds",
  "circuit_round_count",
  "circuit_rest_between_stations_seconds",
  "circuit_rest_between_rounds_seconds",
] as const;

const DEFINITION_COLUMN_SQL = DEFINITION_COLUMNS.join(", ");
const DEFINITION_PLACEHOLDER_SQL = DEFINITION_COLUMNS.map(() => "?").join(
  ", ",
);
const DEFINITION_UPDATE_SQL = DEFINITION_COLUMNS.map(
  (column) => `${column} = ?`,
).join(", ");

export class ConditioningValidationError extends Error {
  readonly issues: ConditioningValidationIssue[];

  constructor(issues: ConditioningValidationIssue[]) {
    super(issues[0]?.message ?? "Conditioning information is invalid.");
    this.name = "ConditioningValidationError";
    this.issues = issues;
  }
}

function fail(field: string, message: string): never {
  throw new ConditioningValidationError([{ field, message }]);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function isActivity(value: unknown): value is ConditioningActivity {
  return typeof value === "string" && ACTIVITY_VALUES.has(value as ConditioningActivity);
}

function isProtocolType(value: unknown): value is ConditioningProtocolType {
  return (
    typeof value === "string" &&
    PROTOCOL_VALUES.has(value as ConditioningProtocolType)
  );
}

function isStoredProtocolType(
  value: unknown,
): value is StoredConditioningProtocolType {
  return (
    typeof value === "string" &&
    STORED_PROTOCOL_VALUES.has(value as StoredConditioningProtocolType)
  );
}

function getStoredProtocolType(
  protocol: ConditioningProtocol,
): StoredConditioningProtocolType {
  if (protocol.type !== "intervals") {
    return protocol.type;
  }

  return protocol.work.mode === "time"
    ? "time_intervals"
    : "distance_intervals";
}

function getPublicProtocolType(
  protocolType: StoredConditioningProtocolType,
): ConditioningProtocolType {
  return protocolType === "time_intervals" ||
    protocolType === "distance_intervals"
    ? "intervals"
    : protocolType;
}

function isAdaptationKey(value: unknown): value is ConditioningAdaptationKey {
  return (
    typeof value === "string" &&
    ADAPTATION_VALUES.has(value as ConditioningAdaptationKey)
  );
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") {
    return fail("title", "Title is required.");
  }

  const title = value.trim();
  if (
    title.length < 1 ||
    title.length > conditioningValidationLimits.titleLength
  ) {
    return fail(
      "title",
      `Title must be from 1 to ${conditioningValidationLimits.titleLength} characters.`,
    );
  }

  return title;
}

function normalizeNotes(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return fail("notes", "Notes are invalid.");
  }

  const notes = value.trim();
  if (notes.length === 0) {
    return null;
  }
  if (notes.length > conditioningValidationLimits.notesLength) {
    return fail(
      "notes",
      `Notes cannot be longer than ${conditioningValidationLimits.notesLength} characters.`,
    );
  }

  return notes;
}

function normalizeBaselines(
  input: AthleteConditioningBaselines,
): AthleteConditioningBaselines {
  const maximumHeartRateBpm = input.maximumHeartRateBpm;
  if (
    maximumHeartRateBpm !== null &&
    (!Number.isInteger(maximumHeartRateBpm) ||
      maximumHeartRateBpm <
        conditioningValidationLimits.maximumHeartRateBpm.minimum ||
      maximumHeartRateBpm >
        conditioningValidationLimits.maximumHeartRateBpm.maximum)
  ) {
    return fail(
      "maximumHeartRateBpm",
      "Maximum heart rate must be a whole number from 60 to 260 BPM.",
    );
  }

  const thresholdPaceSecondsPerKm = input.thresholdPaceSecondsPerKm;
  if (
    thresholdPaceSecondsPerKm !== null &&
    (!isFiniteNumber(thresholdPaceSecondsPerKm) ||
      thresholdPaceSecondsPerKm <
        conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum ||
      thresholdPaceSecondsPerKm >
        conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum)
  ) {
    return fail(
      "thresholdPaceSecondsPerKm",
      "Threshold pace must be from 30 to 3600 seconds per kilometre.",
    );
  }

  const maximumAerobicSpeedKph = input.maximumAerobicSpeedKph;
  if (
    maximumAerobicSpeedKph !== null &&
    (!isFiniteNumber(maximumAerobicSpeedKph) ||
      maximumAerobicSpeedKph <= 0 ||
      maximumAerobicSpeedKph >
        conditioningValidationLimits.maximumAerobicSpeedKph)
  ) {
    return fail(
      "maximumAerobicSpeedKph",
      "Maximum aerobic speed must be greater than 0 and no more than 60 km/h.",
    );
  }

  return {
    maximumHeartRateBpm,
    thresholdPaceSecondsPerKm,
    maximumAerobicSpeedKph,
  };
}

function normalizeProtocol(protocol: ConditioningProtocol) {
  if (!protocol || !isProtocolType(protocol.type)) {
    return fail("protocol", "Conditioning type is invalid.");
  }

  const normalizedProtocol: ConditioningProtocol =
    protocol.type === "circuit"
      ? {
          ...protocol,
          stations: Array.isArray(protocol.stations)
            ? protocol.stations.map((station, index) => ({
                name:
                  typeof station?.name === "string" ? station.name.trim() : "",
                position: index,
                workSeconds: station?.workSeconds,
              }))
            : [],
        }
      : { ...protocol };

  const result = evaluateConditioningProtocol(normalizedProtocol);
  if (!result.ok) {
    throw new ConditioningValidationError(result.issues);
  }

  return result;
}

function normalizeIntensity(
  input: ConditioningIntensityInput,
  activity: ConditioningActivity,
  baselines: AthleteConditioningBaselines,
): {
  input: ConditioningIntensityInput;
  snapshot: SnapshottedConditioningIntensity;
} {
  if (input === null) {
    return { input: null, snapshot: null };
  }

  if (input.method === "rpe") {
    if (
      !isFiniteNumber(input.value) ||
      input.value < conditioningValidationLimits.rpe.minimum ||
      input.value > conditioningValidationLimits.rpe.maximum
    ) {
      return fail("intensity", "RPE must be from 1 to 10.");
    }

    const intensity = { method: "rpe", value: input.value } as const;
    return { input: intensity, snapshot: intensity };
  }

  if (input.method === "heart_rate") {
    const maximumHeartRateBpm = baselines.maximumHeartRateBpm;
    if (maximumHeartRateBpm === null) {
      return fail(
        "intensity",
        "Set a maximum heart rate before using heart-rate intensity.",
      );
    }
    if (
      !Number.isInteger(input.valueBpm) ||
      input.valueBpm <
        conditioningValidationLimits.sessionHeartRateBpm.minimum ||
      input.valueBpm > maximumHeartRateBpm
    ) {
      return fail(
        "intensity",
        `Heart rate must be a whole number from ${conditioningValidationLimits.sessionHeartRateBpm.minimum} to ${maximumHeartRateBpm} BPM.`,
      );
    }

    return {
      input: { method: "heart_rate", valueBpm: input.valueBpm },
      snapshot: {
        method: "heart_rate",
        valueBpm: input.valueBpm,
        maxHeartRateBpm: maximumHeartRateBpm,
      },
    };
  }

  if (activity !== "running" && activity !== "hill_sprints") {
    return fail(
      "intensity",
      "Pace intensity is only available for Running and Hill Sprints.",
    );
  }

  if (input.reference === "threshold_pace") {
    const thresholdPaceSecondsPerKm = baselines.thresholdPaceSecondsPerKm;
    if (thresholdPaceSecondsPerKm === null) {
      return fail(
        "intensity",
        "Set a threshold pace before using pace intensity.",
      );
    }
    if (
      !isFiniteNumber(input.paceSecondsPerKm) ||
      input.paceSecondsPerKm <
        conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum ||
      input.paceSecondsPerKm >
        conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum
    ) {
      return fail("intensity", "Pace must be from 30 to 3600 seconds per kilometre.");
    }

    return {
      input: {
        method: "pace",
        reference: "threshold_pace",
        paceSecondsPerKm: input.paceSecondsPerKm,
      },
      snapshot: {
        method: "pace",
        reference: "threshold_pace",
        paceSecondsPerKm: input.paceSecondsPerKm,
        thresholdPaceSecondsPerKm,
      },
    };
  }

  const maximumAerobicSpeedKph = baselines.maximumAerobicSpeedKph;
  if (maximumAerobicSpeedKph === null) {
    return fail(
      "intensity",
      "Set a maximum aerobic speed before using speed intensity.",
    );
  }
  if (
    !isFiniteNumber(input.speedKph) ||
    input.speedKph <= 0 ||
    input.speedKph > conditioningValidationLimits.maximumAerobicSpeedKph
  ) {
    return fail(
      "intensity",
      "Speed must be greater than 0 and no more than 60 km/h.",
    );
  }

  return {
    input: {
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph: input.speedKph,
    },
    snapshot: {
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph: input.speedKph,
      maximumAerobicSpeedKph,
    },
  };
}

function normalizeDefinitionFields(
  input: NewConditioningTemplate | NewConditioningLog | UpdateConditioningLog,
): Omit<NormalizedDefinition, "intensity"> {
  if (!isActivity(input.activity)) {
    return fail("activity", "Activity is invalid.");
  }

  const protocolResult = normalizeProtocol(input.protocol);

  return {
    title: normalizeTitle(input.title),
    activity: input.activity,
    protocol: protocolResult.protocol,
    notes: normalizeNotes(input.notes),
    metrics: protocolResult.metrics,
  };
}

function normalizeDefinition(
  input: NewConditioningTemplate | NewConditioningLog,
  baselines: AthleteConditioningBaselines,
): NormalizedDefinition & {
  snapshottedIntensity: SnapshottedConditioningIntensity;
} {
  const definition = normalizeDefinitionFields(input);
  const intensity = normalizeIntensity(
    input.intensity,
    definition.activity,
    baselines,
  );

  return {
    ...definition,
    intensity: intensity.input,
    snapshottedIntensity: intensity.snapshot,
  };
}

function getIntensityStorageValues(
  intensity: ConditioningIntensityInput,
): [string | null, number | null, string | null] {
  if (intensity === null) {
    return [null, null, null];
  }
  if (intensity.method === "rpe") {
    return ["rpe", intensity.value, null];
  }
  if (intensity.method === "heart_rate") {
    return ["heart_rate", intensity.valueBpm, "max_heart_rate"];
  }
  if (intensity.reference === "threshold_pace") {
    return ["pace", intensity.paceSecondsPerKm, "threshold_pace"];
  }
  return ["pace", intensity.speedKph, "maximum_aerobic_speed"];
}

function getSnapshotBaselineValue(
  intensity: SnapshottedConditioningIntensity,
) {
  if (intensity === null || intensity.method === "rpe") {
    return null;
  }
  if (intensity.method === "heart_rate") {
    return intensity.maxHeartRateBpm;
  }
  return intensity.reference === "threshold_pace"
    ? intensity.thresholdPaceSecondsPerKm
    : intensity.maximumAerobicSpeedKph;
}

function getIntensityInputFromSnapshot(
  intensity: SnapshottedConditioningIntensity,
): ConditioningIntensityInput {
  if (intensity === null) {
    return null;
  }
  if (intensity.method === "rpe") {
    return { method: "rpe", value: intensity.value };
  }
  if (intensity.method === "heart_rate") {
    return { method: "heart_rate", valueBpm: intensity.valueBpm };
  }
  if (intensity.reference === "threshold_pace") {
    return {
      method: "pace",
      reference: "threshold_pace",
      paceSecondsPerKm: intensity.paceSecondsPerKm,
    };
  }
  return {
    method: "pace",
    reference: "maximum_aerobic_speed",
    speedKph: intensity.speedKph,
  };
}

function hasSameIntensityValue(
  input: ConditioningIntensityInput,
  stored: SnapshottedConditioningIntensity,
) {
  const storedInput = getIntensityInputFromSnapshot(stored);
  if (input === null || storedInput === null) {
    return input === storedInput;
  }
  if (input.method !== storedInput.method) {
    return false;
  }
  if (input.method === "rpe" && storedInput.method === "rpe") {
    return input.value === storedInput.value;
  }
  if (
    input.method === "heart_rate" &&
    storedInput.method === "heart_rate"
  ) {
    return input.valueBpm === storedInput.valueBpm;
  }
  if (input.method !== "pace" || storedInput.method !== "pace") {
    return false;
  }
  if (input.reference !== storedInput.reference) {
    return false;
  }
  return input.reference === "threshold_pace" &&
    storedInput.reference === "threshold_pace"
    ? input.paceSecondsPerKm === storedInput.paceSecondsPerKm
    : input.reference === "maximum_aerobic_speed" &&
        storedInput.reference === "maximum_aerobic_speed" &&
        input.speedKph === storedInput.speedKph;
}

function areProtocolsEqual(
  left: ConditioningProtocol,
  right: ConditioningProtocol,
) {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type === "continuous" && right.type === "continuous") {
    return (
      left.durationSeconds === right.durationSeconds &&
      left.distanceMeters === right.distanceMeters
    );
  }
  if (left.type === "intervals" && right.type === "intervals") {
    if (
      left.restBetweenIntervalsSeconds !==
        right.restBetweenIntervalsSeconds ||
      left.intervalCount !== right.intervalCount ||
      left.roundCount !== right.roundCount ||
      left.restBetweenRoundsSeconds !== right.restBetweenRoundsSeconds ||
      left.work.mode !== right.work.mode ||
      left.work.durationSeconds !== right.work.durationSeconds
    ) {
      return false;
    }
    if (left.work.mode === "time" && right.work.mode === "time") {
      return true;
    }
    return (
      left.work.mode === "distance" &&
      right.work.mode === "distance" &&
      left.work.distanceMeters === right.work.distanceMeters &&
      left.work.provenance === right.work.provenance &&
      left.work.legacyTotalDurationSeconds ===
        right.work.legacyTotalDurationSeconds
    );
  }
  if (left.type !== "circuit" || right.type !== "circuit") {
    return false;
  }
  return (
    left.restBetweenStationsSeconds === right.restBetweenStationsSeconds &&
    left.roundCount === right.roundCount &&
    left.restBetweenRoundsSeconds === right.restBetweenRoundsSeconds &&
    left.stations.length === right.stations.length &&
    left.stations.every((station, index) => {
      const other = right.stations[index];
      return (
        other !== undefined &&
        station.name === other.name &&
        station.position === other.position &&
        station.workSeconds === other.workSeconds
      );
    })
  );
}

function getDefinitionStorageValues(
  definition: NormalizedDefinition,
): SQLiteBindValue[] {
  const [intensityMethod, intensityValue, intensityReference] =
    getIntensityStorageValues(definition.intensity);
  const protocol = definition.protocol;

  return [
    definition.activity,
    getStoredProtocolType(protocol),
    intensityMethod,
    intensityValue,
    intensityReference,
    protocol.type === "continuous" ? protocol.durationSeconds : null,
    protocol.type === "continuous" ? protocol.distanceMeters : null,
    protocol.type === "intervals" && protocol.work.mode === "time"
      ? protocol.work.durationSeconds
      : null,
    protocol.type === "intervals" && protocol.work.mode === "distance"
      ? protocol.work.distanceMeters
      : null,
    protocol.type === "intervals" && protocol.work.mode === "distance"
      ? protocol.work.provenance === "legacy-derived" &&
        protocol.work.legacyTotalDurationSeconds !== undefined
        ? protocol.work.legacyTotalDurationSeconds
        : definition.metrics.totalSessionSeconds
      : null,
    protocol.type === "intervals" &&
    protocol.work.mode === "distance" &&
    protocol.work.provenance === "explicit"
      ? protocol.work.durationSeconds
      : null,
    protocol.type === "intervals"
      ? protocol.restBetweenIntervalsSeconds
      : null,
    protocol.type === "intervals"
      ? protocol.intervalCount
      : null,
    protocol.type === "intervals"
      ? protocol.roundCount
      : null,
    protocol.type === "intervals"
      ? protocol.restBetweenRoundsSeconds
      : null,
    protocol.type === "circuit" ? protocol.roundCount : null,
    protocol.type === "circuit" ? protocol.restBetweenStationsSeconds : null,
    protocol.type === "circuit" ? protocol.restBetweenRoundsSeconds : null,
  ];
}

function getTemplateIntensity(row: StoredDefinitionRow): ConditioningIntensityInput {
  if (row.intensity_method === null) {
    return null;
  }
  if (!isFiniteNumber(row.intensity_value)) {
    throw new Error("Stored conditioning intensity is invalid.");
  }
  if (row.intensity_method === "rpe" && row.intensity_reference === null) {
    return { method: "rpe", value: row.intensity_value };
  }
  if (
    row.intensity_method === "heart_rate" &&
    row.intensity_reference === "max_heart_rate"
  ) {
    return { method: "heart_rate", valueBpm: row.intensity_value };
  }
  if (
    row.intensity_method === "pace" &&
    row.intensity_reference === "threshold_pace"
  ) {
    return {
      method: "pace",
      reference: "threshold_pace",
      paceSecondsPerKm: row.intensity_value,
    };
  }
  if (
    row.intensity_method === "pace" &&
    row.intensity_reference === "maximum_aerobic_speed"
  ) {
    return {
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph: row.intensity_value,
    };
  }

  throw new Error("Stored conditioning intensity is invalid.");
}

function getSnapshottedIntensity(
  row: StoredDefinitionRow & { intensity_baseline_value: number | null },
): SnapshottedConditioningIntensity {
  const intensity = getTemplateIntensity(row);
  if (intensity === null || intensity.method === "rpe") {
    return intensity;
  }
  if (!isFiniteNumber(row.intensity_baseline_value)) {
    throw new Error("Stored conditioning intensity baseline is invalid.");
  }
  if (intensity.method === "heart_rate") {
    return {
      ...intensity,
      maxHeartRateBpm: row.intensity_baseline_value,
    };
  }
  if (intensity.reference === "threshold_pace") {
    return {
      ...intensity,
      thresholdPaceSecondsPerKm: row.intensity_baseline_value,
    };
  }
  return {
    ...intensity,
    maximumAerobicSpeedKph: row.intensity_baseline_value,
  };
}

function getProtocolFromRow(
  row: StoredDefinitionRow,
  stations: CircuitStation[],
): { protocol: ConditioningProtocol; metrics: ConditioningProtocolMetrics } {
  if (!isStoredProtocolType(row.protocol_type)) {
    throw new Error("Stored conditioning type is invalid.");
  }

  let protocol: ConditioningProtocol;
  if (row.protocol_type === "continuous") {
    protocol = {
      type: "continuous",
      durationSeconds: row.continuous_duration_seconds as number,
      distanceMeters: row.continuous_distance_meters,
    };
  } else if (row.protocol_type === "time_intervals") {
    protocol = {
      type: "intervals",
      work: {
        mode: "time",
        durationSeconds: row.interval_work_duration_seconds as number,
      },
      restBetweenIntervalsSeconds:
        row.rest_between_repetitions_seconds as number,
      intervalCount: row.repetitions_per_set as number,
      roundCount: row.set_count as number,
      restBetweenRoundsSeconds: row.rest_between_sets_seconds as number,
    };
  } else if (row.protocol_type === "distance_intervals") {
    const intervalCount = row.repetitions_per_set as number;
    const roundCount = row.set_count as number;
    const restBetweenIntervalsSeconds =
      row.rest_between_repetitions_seconds as number;
    const restBetweenRoundsSeconds = row.rest_between_sets_seconds as number;
    const totalDurationSeconds = row.distance_total_duration_seconds as number;
    const boutCount = intervalCount * roundCount;
    const scheduledRestSeconds =
      restBetweenIntervalsSeconds * (intervalCount - 1) * roundCount +
      restBetweenRoundsSeconds * (roundCount - 1);
    const explicitWorkDurationSeconds = row.distance_work_duration_seconds;

    protocol = {
      type: "intervals",
      work:
        explicitWorkDurationSeconds === null
          ? {
              mode: "distance",
              distanceMeters: row.interval_work_distance_meters as number,
              durationSeconds:
                (totalDurationSeconds - scheduledRestSeconds) / boutCount,
              provenance: "legacy-derived",
              legacyTotalDurationSeconds: totalDurationSeconds,
            }
          : {
              mode: "distance",
              distanceMeters: row.interval_work_distance_meters as number,
              durationSeconds: explicitWorkDurationSeconds,
              provenance: "explicit",
            },
      restBetweenIntervalsSeconds,
      intervalCount,
      roundCount,
      restBetweenRoundsSeconds,
    };
  } else {
    protocol = {
      type: "circuit",
      stations,
      restBetweenStationsSeconds:
        row.circuit_rest_between_stations_seconds as number,
      roundCount: row.circuit_round_count as number,
      restBetweenRoundsSeconds:
        row.circuit_rest_between_rounds_seconds as number,
    };
  }

  const result = evaluateConditioningProtocol(protocol);
  if (!result.ok) {
    throw new Error("Stored conditioning protocol is invalid.");
  }
  if (protocol.type !== "circuit" && stations.length > 0) {
    throw new Error("Stored conditioning stations are invalid.");
  }

  return { protocol: result.protocol, metrics: result.metrics };
}

function getStation(row: {
  station_position: number | null;
  station_name: string | null;
  station_work_duration_seconds: number | null;
}) {
  if (row.station_position === null) {
    return null;
  }
  const workSeconds = row.station_work_duration_seconds;
  if (
    !Number.isInteger(row.station_position) ||
    typeof row.station_name !== "string" ||
    typeof workSeconds !== "number" ||
    !Number.isInteger(workSeconds)
  ) {
    throw new Error("Stored conditioning station is invalid.");
  }

  return {
    position: row.station_position,
    name: row.station_name,
    workSeconds,
  };
}

function mapTemplateRows(rows: TemplateJoinRow[]) {
  const grouped = new Map<
    number,
    { firstRow: TemplateJoinRow; stations: CircuitStation[] }
  >();

  for (const row of rows) {
    let group = grouped.get(row.id);
    if (!group) {
      group = { firstRow: row, stations: [] };
      grouped.set(row.id, group);
    }
    const station = getStation(row);
    if (station) {
      group.stations.push(station);
    }
  }

  return Array.from(grouped.values()).map(({ firstRow, stations }) => {
    if (!isActivity(firstRow.activity)) {
      throw new Error("Stored conditioning activity is invalid.");
    }
    const protocol = getProtocolFromRow(firstRow, stations).protocol;

    return {
      id: firstRow.id,
      title: firstRow.title,
      activity: firstRow.activity,
      protocol,
      intensity: getTemplateIntensity(firstRow),
      notes: firstRow.notes,
      createdAt: firstRow.created_at,
      updatedAt: firstRow.updated_at,
    } satisfies StoredConditioningTemplate;
  });
}

function getScores(row: ScoreColumns): ConditioningAdaptationScores {
  const scores = {
    aerobic_base: row.aerobic_base_score,
    aerobic_power: row.aerobic_power_score,
    alactic_power: row.alactic_power_score,
    alactic_capacity: row.alactic_capacity_score,
    lactic_power: row.lactic_power_score,
    lactic_capacity: row.lactic_capacity_score,
    recovery: row.recovery_score,
  };

  if (
    Object.values(scores).some(
      (score) => !isFiniteNumber(score) || score < 0 || score > 100,
    )
  ) {
    throw new Error("Stored conditioning scores are invalid.");
  }

  return scores;
}

function mapScoredResult(
  row: ScoreColumns,
  protocol: ConditioningProtocol,
  intensity: SnapshottedConditioningIntensity,
): ScoredConditioningResult {
  const scores = getScores(row);
  if (!isAdaptationKey(row.primary_adaptation)) {
    throw new Error("Stored primary adaptation is invalid.");
  }
  const calculatedPrimary = conditioningAdaptationOrder.reduce((primary, key) =>
    scores[key] > scores[primary] ? key : primary,
  );
  if (calculatedPrimary !== row.primary_adaptation) {
    throw new Error("Stored primary adaptation does not match its scores.");
  }
  if (row.evidence_level !== "full" && row.evidence_level !== "limited") {
    throw new Error("Stored conditioning evidence is invalid.");
  }
  if (row.scoring_model_version !== "conditioning-v1.0.0") {
    throw new Error("Stored conditioning scoring model is unsupported.");
  }

  const missingInputs: string[] = [];
  if (intensity === null) {
    missingInputs.push("Intensity was not provided.");
  }
  if (
    protocol.type === "intervals" &&
    protocol.work.mode === "distance" &&
    protocol.work.provenance === "legacy-derived"
  ) {
    missingInputs.push(
      "Work duration was estimated from elapsed duration and scheduled rest.",
    );
  }

  return {
    status: "scored",
    scores,
    primaryAdaptation: row.primary_adaptation,
    evidence: row.evidence_level,
    missingInputs,
    modelVersion: "conditioning-v1.0.0",
  };
}

async function queryTemplateRows(
  db: SQLiteDatabase,
  templateId?: number,
) {
  const whereClause = templateId === undefined ? "" : "WHERE template.id = ?";
  const params = templateId === undefined ? [] : [templateId];

  return db.getAllAsync<TemplateJoinRow>(
    `SELECT
       template.*,
       station.position AS station_position,
       station.station_name,
       station.work_duration_seconds AS station_work_duration_seconds
     FROM conditioning_session_templates AS template
     LEFT JOIN conditioning_template_stations AS station
       ON station.template_id = template.id
     ${whereClause}
     ORDER BY
       template.updated_at DESC,
       template.id DESC,
       station.position ASC`,
    params,
  );
}

async function insertStations(
  db: SQLiteDatabase,
  table: "conditioning_template_stations" | "conditioning_log_stations",
  ownerColumn: "template_id" | "timeline_entry_id",
  ownerId: number,
  stations: CircuitStation[],
) {
  for (const station of stations) {
    await db.runAsync(
      `INSERT INTO ${table} (
        ${ownerColumn},
        position,
        station_name,
        work_duration_seconds
      ) VALUES (?, ?, ?, ?)`,
      [ownerId, station.position, station.name, station.workSeconds],
    );
  }
}

export async function getAthleteConditioningBaselines(
  db: SQLiteDatabase,
): Promise<AthleteConditioningBaselines> {
  const row = await db.getFirstAsync<BaselineRow>(
    `SELECT
       maximum_heart_rate_bpm,
       threshold_pace_seconds_per_km,
       maximum_aerobic_speed_kph
     FROM athlete_conditioning_baselines
     WHERE id = 1`,
  );

  if (!row) {
    return {
      maximumHeartRateBpm: null,
      thresholdPaceSecondsPerKm: null,
      maximumAerobicSpeedKph: null,
    };
  }

  return normalizeBaselines({
    maximumHeartRateBpm: row.maximum_heart_rate_bpm,
    thresholdPaceSecondsPerKm: row.threshold_pace_seconds_per_km,
    maximumAerobicSpeedKph: row.maximum_aerobic_speed_kph,
  });
}

export async function saveAthleteConditioningBaselines(
  db: SQLiteDatabase,
  input: AthleteConditioningBaselines,
): Promise<AthleteConditioningBaselines> {
  const baselines = normalizeBaselines(input);
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO athlete_conditioning_baselines (
      id,
      maximum_heart_rate_bpm,
      threshold_pace_seconds_per_km,
      maximum_aerobic_speed_kph,
      created_at,
      updated_at
    ) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      maximum_heart_rate_bpm = excluded.maximum_heart_rate_bpm,
      threshold_pace_seconds_per_km = excluded.threshold_pace_seconds_per_km,
      maximum_aerobic_speed_kph = excluded.maximum_aerobic_speed_kph,
      updated_at = excluded.updated_at`,
    [
      baselines.maximumHeartRateBpm,
      baselines.thresholdPaceSecondsPerKm,
      baselines.maximumAerobicSpeedKph,
      now,
      now,
    ],
  );

  return baselines;
}

export async function createConditioningTemplate(
  db: SQLiteDatabase,
  input: NewConditioningTemplate,
): Promise<StoredConditioningTemplate> {
  const baselines = await getAthleteConditioningBaselines(db);
  const definition = normalizeDefinition(input, baselines);
  const now = Date.now();
  let templateId: number | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `INSERT INTO conditioning_session_templates (
        title,
        ${DEFINITION_COLUMN_SQL},
        notes,
        created_at,
        updated_at
      ) VALUES (?, ${DEFINITION_PLACEHOLDER_SQL}, ?, ?, ?)`,
      [
        definition.title,
        ...getDefinitionStorageValues(definition),
        definition.notes,
        now,
        now,
      ],
    );
    templateId = result.lastInsertRowId;

    if (definition.protocol.type === "circuit") {
      await insertStations(
        transaction,
        "conditioning_template_stations",
        "template_id",
        templateId,
        definition.protocol.stations,
      );
    }
  });

  if (templateId === null) {
    throw new Error("Conditioning template could not be created.");
  }

  return {
    id: templateId,
    title: definition.title,
    activity: definition.activity,
    protocol: definition.protocol,
    intensity: definition.intensity,
    notes: definition.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listConditioningTemplates(
  db: SQLiteDatabase,
): Promise<StoredConditioningTemplate[]> {
  return mapTemplateRows(await queryTemplateRows(db));
}

export async function getConditioningTemplate(
  db: SQLiteDatabase,
  templateId: number,
): Promise<StoredConditioningTemplate | null> {
  if (!isPositiveInteger(templateId)) {
    return fail("templateId", "Conditioning template ID is invalid.");
  }

  const templates = mapTemplateRows(await queryTemplateRows(db, templateId));
  return templates[0] ?? null;
}

export async function logCompletedConditioningSession(
  db: SQLiteDatabase,
  input: NewConditioningLog,
): Promise<LoggedConditioningSessionResult> {
  const baselines = await getAthleteConditioningBaselines(db);
  const definition = normalizeDefinition(input, baselines);
  const score = scoreConditioningSession({
    activity: definition.activity,
    protocol: definition.protocol,
    intensity: definition.snapshottedIntensity,
  });
  if (score.status !== "scored") {
    throw new ConditioningValidationError(
      score.reasons.map((message) => ({ field: "score", message })),
    );
  }

  if (!Number.isInteger(input.startAt) || input.startAt < 0) {
    return fail("startAt", "Conditioning start time is invalid.");
  }
  const endAt = getConditioningEndAt(
    input.startAt,
    definition.metrics.totalSessionSeconds,
  );
  if (endAt === null) {
    return fail("endAt", "Conditioning end time is invalid.");
  }
  const now = Date.now();
  if (input.startAt > now || endAt > now) {
    return fail("startAt", "Completed conditioning sessions cannot be in the future.");
  }
  if (
    input.sourceTemplateId !== null &&
    !isPositiveInteger(input.sourceTemplateId)
  ) {
    return fail("sourceTemplateId", "Conditioning template ID is invalid.");
  }

  let timelineEntryId: number | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    let sourceTemplateId: number | null = null;
    if (input.sourceTemplateId !== null) {
      const template = await transaction.getFirstAsync<{ id: number }>(
        `SELECT id
         FROM conditioning_session_templates
         WHERE id = ?`,
        [input.sourceTemplateId],
      );
      sourceTemplateId = template?.id ?? null;
    }

    const timelineResult = await transaction.runAsync(
      `INSERT INTO timeline_entries (
        kind,
        title,
        start_at,
        end_at,
        status,
        notes,
        created_at,
        updated_at
      ) VALUES ('conditioning', ?, ?, ?, 'completed', ?, ?, ?)`,
      [definition.title, input.startAt, endAt, definition.notes, now, now],
    );
    timelineEntryId = timelineResult.lastInsertRowId;

    await transaction.runAsync(
      `INSERT INTO conditioning_logs (
        timeline_entry_id,
        source_template_id,
        ${DEFINITION_COLUMN_SQL},
        intensity_baseline_value
      ) VALUES (?, ?, ${DEFINITION_PLACEHOLDER_SQL}, ?)`,
      [
        timelineEntryId,
        sourceTemplateId,
        ...getDefinitionStorageValues(definition),
        getSnapshotBaselineValue(definition.snapshottedIntensity),
      ],
    );

    if (definition.protocol.type === "circuit") {
      await insertStations(
        transaction,
        "conditioning_log_stations",
        "timeline_entry_id",
        timelineEntryId,
        definition.protocol.stations,
      );
    }

    await transaction.runAsync(
      `INSERT INTO conditioning_adaptation_scores (
        timeline_entry_id,
        aerobic_base_score,
        aerobic_power_score,
        alactic_power_score,
        alactic_capacity_score,
        lactic_power_score,
        lactic_capacity_score,
        recovery_score,
        primary_adaptation,
        evidence_level,
        scoring_model_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timelineEntryId,
        score.scores.aerobic_base,
        score.scores.aerobic_power,
        score.scores.alactic_power,
        score.scores.alactic_capacity,
        score.scores.lactic_power,
        score.scores.lactic_capacity,
        score.scores.recovery,
        score.primaryAdaptation,
        score.evidence,
        score.modelVersion,
      ],
    );
  });

  if (timelineEntryId === null) {
    throw new Error("Conditioning session could not be logged.");
  }

  return {
    timelineEntryId,
    startAt: input.startAt,
    endAt,
    score,
  };
}

export async function updateCompletedConditioningSession(
  db: SQLiteDatabase,
  timelineEntryId: number,
  input: UpdateConditioningLog,
): Promise<LoggedConditioningSessionResult> {
  if (!isPositiveInteger(timelineEntryId)) {
    return fail("timelineEntryId", "Conditioning session ID is invalid.");
  }

  let updatedSession: LoggedConditioningSessionResult | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await getConditioningSessionByTimelineEntryId(
      transaction,
      timelineEntryId,
    );
    if (!existing) {
      return fail(
        "timelineEntryId",
        "Completed conditioning session was not found.",
      );
    }

    const definitionFields = normalizeDefinitionFields(input);
    const intensityIsUnchanged = hasSameIntensityValue(
      input.intensity,
      existing.intensity,
    );
    const normalizedIntensity = intensityIsUnchanged
      ? {
          input: getIntensityInputFromSnapshot(existing.intensity),
          snapshot: existing.intensity,
        }
      : normalizeIntensity(
          input.intensity,
          definitionFields.activity,
          await getAthleteConditioningBaselines(transaction),
        );
    const definition = {
      ...definitionFields,
      intensity: normalizedIntensity.input,
      snapshottedIntensity: normalizedIntensity.snapshot,
    };

    if (!Number.isInteger(input.startAt) || input.startAt < 0) {
      return fail("startAt", "Conditioning start time is invalid.");
    }
    const endAt = getConditioningEndAt(
      input.startAt,
      definition.metrics.totalSessionSeconds,
    );
    if (endAt === null) {
      return fail("endAt", "Conditioning end time is invalid.");
    }
    const now = Date.now();
    if (input.startAt > now || endAt > now) {
      return fail(
        "startAt",
        "Completed conditioning sessions cannot be in the future.",
      );
    }

    const scoringInputsAreUnchanged =
      intensityIsUnchanged &&
      definition.activity === existing.activity &&
      areProtocolsEqual(definition.protocol, existing.protocol);
    const score = scoringInputsAreUnchanged
      ? existing.score
      : scoreConditioningSession({
          activity: definition.activity,
          protocol: definition.protocol,
          intensity: definition.snapshottedIntensity,
        });
    if (score.status !== "scored") {
      throw new ConditioningValidationError(
        score.reasons.map((message) => ({ field: "score", message })),
      );
    }

    const timelineUpdate = await transaction.runAsync(
      `UPDATE timeline_entries
       SET title = ?,
           start_at = ?,
           end_at = ?,
           notes = ?,
           updated_at = ?
       WHERE id = ?
         AND kind = 'conditioning'
         AND status = 'completed'`,
      [
        definition.title,
        input.startAt,
        endAt,
        definition.notes,
        now,
        timelineEntryId,
      ],
    );
    if (timelineUpdate.changes !== 1) {
      throw new Error("Completed conditioning timeline entry was not updated.");
    }

    const definitionUpdate = await transaction.runAsync(
      `UPDATE conditioning_logs
       SET ${DEFINITION_UPDATE_SQL},
           intensity_baseline_value = ?
       WHERE timeline_entry_id = ?`,
      [
        ...getDefinitionStorageValues(definition),
        getSnapshotBaselineValue(definition.snapshottedIntensity),
        timelineEntryId,
      ],
    );
    if (definitionUpdate.changes !== 1) {
      throw new Error("Conditioning log definition was not updated.");
    }

    await transaction.runAsync(
      `DELETE FROM conditioning_log_stations
       WHERE timeline_entry_id = ?`,
      [timelineEntryId],
    );
    if (definition.protocol.type === "circuit") {
      await insertStations(
        transaction,
        "conditioning_log_stations",
        "timeline_entry_id",
        timelineEntryId,
        definition.protocol.stations,
      );
    }

    const scoreUpdate = await transaction.runAsync(
      `UPDATE conditioning_adaptation_scores
       SET aerobic_base_score = ?,
           aerobic_power_score = ?,
           alactic_power_score = ?,
           alactic_capacity_score = ?,
           lactic_power_score = ?,
           lactic_capacity_score = ?,
           recovery_score = ?,
           primary_adaptation = ?,
           evidence_level = ?,
           scoring_model_version = ?
       WHERE timeline_entry_id = ?`,
      [
        score.scores.aerobic_base,
        score.scores.aerobic_power,
        score.scores.alactic_power,
        score.scores.alactic_capacity,
        score.scores.lactic_power,
        score.scores.lactic_capacity,
        score.scores.recovery,
        score.primaryAdaptation,
        score.evidence,
        score.modelVersion,
        timelineEntryId,
      ],
    );
    if (scoreUpdate.changes !== 1) {
      throw new Error("Conditioning adaptation scores were not updated.");
    }

    updatedSession = {
      timelineEntryId,
      startAt: input.startAt,
      endAt,
      score,
    };
  });

  if (updatedSession === null) {
    throw new Error("Conditioning session could not be updated.");
  }

  return updatedSession;
}

export async function getConditioningSessionsForRange(
  db: SQLiteDatabase,
  rangeStart: number,
  rangeEnd: number,
): Promise<ConditioningCalendarRecord[]> {
  if (
    !Number.isInteger(rangeStart) ||
    !Number.isInteger(rangeEnd) ||
    rangeStart < 0 ||
    rangeEnd <= rangeStart
  ) {
    return fail("range", "Conditioning date range is invalid.");
  }

  const rows = await db.getAllAsync<CalendarRow>(
    `SELECT
       timeline.id AS timeline_entry_id,
       timeline.title,
       timeline.start_at,
       timeline.end_at,
       log.activity,
       log.protocol_type,
       score.primary_adaptation,
       score.evidence_level
     FROM timeline_entries AS timeline
     INNER JOIN conditioning_logs AS log
       ON log.timeline_entry_id = timeline.id
     INNER JOIN conditioning_adaptation_scores AS score
       ON score.timeline_entry_id = log.timeline_entry_id
     WHERE timeline.kind = 'conditioning'
       AND timeline.status = 'completed'
       AND timeline.start_at < ?
       AND timeline.end_at > ?
     ORDER BY timeline.start_at ASC, timeline.id ASC`,
    [rangeEnd, rangeStart],
  );

  return rows.map((row) => {
    if (
      !isActivity(row.activity) ||
      !isStoredProtocolType(row.protocol_type) ||
      !isAdaptationKey(row.primary_adaptation) ||
      (row.evidence_level !== "full" && row.evidence_level !== "limited") ||
      !Number.isInteger(row.timeline_entry_id) ||
      !Number.isInteger(row.start_at) ||
      !Number.isInteger(row.end_at)
    ) {
      throw new Error("Stored conditioning calendar record is invalid.");
    }

    return {
      timelineEntryId: row.timeline_entry_id,
      title: row.title,
      startAt: row.start_at,
      endAt: row.end_at,
      activity: row.activity,
      protocolType: getPublicProtocolType(row.protocol_type),
      primaryAdaptation: row.primary_adaptation,
      evidence: row.evidence_level,
    };
  });
}

export async function getConditioningSessionByTimelineEntryId(
  db: SQLiteDatabase,
  timelineEntryId: number,
): Promise<StoredConditioningSession | null> {
  if (!isPositiveInteger(timelineEntryId)) {
    return fail("timelineEntryId", "Conditioning session ID is invalid.");
  }

  const rows = await db.getAllAsync<SessionJoinRow>(
    `SELECT
       timeline.id AS timeline_entry_id,
       timeline.title,
       timeline.start_at,
       timeline.end_at,
       timeline.status,
       timeline.notes,
       timeline.created_at,
       timeline.updated_at,
       log.source_template_id,
       log.activity,
       log.protocol_type,
       log.intensity_method,
       log.intensity_value,
       log.intensity_reference,
       log.intensity_baseline_value,
       log.continuous_duration_seconds,
       log.continuous_distance_meters,
       log.interval_work_duration_seconds,
       log.interval_work_distance_meters,
       log.distance_total_duration_seconds,
       log.distance_work_duration_seconds,
       log.rest_between_repetitions_seconds,
       log.repetitions_per_set,
       log.set_count,
       log.rest_between_sets_seconds,
       log.circuit_round_count,
       log.circuit_rest_between_stations_seconds,
       log.circuit_rest_between_rounds_seconds,
       score.aerobic_base_score,
       score.aerobic_power_score,
       score.alactic_power_score,
       score.alactic_capacity_score,
       score.lactic_power_score,
       score.lactic_capacity_score,
       score.recovery_score,
       score.primary_adaptation,
       score.evidence_level,
       score.scoring_model_version,
       station.position AS station_position,
       station.station_name,
       station.work_duration_seconds AS station_work_duration_seconds
     FROM timeline_entries AS timeline
     INNER JOIN conditioning_logs AS log
       ON log.timeline_entry_id = timeline.id
     INNER JOIN conditioning_adaptation_scores AS score
       ON score.timeline_entry_id = log.timeline_entry_id
     LEFT JOIN conditioning_log_stations AS station
       ON station.timeline_entry_id = log.timeline_entry_id
     WHERE timeline.id = ?
       AND timeline.kind = 'conditioning'
       AND timeline.status = 'completed'
     ORDER BY station.position ASC`,
    [timelineEntryId],
  );

  const firstRow = rows[0];
  if (!firstRow) {
    return null;
  }
  if (
    !isActivity(firstRow.activity) ||
    firstRow.status !== "completed" ||
    !Number.isInteger(firstRow.end_at)
  ) {
    throw new Error("Stored conditioning session is invalid.");
  }

  const stations = rows
    .map(getStation)
    .filter((station): station is CircuitStation => station !== null);
  const { protocol, metrics } = getProtocolFromRow(firstRow, stations);
  const intensity = getSnapshottedIntensity(firstRow);
  const score = mapScoredResult(firstRow, protocol, intensity);

  return {
    timelineEntryId: firstRow.timeline_entry_id,
    sourceTemplateId: firstRow.source_template_id,
    title: firstRow.title,
    startAt: firstRow.start_at,
    endAt: firstRow.end_at,
    status: "completed",
    notes: firstRow.notes,
    createdAt: firstRow.created_at,
    updatedAt: firstRow.updated_at,
    activity: firstRow.activity,
    protocol,
    intensity,
    metrics,
    score,
  };
}
