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

function normalizeDefinition(
  input: NewConditioningTemplate | NewConditioningLog,
  baselines: AthleteConditioningBaselines,
): NormalizedDefinition & {
  snapshottedIntensity: SnapshottedConditioningIntensity;
} {
  if (!isActivity(input.activity)) {
    return fail("activity", "Activity is invalid.");
  }

  const protocolResult = normalizeProtocol(input.protocol);
  const intensity = normalizeIntensity(input.intensity, input.activity, baselines);

  return {
    title: normalizeTitle(input.title),
    activity: input.activity,
    protocol: protocolResult.protocol,
    intensity: intensity.input,
    snapshottedIntensity: intensity.snapshot,
    notes: normalizeNotes(input.notes),
    metrics: protocolResult.metrics,
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

function getDefinitionStorageValues(
  definition: NormalizedDefinition,
): SQLiteBindValue[] {
  const [intensityMethod, intensityValue, intensityReference] =
    getIntensityStorageValues(definition.intensity);
  const protocol = definition.protocol;

  return [
    definition.activity,
    protocol.type,
    intensityMethod,
    intensityValue,
    intensityReference,
    protocol.type === "continuous" ? protocol.durationSeconds : null,
    protocol.type === "continuous" ? protocol.distanceMeters : null,
    protocol.type === "time_intervals" ? protocol.workSeconds : null,
    protocol.type === "distance_intervals" ? protocol.workDistanceMeters : null,
    protocol.type === "distance_intervals"
      ? protocol.elapsedDurationSeconds
      : null,
    protocol.type === "time_intervals" || protocol.type === "distance_intervals"
      ? protocol.restBetweenRepetitionsSeconds
      : null,
    protocol.type === "time_intervals" || protocol.type === "distance_intervals"
      ? protocol.repetitionsPerSet
      : null,
    protocol.type === "time_intervals" || protocol.type === "distance_intervals"
      ? protocol.setCount
      : null,
    protocol.type === "time_intervals" || protocol.type === "distance_intervals"
      ? protocol.restBetweenSetsSeconds
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
  if (!isProtocolType(row.protocol_type)) {
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
      type: "time_intervals",
      workSeconds: row.interval_work_duration_seconds as number,
      restBetweenRepetitionsSeconds:
        row.rest_between_repetitions_seconds as number,
      repetitionsPerSet: row.repetitions_per_set as number,
      setCount: row.set_count as number,
      restBetweenSetsSeconds: row.rest_between_sets_seconds as number,
    };
  } else if (row.protocol_type === "distance_intervals") {
    protocol = {
      type: "distance_intervals",
      workDistanceMeters: row.interval_work_distance_meters as number,
      elapsedDurationSeconds: row.distance_total_duration_seconds as number,
      restBetweenRepetitionsSeconds:
        row.rest_between_repetitions_seconds as number,
      repetitionsPerSet: row.repetitions_per_set as number,
      setCount: row.set_count as number,
      restBetweenSetsSeconds: row.rest_between_sets_seconds as number,
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
  if (protocol.type === "distance_intervals") {
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
      !isProtocolType(row.protocol_type) ||
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
      protocolType: row.protocol_type,
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
