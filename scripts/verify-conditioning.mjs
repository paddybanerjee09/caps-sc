import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  isLocalDateString,
  markerForSessionStatus,
} from "../src/conditioning/dates.ts";
import {
  buildIntervalPhases,
  buildSprintPhases,
  buildWorkoutSnapshot,
  intervalDurations,
  sumPhaseSeconds,
} from "../src/conditioning/phases.ts";
import { createId } from "../src/conditioning/ids.ts";
import {
  completeCurrentWork,
  createReadyRunner,
  endRunnerEarly,
  pauseRunner,
  reconcileRunner,
  remainingWholeSeconds,
  restoreAfterProcessTermination,
  resumeRunner,
  startRunner,
} from "../src/conditioning/runner.ts";
import {
  applyStationCompletionType,
  effectiveStationRpe,
  incompatibleStationFields,
  moveStation,
} from "../src/conditioning/validation.ts";
import {
  metersToDistance,
  milesToMeters,
  parseFiniteNumber,
  parseOptionalRpe,
  parsePositiveInteger,
  poundsToKilograms,
  yardsToMeters,
} from "../src/conditioning/units.ts";
import {
  buildMonthGrid,
  eventsOnDate,
  shiftMonth,
} from "../src/components/monthGrid.ts";
import { migrateDatabase } from "../src/data/database.ts";
import {
  discardConditioningRecording,
  findInProgressConditioningSession,
  getConditioningOwnerId,
  getConditioningSession,
  getConditioningTemplate,
  getConditioningUploadJob,
  insertConditioningLocationPoints,
  listConditioningOccurrences,
  listConditioningTemplates,
  logConditioningSession,
  planConditioningSession,
  replaceConditioningOccurrences,
  saveConditioningSession,
  saveConditioningTemplate,
  startConditioningSession,
  finishConditioningSession,
} from "../src/data/conditioningRepository.ts";

const db = new DatabaseSync(":memory:");
const adapter = {
  async execAsync(sql) {
    db.exec(sql);
  },
  async getFirstAsync(sql, params = []) {
    return db.prepare(sql).get(...params) ?? null;
  },
  async getAllAsync(sql, params = []) {
    return db.prepare(sql).all(...params);
  },
  async runAsync(sql, params = []) {
    const result = db.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  },
  async withTransactionAsync(task) {
    db.exec("BEGIN");
    try {
      await task();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

function ids() {
  let value = 0;
  return () => `id-${value++}`;
}

function intervalConfig(overrides = {}) {
  return {
    betweenRoundRestSeconds: 60,
    intervalsPerRound: 4,
    restSeconds: 15,
    rounds: 3,
    targetWorkRpe: 8,
    workSeconds: 30,
    ...overrides,
  };
}

function intervalTemplate(overrides = {}, configOverrides = {}) {
  return {
    circuit: null,
    format: "time_interval",
    interval: intervalConfig(configOverrides),
    notes: null,
    sprint: null,
    targetRpe: 8,
    title: "Intervals",
    version: 1,
    ...overrides,
  };
}

const example = intervalDurations(intervalConfig());
assert.equal(example.workSeconds, 360);
assert.equal(example.ordinaryRecoverySeconds, 135);
assert.equal(example.betweenRoundRecoverySeconds, 120);
assert.equal(example.workoutSeconds, 615);
assert.equal(example.preparationSeconds, 5);

const examplePhases = buildIntervalPhases(intervalConfig(), ids());
const exampleSums = sumPhaseSeconds(examplePhases);
assert.equal(exampleSums.workSeconds, 360);
assert.equal(exampleSums.ordinaryRecoverySeconds, 135);
assert.equal(exampleSums.betweenRoundRecoverySeconds, 120);
assert.equal(examplePhases.at(-1).type, "work");
assert.equal(
  examplePhases.some((phase) => phase.type === "preparation"),
  false,
);

const single = buildIntervalPhases(
  intervalConfig({
    betweenRoundRestSeconds: 40,
    intervalsPerRound: 1,
    restSeconds: 10,
    rounds: 1,
    workSeconds: 30,
  }),
  ids(),
);
assert.deepEqual(
  single.map((phase) => phase.type),
  ["work"],
);
assert.equal(
  intervalDurations({
    betweenRoundRestSeconds: 0,
    intervalsPerRound: 2,
    restSeconds: 0,
    rounds: 1,
    targetWorkRpe: 5,
    workSeconds: 30,
  }).workoutSeconds,
  60,
);

const twoByTwo = buildIntervalPhases(
  intervalConfig({
    betweenRoundRestSeconds: 40,
    intervalsPerRound: 2,
    restSeconds: 10,
    rounds: 2,
    workSeconds: 20,
  }),
  ids(),
);
assert.deepEqual(
  twoByTwo.map((phase) => phase.type),
  [
    "work",
    "ordinary_rest",
    "work",
    "round_recovery",
    "work",
    "ordinary_rest",
    "work",
  ],
);

const sprints = buildSprintPhases(
  {
    betweenSetRestSeconds: 50,
    completionMode: "manual",
    distanceMeters: 100,
    restSeconds: 20,
    sets: 2,
    sprintsPerSet: 2,
    targetElevationGainMeters: null,
    targetWorkRpe: null,
  },
  ids(),
);
assert.equal(sprints.at(-1).type, "work");
assert.equal(sprints[0].completion, "manual");
assert.equal(sprints[0].target.distanceMeters, 100);

assert.equal(isLocalDateString("2024-02-29"), true);
assert.equal(isLocalDateString("2023-02-29"), false);
assert.equal(isLocalDateString("2024-02-30"), false);
assert.equal(markerForSessionStatus("planned"), "planned");
assert.equal(markerForSessionStatus("completed"), "logged");
assert.equal(markerForSessionStatus("ended_early"), "logged");

assert.equal(milesToMeters(1), 1609.344);
assert.equal(yardsToMeters(1), 0.9144);
assert.equal(poundsToKilograms(1), 0.45359237);
const canonicalMeters = 1000;
assert.equal(metersToDistance(canonicalMeters, "imperial", "route") === canonicalMeters, false);
assert.equal(canonicalMeters, 1000);
assert.equal(parseFiniteNumber("NaN"), "invalid");
assert.equal(parseFiniteNumber("Infinity"), "invalid");
assert.equal(parsePositiveInteger("1.5"), null);
assert.equal(parsePositiveInteger("-2"), null);
assert.deepEqual(parseOptionalRpe(""), { ok: true, value: null });
assert.equal(parseOptionalRpe("0").ok, false);
assert.deepEqual(parseOptionalRpe("10"), { ok: true, value: 10 });

assert.throws(() =>
  buildWorkoutSnapshot(
    intervalTemplate({}, { intervalsPerRound: 2001, rounds: 1 }),
    ids(),
  ),
);

const station = {
  completionType: "repetitions",
  distanceMeters: null,
  exerciseName: "Squat",
  id: "station-1",
  instructions: null,
  loadKg: 20,
  machineCalories: null,
  notes: null,
  position: 0,
  recoverySeconds: 10,
  targetReps: 8,
  targetRpe: null,
  workSeconds: null,
};
assert.ok(incompatibleStationFields(station, "time").includes("loadKg"));
const timed = applyStationCompletionType(station, "time");
assert.equal(timed.loadKg, null);
assert.equal(timed.targetReps, null);
assert.equal(effectiveStationRpe(station, 7), 7);
assert.equal(effectiveStationRpe({ ...station, targetRpe: 9 }, 7), 9);
assert.equal(effectiveStationRpe(station, null), null);
assert.equal(moveStation([station, { ...station, id: "station-2", position: 1 }], 1, -1)[0].id, "station-2");

const intervalPhases = buildIntervalPhases(intervalConfig(), ids());
let runner = startRunner(createReadyRunner(intervalPhases, 0), 0, "process-a");
const finishedRun = reconcileRunner(runner, 620_000).state;
assert.equal(finishedRun.status, "finished");
assert.equal(finishedRun.totals.workMs, 360_000);
assert.equal(finishedRun.totals.prescribedRecoveryMs, 255_000);
assert.equal(finishedRun.totals.preparationMs, 5_000);
assert.equal(finishedRun.phases.at(-1).type, "work");
assert.equal(reconcileRunner(runner, 620_000).cuePhaseId !== null, true);

runner = startRunner(createReadyRunner(intervalPhases, 0), 0, "process-a");
assert.equal(remainingWholeSeconds(reconcileRunner(runner, 2_000).state, 2_000), 3);
const paused = pauseRunner(reconcileRunner(runner, 2_000).state, 2_000);
assert.equal(paused.remainingMs, 3_000);
const resumed = resumeRunner(paused, 10_000);
assert.equal(resumed.status, "preparing");
assert.equal(resumed.phaseIndex, 0);
assert.equal(remainingWholeSeconds(resumed, 10_000), 3);
assert.equal(resumed.totals.preparationMs, 0);

const manualPhases = buildSprintPhases(
  {
    betweenSetRestSeconds: 30,
    completionMode: "manual",
    distanceMeters: 100,
    restSeconds: 20,
    sets: 1,
    sprintsPerSet: 1,
    targetElevationGainMeters: null,
    targetWorkRpe: null,
  },
  ids(),
);
const manual = reconcileRunner(
  startRunner(createReadyRunner(manualPhases, 0), 0, "process-a"),
  100_000,
).state;
assert.equal(manual.status, "running");
assert.equal(manual.phases[manual.phaseIndex].completion, "manual");
assert.equal(manual.completedOccurrenceIds.length, 0);
assert.equal(manual.totals.workMs, 0);

const killed = restoreAfterProcessTermination(
  startRunner(createReadyRunner(intervalPhases, 1_000), 1_000, "process-a"),
);
assert.equal(killed.uncertainInterruption, true);
assert.equal(killed.status, "paused");
assert.equal(killed.totals.workMs, 0);
assert.equal(killed.totals.preparationMs, 0);
assert.equal(reconcileRunner(killed, 999_000).state.totals.workMs, 0);

const shortPhases = buildIntervalPhases(
  intervalConfig({
    betweenRoundRestSeconds: 0,
    intervalsPerRound: 2,
    restSeconds: 0,
    rounds: 1,
    workSeconds: 10,
  }),
  ids(),
);
const mid = reconcileRunner(
  startRunner(createReadyRunner(shortPhases, 0), 0, "process-a"),
  15_000,
).state;
const ended = endRunnerEarly(mid, 17_000);
assert.equal(ended.status, "ended_early");
assert.equal(ended.completedOccurrenceIds.length, 1);
assert.ok(ended.partialOccurrenceId);
assert.equal(ended.occurrenceWorkMs[ended.partialOccurrenceId], 2_000);
assert.equal(completeCurrentWork(manual, manual.phaseStartedAt + 4_000).totals.workMs, 4_000);

const leapFebruary = buildMonthGrid({
  events: [
    { color: "#D3C615", id: "a", localDate: "2024-02-29", status: "planned", title: "Plan" },
    { color: "#D3C615", id: "b", localDate: "2024-02-29", status: "logged", title: "Log 1" },
    { color: "#D3C615", id: "c", localDate: "2024-02-29", status: "logged", title: "Log 2" },
    { color: "#D3C615", id: "d", localDate: "2024-02-29", status: "logged", title: "Log 3" },
  ],
  monthIndex: 1,
  selectedDate: "2024-02-29",
  today: "2024-02-29",
  year: 2024,
});
const leapDay = leapFebruary.cells.find((cell) => cell.isoDate === "2024-02-29");
assert.equal(leapDay.inMonth, true);
assert.equal(leapDay.dayNumber, 29);
assert.equal(leapDay.isToday, true);
assert.equal(leapDay.isSelected, true);
assert.equal(leapDay.markers.length, 3);
assert.equal(leapDay.overflow, 1);
assert.equal(eventsOnDate(leapFebruary, "2024-02-29").length, 4);
assert.equal(leapFebruary.weekCount >= 4 && leapFebruary.weekCount <= 6, true);
assert.ok(leapFebruary.cells.some((cell) => !cell.inMonth));

const fourWeekFebruary = buildMonthGrid({
  events: [],
  monthIndex: 1,
  selectedDate: "2021-02-01",
  today: "2021-02-15",
  year: 2021,
});
assert.equal(fourWeekFebruary.weekCount, 4);
assert.equal(fourWeekFebruary.cells[0].isoDate, "2021-02-01");
assert.equal(fourWeekFebruary.cells.at(-1).isoDate, "2021-02-28");

assert.deepEqual(shiftMonth(2024, 0, 1), { monthIndex: 1, year: 2024 });
assert.deepEqual(shiftMonth(2024, 11, 1), { monthIndex: 0, year: 2025 });
const sundayStart = buildMonthGrid({
  events: [],
  monthIndex: 0,
  selectedDate: "2024-01-01",
  today: "2024-01-02",
  weekStartsOn: 0,
  year: 2024,
});
assert.equal(sundayStart.cells[0].isoDate, "2023-12-31");
assert.equal(sundayStart.cells[0].inMonth, false);
assert.equal(sundayStart.cells[1].isSelected, true);
assert.equal(sundayStart.cells[2].isToday, true);

await migrateDatabase(adapter);
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 7);
await migrateDatabase(adapter);

const ownerId = await getConditioningOwnerId(adapter);
const template = await saveConditioningTemplate(
  adapter,
  ownerId,
  intervalTemplate(),
);
assert.equal(template.lastUsedAt, null);
await getConditioningTemplate(adapter, ownerId, template.id);
assert.equal(
  (await getConditioningTemplate(adapter, ownerId, template.id)).lastUsedAt,
  null,
);
assert.equal((await listConditioningTemplates(adapter, ownerId)).length, 1);
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM conditioning_sessions").get().count,
  0,
);

const snapshot = buildWorkoutSnapshot(template.config, ids());
const planned = await planConditioningSession(adapter, ownerId, {
  scheduledLocalDate: "2020-01-01",
  schedulingTimezone: "UTC",
  snapshot,
  templateId: template.id,
});
assert.equal(planned.status, "planned");
assert.equal(planned.scheduledLocalDate, "2020-01-01");
assert.equal(planned.sessionRpe, null);
assert.equal(planned.targetRpe, 8);
assert.equal(markerForSessionStatus(planned.status), "planned");

await saveConditioningTemplate(
  adapter,
  ownerId,
  intervalTemplate({ title: "Renamed intervals" }),
  template.id,
);
const unchanged = await getConditioningSession(adapter, ownerId, planned.id);
assert.equal(unchanged.snapshot.title, "Intervals");
assert.equal(unchanged.status, "planned");
assert.equal(await getConditioningSession(adapter, "other-owner", planned.id), null);

const performedAt = Date.now() - 5000;
const started = await startConditioningSession(adapter, ownerId, {
  performedAt,
  planSessionId: planned.id,
  timezone: "UTC",
});
assert.equal(started.status, "in_progress");
assert.equal(started.startedFromPlan, true);
assert.equal(started.snapshot.title, "Intervals");
assert.ok((await getConditioningTemplate(adapter, ownerId, template.id)).lastUsedAt);
await assert.rejects(() =>
  startConditioningSession(adapter, ownerId, {
    performedAt,
    snapshot,
    timezone: "UTC",
  }),
);
await discardConditioningRecording(adapter, ownerId, started.id);
const restored = await getConditioningSession(adapter, ownerId, planned.id);
assert.equal(restored.status, "planned");
assert.equal(restored.performedAt, null);
assert.equal(restored.snapshot.title, "Intervals");

await assert.rejects(() =>
  startConditioningSession(adapter, ownerId, {
    performedAt: Date.now() + 60_000,
    snapshot,
    timezone: "UTC",
  }),
);

const live = await startConditioningSession(adapter, ownerId, {
  performedAt,
  snapshot,
  templateId: null,
  timezone: "UTC",
});
await finishConditioningSession(adapter, ownerId, live.id, {
  finishedAt: Date.now() - 1000,
});
const occurrence = {
  actual: null,
  completionMethod: "timer",
  completionStatus: "completed",
  endedAt: Date.now() - 1000,
  id: createId(),
  phaseType: "work",
  position: 0,
  roundIndex: 1,
  setIndex: null,
  startedAt: performedAt,
  stationId: null,
  target: snapshot.phases[0].target,
  workSeconds: 30,
};
await replaceConditioningOccurrences(adapter, ownerId, live.id, [occurrence]);
const saved = await saveConditioningSession(adapter, ownerId, live.id, {
  occurrences: [occurrence],
  sessionRpe: null,
  status: "completed",
});
const savedAgain = await saveConditioningSession(adapter, ownerId, live.id, {
  sessionRpe: 9,
  status: "ended_early",
});
assert.equal(savedAgain.id, saved.id);
assert.equal(savedAgain.status, "completed");
assert.equal(savedAgain.sessionRpe, null);
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM conditioning_upload_jobs").get().count,
  1,
);
assert.equal((await listConditioningOccurrences(adapter, ownerId, live.id))[0].actual, null);
assert.ok(await getConditioningUploadJob(adapter, ownerId, live.id));

const logged = await logConditioningSession(adapter, ownerId, {
  finishedAt: Date.now() - 1000,
  performedAt,
  sessionRpe: null,
  snapshot,
  timezone: "UTC",
});
assert.equal(logged.targetRpe, 8);
assert.equal(logged.sessionRpe, null);
assert.equal(logged.status, "completed");

const point = {
  acceptance: "accepted",
  altitude: null,
  altitudeAccuracy: null,
  distanceDeltaMeters: 0,
  horizontalAccuracy: 5,
  latitude: 51.5,
  longitude: -0.12,
  recordedAt: performedAt,
  rejectionReason: null,
  segmentId: null,
  sequence: 1,
};
await insertConditioningLocationPoints(adapter, ownerId, logged.id, [point]);
await assert.rejects(() =>
  insertConditioningLocationPoints(adapter, ownerId, logged.id, [point]),
);
await assert.rejects(() =>
  adapter.runAsync(
    `INSERT INTO conditioning_location_points (
      session_id, sequence, segment_id, recorded_at, latitude, longitude,
      horizontal_accuracy, altitude, altitude_accuracy, acceptance,
      rejection_reason, distance_delta_meters
    ) VALUES ('missing-session', 1, NULL, 1, 1, 1, NULL, NULL, NULL, 'accepted', NULL, 0)`,
  ),
);
await assert.rejects(() =>
  adapter.runAsync(
    "UPDATE conditioning_sessions SET session_rpe = 0 WHERE id = ?",
    [logged.id],
  ),
);

assert.equal(await findInProgressConditioningSession(adapter, ownerId), null);
db.close();
console.log("conditioning domain checks passed");
