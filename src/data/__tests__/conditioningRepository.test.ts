import type { SQLiteDatabase } from "expo-sqlite";

import {
  ConditioningValidationError,
  updateCompletedConditioningSession,
} from "../conditioningRepository";
import type {
  CircuitStation,
  UpdateConditioningLog,
} from "../../types/conditioning";

const NOW = 2_000_000_000_000;
const TIMELINE_ENTRY_ID = 41;

type SqlCall = {
  sql: string;
  params: unknown[];
};

type StoredRow = Record<string, string | number | null>;

type DatabaseHarness = {
  db: SQLiteDatabase;
  attemptedRunCalls: SqlCall[];
  committedRunCalls: SqlCall[];
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  rootRunAsync: jest.Mock;
  withExclusiveTransactionAsync: jest.Mock;
};

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function unpackParams(rawParams: unknown[]) {
  return rawParams.length === 1 && Array.isArray(rawParams[0])
    ? rawParams[0]
    : rawParams;
}

function makeStoredRows(
  overrides: Partial<StoredRow> = {},
  stations: CircuitStation[] = [],
): StoredRow[] {
  const row: StoredRow = {
    timeline_entry_id: TIMELINE_ENTRY_ID,
    source_template_id: 7,
    title: "Original conditioning",
    start_at: 1_000_000,
    end_at: 1_600_000,
    status: "completed",
    notes: "Original notes",
    created_at: 900_000,
    updated_at: 950_000,
    activity: "running",
    protocol_type: "continuous",
    intensity_method: "heart_rate",
    intensity_value: 150,
    intensity_reference: "max_heart_rate",
    intensity_baseline_value: 190,
    continuous_duration_seconds: 600,
    continuous_distance_meters: 2_000,
    interval_work_duration_seconds: null,
    interval_work_distance_meters: null,
    distance_total_duration_seconds: null,
    distance_work_duration_seconds: null,
    distance_duration_omitted: null,
    rest_between_repetitions_seconds: null,
    repetitions_per_set: null,
    set_count: null,
    rest_between_sets_seconds: null,
    circuit_round_count: null,
    circuit_rest_between_stations_seconds: null,
    circuit_rest_between_rounds_seconds: null,
    aerobic_base_score: 77,
    aerobic_power_score: 12,
    alactic_power_score: 11,
    alactic_capacity_score: 10,
    lactic_power_score: 9,
    lactic_capacity_score: 8,
    recovery_score: 7,
    primary_adaptation: "aerobic_base",
    evidence_level: "full",
    scoring_model_version: "conditioning-v1.0.0",
    station_position: null,
    station_name: null,
    station_work_duration_seconds: null,
    ...overrides,
  };

  if (stations.length === 0) {
    return [row];
  }

  return stations.map((station) => ({
    ...row,
    station_position: station.position,
    station_name: station.name,
    station_work_duration_seconds: station.workSeconds,
  }));
}

function createDatabaseHarness({
  rows = makeStoredRows(),
  baseline = {
    maximum_heart_rate_bpm: 205,
    threshold_pace_seconds_per_km: 280,
    maximum_aerobic_speed_kph: 18,
  },
  failRunMatching,
}: {
  rows?: StoredRow[];
  baseline?: Record<string, number | null>;
  failRunMatching?: RegExp;
} = {}): DatabaseHarness {
  const attemptedRunCalls: SqlCall[] = [];
  const committedRunCalls: SqlCall[] = [];
  const getAllAsync = jest.fn(async (sql: string) => {
    if (normalizeSql(sql).includes("FROM timeline_entries AS timeline")) {
      return rows;
    }

    throw new Error(`Unexpected getAllAsync query: ${normalizeSql(sql)}`);
  });
  const getFirstAsync = jest.fn(async (sql: string) => {
    if (normalizeSql(sql).includes("FROM athlete_conditioning_baselines")) {
      return baseline;
    }

    throw new Error(`Unexpected getFirstAsync query: ${normalizeSql(sql)}`);
  });
  const rootRunAsync = jest.fn(async () => {
    throw new Error("Repository write escaped the exclusive transaction.");
  });

  const withExclusiveTransactionAsync = jest.fn(
    async (callback: (transaction: SQLiteDatabase) => Promise<void>) => {
      const transactionCalls: SqlCall[] = [];
      const transaction = {
        getAllAsync,
        getFirstAsync,
        runAsync: jest.fn(async (sql: string, ...rawParams: unknown[]) => {
          const call = { sql, params: unpackParams(rawParams) };
          attemptedRunCalls.push(call);
          transactionCalls.push(call);

          if (failRunMatching?.test(normalizeSql(sql))) {
            throw new Error("Injected transaction failure.");
          }

          return { changes: 1, lastInsertRowId: 0 };
        }),
      } as unknown as SQLiteDatabase;

      await callback(transaction);
      committedRunCalls.push(...transactionCalls);
    },
  );

  const db = {
    getAllAsync,
    getFirstAsync,
    runAsync: rootRunAsync,
    withExclusiveTransactionAsync,
  } as unknown as SQLiteDatabase;

  return {
    db,
    attemptedRunCalls,
    committedRunCalls,
    getAllAsync,
    getFirstAsync,
    rootRunAsync,
    withExclusiveTransactionAsync,
  };
}

function makeContinuousUpdate(
  overrides: Partial<UpdateConditioningLog> = {},
): UpdateConditioningLog {
  return {
    title: "Updated conditioning",
    startAt: 1_000_000,
    activity: "running",
    protocol: {
      type: "continuous",
      durationSeconds: 600,
      distanceMeters: 2_000,
    },
    intensity: { method: "heart_rate", valueBpm: 150 },
    notes: "Updated notes",
    ...overrides,
  };
}

function findRunCall(calls: SqlCall[], pattern: RegExp) {
  const call = calls.find(({ sql }) => pattern.test(normalizeSql(sql)));
  if (!call) {
    throw new Error(`Expected SQL call matching ${pattern}.`);
  }
  return call;
}

function getUpdatedColumns(call: SqlCall) {
  const normalized = normalizeSql(call.sql);
  const assignments = normalized.match(/ SET (.+) WHERE /i)?.[1].split(",");
  if (!assignments) {
    throw new Error(`Could not read UPDATE assignments: ${normalized}`);
  }

  return Object.fromEntries(
    assignments.map((assignment, index) => [
      assignment.split("=")[0].trim(),
      call.params[index],
    ]),
  );
}

describe("updateCompletedConditioningSession", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects invalid and missing completed-session targets before writing", async () => {
    const invalidHarness = createDatabaseHarness();

    await expect(
      updateCompletedConditioningSession(
        invalidHarness.db,
        0,
        makeContinuousUpdate(),
      ),
    ).rejects.toBeInstanceOf(ConditioningValidationError);
    expect(invalidHarness.withExclusiveTransactionAsync).not.toHaveBeenCalled();

    const missingHarness = createDatabaseHarness({ rows: [] });
    await expect(
      updateCompletedConditioningSession(
        missingHarness.db,
        TIMELINE_ENTRY_ID,
        makeContinuousUpdate(),
      ),
    ).rejects.toBeInstanceOf(ConditioningValidationError);
    expect(missingHarness.attemptedRunCalls).toHaveLength(0);
  });

  it("rejects sessions that would still be in progress", async () => {
    const harness = createDatabaseHarness();

    await expect(
      updateCompletedConditioningSession(
        harness.db,
        TIMELINE_ENTRY_ID,
        makeContinuousUpdate({ startAt: NOW - 300_000 }),
      ),
    ).rejects.toThrow("Completed conditioning sessions cannot be in the future.");
    expect(harness.attemptedRunCalls).toHaveLength(0);
  });

  it("nulls inactive definition columns and removes obsolete circuit stations", async () => {
    const oldStations = [
      { position: 0, name: "Bike", workSeconds: 30 },
      { position: 1, name: "Carry", workSeconds: 40 },
    ];
    const harness = createDatabaseHarness({
      rows: makeStoredRows(
        {
          activity: "circuit",
          protocol_type: "circuit",
          continuous_duration_seconds: null,
          continuous_distance_meters: null,
          circuit_round_count: 3,
          circuit_rest_between_stations_seconds: 15,
          circuit_rest_between_rounds_seconds: 60,
          intensity_method: null,
          intensity_value: null,
          intensity_reference: null,
          intensity_baseline_value: null,
        },
        oldStations,
      ),
    });

    await updateCompletedConditioningSession(
      harness.db,
      TIMELINE_ENTRY_ID,
      makeContinuousUpdate({ intensity: null }),
    );

    const columns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(columns).toMatchObject({
      protocol_type: "continuous",
      continuous_duration_seconds: 600,
      continuous_distance_meters: 2_000,
      interval_work_duration_seconds: null,
      interval_work_distance_meters: null,
      distance_total_duration_seconds: null,
      distance_work_duration_seconds: null,
      rest_between_repetitions_seconds: null,
      repetitions_per_set: null,
      set_count: null,
      rest_between_sets_seconds: null,
      circuit_round_count: null,
      circuit_rest_between_stations_seconds: null,
      circuit_rest_between_rounds_seconds: null,
    });
    const definitionUpdate = findRunCall(
      harness.committedRunCalls,
      /UPDATE conditioning_logs SET/i,
    );
    expect(normalizeSql(definitionUpdate.sql)).not.toContain(
      "source_template_id",
    );
    const timelineUpdate = findRunCall(
      harness.committedRunCalls,
      /UPDATE timeline_entries SET/i,
    );
    expect(normalizeSql(timelineUpdate.sql)).not.toContain("created_at");
    expect(
      harness.committedRunCalls.filter(({ sql }) =>
        /DELETE FROM conditioning_log_stations/i.test(normalizeSql(sql)),
      ),
    ).toHaveLength(1);
    expect(
      harness.committedRunCalls.filter(({ sql }) =>
        /INSERT INTO conditioning_log_stations/i.test(normalizeSql(sql)),
      ),
    ).toHaveLength(0);
  });

  it("replaces circuit stations in position order", async () => {
    const harness = createDatabaseHarness({
      rows: makeStoredRows(
        {
          activity: "circuit",
          protocol_type: "circuit",
          continuous_duration_seconds: null,
          continuous_distance_meters: null,
          circuit_round_count: 2,
          circuit_rest_between_stations_seconds: 10,
          circuit_rest_between_rounds_seconds: 30,
          intensity_method: null,
          intensity_value: null,
          intensity_reference: null,
          intensity_baseline_value: null,
        },
        [{ position: 0, name: "Old station", workSeconds: 20 }],
      ),
    });
    const stations = [
      { position: 0, name: "Sled push", workSeconds: 25 },
      { position: 1, name: "Rower", workSeconds: 35 },
    ];

    await updateCompletedConditioningSession(harness.db, TIMELINE_ENTRY_ID, {
      title: "New circuit",
      startAt: 1_000_000,
      activity: "circuit",
      protocol: {
        type: "circuit",
        stations,
        restBetweenStationsSeconds: 12,
        roundCount: 3,
        restBetweenRoundsSeconds: 45,
      },
      intensity: null,
      notes: null,
    });

    const deleteIndex = harness.committedRunCalls.findIndex(({ sql }) =>
      /DELETE FROM conditioning_log_stations/i.test(normalizeSql(sql)),
    );
    const inserts = harness.committedRunCalls.filter(({ sql }) =>
      /INSERT INTO conditioning_log_stations/i.test(normalizeSql(sql)),
    );
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(inserts).toHaveLength(2);
    expect(inserts.map(({ params }) => params)).toEqual([
      [TIMELINE_ENTRY_ID, 0, "Sled push", 25],
      [TIMELINE_ENTRY_ID, 1, "Rower", 35],
    ]);
    expect(
      harness.committedRunCalls.indexOf(inserts[0]),
    ).toBeGreaterThan(deleteIndex);
  });

  it("preserves the historical score and baseline for metadata-only edits", async () => {
    const harness = createDatabaseHarness();

    const result = await updateCompletedConditioningSession(
      harness.db,
      TIMELINE_ENTRY_ID,
      makeContinuousUpdate(),
    );

    expect(harness.getFirstAsync).not.toHaveBeenCalled();
    const definitionColumns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(definitionColumns.intensity_baseline_value).toBe(190);

    const scoreColumns = getUpdatedColumns(
      findRunCall(
        harness.committedRunCalls,
        /UPDATE conditioning_adaptation_scores SET/i,
      ),
    );
    expect(scoreColumns).toMatchObject({
      aerobic_base_score: 77,
      aerobic_power_score: 12,
      alactic_power_score: 11,
      alactic_capacity_score: 10,
      lactic_power_score: 9,
      lactic_capacity_score: 8,
      recovery_score: 7,
      primary_adaptation: "aerobic_base",
      evidence_level: "full",
      scoring_model_version: "conditioning-v1.0.0",
    });
    expect(result.score.scores.aerobic_base).toBe(77);
  });

  it("reuses the historical intensity baseline when only the protocol changes", async () => {
    const harness = createDatabaseHarness();

    const result = await updateCompletedConditioningSession(
      harness.db,
      TIMELINE_ENTRY_ID,
      makeContinuousUpdate({
        protocol: {
          type: "continuous",
          durationSeconds: 1_200,
          distanceMeters: 3_000,
        },
      }),
    );

    expect(harness.getFirstAsync).not.toHaveBeenCalled();
    const definitionColumns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(definitionColumns.intensity_baseline_value).toBe(190);
    expect(result.score.scores.aerobic_base).not.toBe(77);
  });

  it("stores distance intervals without a work duration", async () => {
    const harness = createDatabaseHarness();

    const result = await updateCompletedConditioningSession(
      harness.db,
      TIMELINE_ENTRY_ID,
      makeContinuousUpdate({
        intensity: null,
        protocol: {
          type: "intervals",
          work: {
            mode: "distance",
            distanceMeters: 400,
            provenance: "distance-only",
          },
          restBetweenIntervalsSeconds: 10,
          intervalCount: 3,
          roundCount: 2,
          restBetweenRoundsSeconds: 20,
        },
      }),
    );

    const definitionColumns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(definitionColumns).toMatchObject({
      protocol_type: "distance_intervals",
      interval_work_distance_meters: 400,
      distance_total_duration_seconds: 61,
      distance_work_duration_seconds: null,
      distance_duration_omitted: 1,
    });
    expect(result).toMatchObject({
      timelineEntryId: TIMELINE_ENTRY_ID,
      startAt: 1_000_000,
      endAt: 1_060_000,
    });
  });

  it("resnapshots the current baseline after an explicit intensity change", async () => {
    const harness = createDatabaseHarness();

    await updateCompletedConditioningSession(
      harness.db,
      TIMELINE_ENTRY_ID,
      makeContinuousUpdate({
        intensity: { method: "heart_rate", valueBpm: 160 },
      }),
    );

    expect(harness.getFirstAsync).toHaveBeenCalledTimes(1);
    const definitionColumns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(definitionColumns).toMatchObject({
      intensity_method: "heart_rate",
      intensity_value: 160,
      intensity_reference: "max_heart_rate",
      intensity_baseline_value: 205,
    });
  });

  it("preserves untouched legacy distance totals and pace snapshots", async () => {
    const harness = createDatabaseHarness({
      rows: makeStoredRows({
        protocol_type: "distance_intervals",
        continuous_duration_seconds: null,
        continuous_distance_meters: null,
        interval_work_distance_meters: 400,
        distance_total_duration_seconds: 66,
        distance_work_duration_seconds: null,
        rest_between_repetitions_seconds: 5,
        repetitions_per_set: 2,
        set_count: 1,
        rest_between_sets_seconds: 0,
        intensity_method: "pace",
        intensity_value: 300,
        intensity_reference: "threshold_pace",
        intensity_baseline_value: 280,
      }),
    });

    await updateCompletedConditioningSession(harness.db, TIMELINE_ENTRY_ID, {
      title: "Renamed legacy intervals",
      startAt: 1_000_000,
      activity: "running",
      protocol: {
        type: "intervals",
        work: {
          mode: "distance",
          distanceMeters: 400,
          durationSeconds: 30.5,
          provenance: "legacy-derived",
          legacyTotalDurationSeconds: 66,
        },
        restBetweenIntervalsSeconds: 5,
        intervalCount: 2,
        roundCount: 1,
        restBetweenRoundsSeconds: 0,
      },
      intensity: {
        method: "pace",
        reference: "threshold_pace",
        paceSecondsPerKm: 300,
      },
      notes: "Metadata only",
    });

    expect(harness.getFirstAsync).not.toHaveBeenCalled();
    const columns = getUpdatedColumns(
      findRunCall(harness.committedRunCalls, /UPDATE conditioning_logs SET/i),
    );
    expect(columns).toMatchObject({
      protocol_type: "distance_intervals",
      distance_total_duration_seconds: 66,
      distance_work_duration_seconds: null,
      intensity_method: "pace",
      intensity_value: 300,
      intensity_reference: "threshold_pace",
      intensity_baseline_value: 280,
    });
  });

  it("propagates a transaction failure without committing partial writes", async () => {
    const harness = createDatabaseHarness({
      failRunMatching: /UPDATE conditioning_adaptation_scores SET/i,
    });

    await expect(
      updateCompletedConditioningSession(
        harness.db,
        TIMELINE_ENTRY_ID,
        makeContinuousUpdate({
          protocol: {
            type: "continuous",
            durationSeconds: 900,
            distanceMeters: 2_500,
          },
        }),
      ),
    ).rejects.toThrow("Injected transaction failure.");

    expect(harness.attemptedRunCalls.length).toBeGreaterThan(1);
    expect(harness.committedRunCalls).toHaveLength(0);
    expect(harness.rootRunAsync).not.toHaveBeenCalled();
  });
});
