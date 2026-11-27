import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import {
  isLocalDateString,
  markerForSessionStatus,
} from "../src/conditioning/dates.ts";
import {
  buildCircuitPhases,
  buildIntervalPhases,
  buildSprintPhases,
  buildWorkoutSnapshot,
  intervalDurations,
  sumPhaseSeconds,
} from "../src/conditioning/phases.ts";
import { createId } from "../src/conditioning/ids.ts";
import { MAX_WORK_OCCURRENCES } from "../src/conditioning/types.ts";
import {
  completeCurrentWork,
  createReadyRunner,
  endRunnerEarly,
  occurrencesFromRunner,
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
import { createWorkoutDraft, templateConfigFromDraft } from "../src/conditioning/drafts.ts";
import { estimateEmphasis, estimateSnapshotEmphasis } from "../src/conditioning/emphasis.ts";
import { conditioningStimulus } from "../src/conditioning/stimulus.ts";
import { estimateElevation } from "../src/conditioning/elevation.ts";
import { syncConditioningBundle } from "../src/data/conditioningSync.ts";
import {
  createGpsState,
  pauseGps,
  processLocationBatch,
} from "../src/conditioning/gps.ts";
import { buildSplits } from "../src/conditioning/splits.ts";
import {
  buildMonthGrid,
  eventsOnDate,
  shiftMonth,
} from "../src/components/monthGrid.ts";
import { migrateDatabase } from "../src/data/database.ts";
import {
  archiveConditioningTemplate,
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

// Direct text entry preserves empty drafts instead of silently storing omitted rest as zero.
const enteredInterval = createWorkoutDraft("time_interval", "2026-11-24");
enteredInterval.title = "Time Interval";
enteredInterval.targetWorkRpe = "8";
enteredInterval.restSeconds = "0";
enteredInterval.betweenRoundRestSeconds = "0";
const enteredSnapshot = buildWorkoutSnapshot(templateConfigFromDraft(enteredInterval));
assert.equal(enteredSnapshot.interval.restSeconds, 0);
assert.equal(enteredSnapshot.interval.betweenRoundRestSeconds, 0);
assert.equal(estimateSnapshotEmphasis(enteredSnapshot, null, "target_preview").source, "target_preview");
assert.notEqual(estimateSnapshotEmphasis(enteredSnapshot, null, "target_preview").labels.primary, null);
for (const field of ["workSeconds", "restSeconds", "intervalsPerRound", "rounds", "betweenRoundRestSeconds", "targetWorkRpe"]) {
  assert.throws(() => buildWorkoutSnapshot(templateConfigFromDraft({ ...enteredInterval, [field]: "" })));
}
assert.throws(() => buildWorkoutSnapshot(templateConfigFromDraft({ ...enteredInterval, rounds: "2001" })));
assert.throws(() => buildWorkoutSnapshot(templateConfigFromDraft({ ...enteredInterval, targetWorkRpe: "11" })));

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

const longPhases = buildIntervalPhases(
  intervalConfig({ intervalsPerRound: MAX_WORK_OCCURRENCES, restSeconds: 0, rounds: 1, workSeconds: 1 }),
  ids(),
);
const longRun = startRunner(createReadyRunner(longPhases, 0), 0, "process-a");
const checkpoint = reconcileRunner(longRun, 5_000 + MAX_WORK_OCCURRENCES * 500).state;
const persisted = JSON.stringify(checkpoint);
const restoredCheckpoint = JSON.parse(persisted);
const endTime = 5_000 + MAX_WORK_OCCURRENCES * 1000;
const caughtUp = reconcileRunner(restoredCheckpoint, endTime);
assert.deepEqual(caughtUp, reconcileRunner(longRun, endTime));
assert.equal(caughtUp.cuePhaseId, longPhases.at(-1).id);
assert.equal(JSON.stringify(restoredCheckpoint), persisted);
assert.deepEqual(longRun.completedOccurrenceIds, []);
assert.deepEqual(longRun.occurrenceWorkMs, {});
const caughtUpOccurrences = occurrencesFromRunner(caughtUp.state);
const expectedIds = longPhases.map((phase) => phase.occurrenceId);
assert.deepEqual(caughtUp.state.completedOccurrenceIds, expectedIds);
assert.deepEqual(caughtUpOccurrences.map((item) => item.id), expectedIds);
assert.ok(caughtUpOccurrences.every((item) => item.completionStatus === "completed" && item.workSeconds === 1));

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

const mixedPhases = buildCircuitPhases({
  betweenRoundRestSeconds: 0,
  rounds: 1,
  stations: [{ ...timed, recoverySeconds: 0, workSeconds: 2 }, { ...station, id: "manual" }],
  targetRpe: null,
}, ids());
const mixed = reconcileRunner(startRunner(createReadyRunner(mixedPhases, 0), 0), 100_000);
assert.equal(mixed.cuePhaseId, mixedPhases[1].id);
assert.equal(mixed.state.phaseStartedAt, 7_000);
assert.deepEqual(occurrencesFromRunner(mixed.state).map((item) => item.completionStatus), [
  "completed", "pending",
]);

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

function gpsSample(recordedAt, latitude, longitude) {
  return {
    altitude: null,
    altitudeAccuracy: null,
    horizontalAccuracy: 5,
    latitude,
    longitude,
    recordedAt,
  };
}

const origin = processLocationBatch(createGpsState("run", 0), [gpsSample(0, 51, 0)]);
const moved = processLocationBatch(origin.state, [gpsSample(2_000, 51.0001, 0)], origin.seen);
assert.equal(moved.points[0].acceptance, "accepted");
const duplicate = processLocationBatch(moved.state, [gpsSample(2_000, 51.0001, 0)], moved.seen);
assert.equal(duplicate.points[0].rejectionReason, "duplicate");
assert.equal(duplicate.state.cumulativeMeters, moved.state.cumulativeMeters);
const delayed = processLocationBatch(createGpsState("run", 0), [
  gpsSample(7_000, 51.0001, 0),
  gpsSample(5_000, 51, 0),
]);
assert.equal(delayed.points[0].rejectionReason, null);
assert.equal(delayed.points[1].acceptance, "accepted");
const established = processLocationBatch(createGpsState("run", 0), [gpsSample(10_000, 51, 0)]);
assert.equal(
  processLocationBatch(established.state, [gpsSample(1_000, 51.0001, 0)], established.seen).points[0]
    .rejectionReason,
  "out_of_order",
);
const gap = processLocationBatch(origin.state, [gpsSample(40_000, 51.001, 0)], origin.seen);
assert.equal(gap.points[0].distanceDeltaMeters, 0);
assert.equal(gap.state.segmentSequence, 1);
const pausedGps = processLocationBatch(pauseGps(origin.state), [gpsSample(2_000, 51.001, 0)], origin.seen);
assert.equal(pausedGps.points[0].rejectionReason, "paused");
assert.equal(pausedGps.state.cumulativeMeters, 0);
const drift = processLocationBatch(origin.state, [gpsSample(1_000, 51.00001, 0)], origin.seen);
assert.equal(drift.points[0].rejectionReason, "stationary_drift");
const afterDrift = processLocationBatch(drift.state, [gpsSample(2_000, 51.0001, 0)], drift.seen);
assert.equal(afterDrift.points[0].acceptance, "accepted");
assert.ok(afterDrift.state.cumulativeMeters > 8);

const noisy = estimateElevation([
  Array.from({ length: 12 }, (_, index) => ({
    altitude: 100 + (index % 2 === 0 ? 0.4 : -0.4),
    altitudeAccuracy: 5,
  })),
]);
assert.equal(noisy.gainMeters, 0);
const climbed = estimateElevation([
  [100, 100, 101, 102, 104, 106, 108, 110, 111, 112].map((altitude) => ({
    altitude,
    altitudeAccuracy: 5,
  })),
]);
assert.ok((climbed.gainMeters ?? 0) > 5);
assert.ok((climbed.gainMeters ?? 0) < 20);

const route = [0, 500, 1000, 1500, 2000, 2500].map((cumulativeMeters, index) => ({
  activeMs: index * 100_000,
  cumulativeMeters,
  segmentSequence: 0,
}));
const routeSplits = buildSplits(route);
assert.equal(routeSplits.kilometer[0].complete, true);
assert.equal(routeSplits.kilometer[0].activeSeconds, 200);
assert.equal(routeSplits.kilometer[2].partial, true);
assert.equal(routeSplits.kilometer[2].distanceMeters, 500);
assert.equal(routeSplits.mile[0].distanceMeters, 1609.344);
const gapSplits = buildSplits([
  { activeMs: 0, cumulativeMeters: 0, segmentSequence: 0 },
  { activeMs: 100_000, cumulativeMeters: 800, segmentSequence: 0 },
  { activeMs: 200_000, cumulativeMeters: 800, segmentSequence: 1 },
  { activeMs: 300_000, cumulativeMeters: 1600, segmentSequence: 1 },
]);
assert.equal(gapSplits.kilometer[0].complete, false);

const emphasis = estimateEmphasis({
  bouts: [{ workRpe: 9, workSeconds: 8 }],
  recoverySeconds: 50,
  sessionRpe: null,
  source: "target_preview",
});
assert.equal(emphasis.version, "heuristic-v0.1");
assert.equal(emphasis.confidence, "low");
assert.equal(emphasis.scores.alactic_power, 90);
assert.equal(emphasis.labels.primary, "alactic_power");
assert.deepEqual(
  estimateEmphasis({
    bouts: [{ workRpe: null, workSeconds: null }],
    recoverySeconds: null,
    sessionRpe: null,
    source: "actual",
  }).scores.aerobic_endurance,
  null,
);
const calls = [];
const transport = {
  async finalize(sessionId) {
    calls.push(["finalize", sessionId]);
  },
  async uploadOccurrences(sessionId, occurrences) {
    calls.push(["occurrences", sessionId, occurrences.length]);
  },
  async uploadPoints(sessionId, points) {
    calls.push(["points", sessionId, points.map((point) => point.sequence).join(",")]);
  },
  async uploadSplits() {},
  async upsertSession(session) {
    calls.push(["session", session.id]);
  },
};
const syncPoint = (sequence) => ({
  acceptance: "accepted",
  altitude: null,
  altitudeAccuracy: null,
  distanceDeltaMeters: 1,
  horizontalAccuracy: 5,
  latitude: 1,
  longitude: 1,
  recordedAt: sequence,
  rejectionReason: null,
  segmentId: null,
  sequence,
});
const bundle = {
  job: {
    acknowledgedOccurrenceCount: 0,
    acknowledgedPointSequence: 1,
    acknowledgedSplitCount: 0,
    expectedOccurrenceCount: 0,
    expectedPointCount: 2,
    expectedSplitCount: 0,
    lastError: null,
    retryCount: 0,
    sessionId: "session-1",
    status: "pending",
    updatedAt: 1,
  },
  occurrences: [],
  points: [syncPoint(1), syncPoint(2)],
  session: { id: "session-1" },
  splits: [],
};
const synced = await syncConditioningBundle(bundle, transport);
assert.equal(synced.status, "synced");
assert.deepEqual(calls[0], ["session", "session-1"]);
assert.deepEqual(calls[1], ["points", "session-1", "2"]);
assert.equal(calls.filter((call) => call[0] === "session").length, 1);
const again = await syncConditioningBundle({ ...bundle, job: synced }, transport);
assert.equal(again.status, "synced");
assert.equal(again.acknowledgedPointSequence, 2);

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
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 13);
await migrateDatabase(adapter);

const ownerId = await getConditioningOwnerId(adapter);
const template = await saveConditioningTemplate(
  adapter,
  ownerId,
  intervalTemplate({ notes: "  Aerobic focus  " }),
);
assert.equal(template.lastUsedAt, null);
assert.equal(template.config.notes, "Aerobic focus");
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

const saveCircuit = (title, stations) => saveConditioningTemplate(adapter, ownerId, {
  ...intervalTemplate(),
  circuit: { betweenRoundRestSeconds: 0, rounds: 1, stations, targetRpe: null },
  format: "circuit",
  interval: null,
  title,
});
const circuit = await saveCircuit("Circuit", [
  { ...station, id: "circuit-first", position: 5 },
  { ...station, id: "circuit-second", position: 2 },
]);
const anotherCircuit = await saveCircuit("Another circuit", [{ ...station, id: "another-station" }]);
const archived = await saveCircuit("Archived circuit", [{ ...station, id: "archived-station" }]);
await archiveConditioningTemplate(adapter, ownerId, archived.id);
db.prepare("UPDATE conditioning_templates SET last_used_at = ? WHERE id = ?").run(10, circuit.id);
db.prepare("UPDATE conditioning_templates SET last_used_at = ? WHERE id = ?").run(20, anotherCircuit.id);
db.prepare("UPDATE conditioning_template_stations SET exercise_name = ? WHERE id = ?")
  .run("Stored station", "circuit-first");

let listReads = 0;
const countedAdapter = {
  ...adapter,
  getAllAsync(sql, params) {
    listReads += 1;
    return adapter.getAllAsync(sql, params);
  },
};
const templates = await listConditioningTemplates(countedAdapter, ownerId);
assert.equal(listReads, 2);
assert.deepEqual(templates.map((item) => item.id), [anotherCircuit.id, circuit.id, template.id]);
assert.deepEqual(templates[0].config.circuit.stations.map((item) => item.id), ["another-station"]);
assert.deepEqual(templates[1].config.circuit.stations.map((item) => [item.id, item.position]), [
  ["circuit-first", 0], ["circuit-second", 1],
]);
assert.equal(templates[1].config.circuit.stations[0].exerciseName, "Stored station");
assert.deepEqual(await getConditioningTemplate(adapter, ownerId, circuit.id), templates[1]);
assert.deepEqual(await listConditioningTemplates(adapter, "other-owner"), []);
assert.equal(await getConditioningTemplate(adapter, "other-owner", circuit.id), null);
assert.equal((await getConditioningTemplate(adapter, ownerId, archived.id)).config.circuit.stations[0].id,
  "archived-station");

const snapshot = buildWorkoutSnapshot({ ...template.config, notes: "  Aerobic focus  " }, ids());
assert.equal(snapshot.notes, "Aerobic focus");
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
  splits: [{
    activeSeconds: 100,
    complete: true,
    distanceMeters: 1_000,
    ordinal: 1,
    partial: false,
    unitSystem: "kilometer",
  }],
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
assert.equal(savedAgain.notes, "Aerobic focus");
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM conditioning_upload_jobs").get().count,
  1,
);
assert.equal((await listConditioningOccurrences(adapter, ownerId, live.id))[0].actual, null);
assert.equal((await getConditioningUploadJob(adapter, ownerId, live.id)).expectedSplitCount, 1);

const logged = await logConditioningSession(adapter, ownerId, {
  finishedAt: Date.now() - 1000,
  notes: "   ",
  performedAt,
  sessionRpe: null,
  snapshot,
  timezone: "UTC",
});
assert.equal(logged.targetRpe, 8);
assert.equal(logged.sessionRpe, null);
assert.equal(logged.status, "completed");
assert.equal(logged.notes, null);

const observedProtocol = { mode: "cycling", test: "CP fixture", source: "meter fixture", machine: "Stationary Bike A" };
const observedSnapshot = { ...snapshot, conditioningObservations: { protocol: observedProtocol, criticalPower: { protocol: observedProtocol, value: 250, testDate: "2026-11-19" } } };
const actualBikeBout = { ...occurrence, id: createId("occurrence"), actual: {
  distanceMeters: null, loadKg: null, machineCalories: null, reps: null, watts: 400,
  restSeconds: 20, restType: "active", restRpe: 2, effort: "repeated_effort",
} };
const observedLog = await logConditioningSession(adapter, ownerId, {
  finishedAt: Date.now() - 1000, performedAt, sessionRpe: 8, snapshot: observedSnapshot,
  timezone: "UTC", metrics: { elapsedSeconds: 330 }, occurrences: [actualBikeBout],
});
const reopenedObservation = await getConditioningSession(adapter, ownerId, observedLog.id);
assert.deepEqual(reopenedObservation.snapshot.conditioningObservations, observedSnapshot.conditioningObservations);
assert.equal(reopenedObservation.elapsedSeconds, 330);
assert.equal(reopenedObservation.sessionRpe, 8);
assert.deepEqual((await listConditioningOccurrences(adapter, ownerId, observedLog.id))[0].actual, actualBikeBout.actual);
assert.equal((await getConditioningSession(adapter, ownerId, logged.id)).snapshot.conditioningObservations, undefined);

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
const stimulusSetup = { mode: "cycling", test: "CP-v1", source: "power meter", machine: "Bike A" };
const stimulusReference = { protocol: stimulusSetup, value: 250, testDate: "2026-11-19" };
const makeStimulusWork = (seconds, restSeconds, effort = "repeated_effort", watts = 400) => Array.from({ length: 6 }, (_, position) => ({
  id: `stimulus-${position}`, position, phaseType: "work", workSeconds: seconds, completionStatus: "completed",
  actual: { watts, restSeconds: position < 5 ? restSeconds : undefined, effort },
}));
const stimulusInput = {
  status: "completed", performedAt: Date.parse("2026-11-20T14:00:00Z"), performedLocalDate: "2026-11-20",
  activeSeconds: null, elapsedSeconds: null, sessionSeconds: 330, sessionRpe: 8, continuous: false,
  expectedWorkBouts: 6, sprintProtocol: false, now: Date.parse("2026-11-21T12:00:00Z"),
  observations: { protocol: stimulusSetup, criticalPower: stimulusReference }, occurrences: makeStimulusWork(30, 30),
};
const measuredStimulus = conditioningStimulus(stimulusInput);
assert.equal(measuredStimulus.above.value, 27);
assert.equal(measuredStimulus.above.unit, "kJ");
assert.equal(measuredStimulus.above.status, "available");
assert.equal(measuredStimulus.vo2.value, null);
const fallbackStimulus = conditioningStimulus({ ...stimulusInput, observations: { protocol: stimulusSetup } });
assert.equal(fallbackStimulus.above.value, null);
assert.equal(fallbackStimulus.exposure.value, 180);
assert.equal(fallbackStimulus.exposure.method, "Protocol exposure");
assert.equal(fallbackStimulus.exposure.status, "partial");
const longerStimulus = conditioningStimulus({ ...stimulusInput, occurrences: makeStimulusWork(60, 60) });
assert.equal(longerStimulus.ratio.value, measuredStimulus.ratio.value);
assert.equal(longerStimulus.above.value, 54);
assert.equal(conditioningStimulus({ ...stimulusInput, occurrences: stimulusInput.occurrences.slice(0, 5) }).above.status, "partial");
assert.equal(conditioningStimulus({ ...stimulusInput, occurrences: [...stimulusInput.occurrences, stimulusInput.occurrences[0]] }).above.value, 27);
assert.equal(conditioningStimulus({ ...stimulusInput, status: "planned" }).above.value, null);
assert.equal(conditioningStimulus({ ...stimulusInput, sessionRpe: 0 }).sessionLoad.value, 0);
const lowerPower = conditioningStimulus({ ...stimulusInput, occurrences: makeStimulusWork(30, 30, "easy", 200) });
assert.equal(lowerPower.above.value, 0);
const fanBike = { ...stimulusSetup, mode: "assault_bike", technique: "arms and legs" };
const fanResult = conditioningStimulus({ ...stimulusInput, observations: { protocol: fanBike,
  criticalPower: { ...stimulusReference, protocol: { ...fanBike, machine: "Bike B" } },
  sprintBest: { protocol: { ...fanBike, technique: "legs only" }, value: 400, testDate: "2026-11-19", unit: "W" },
}, occurrences: makeStimulusWork(8, 20, "sprint") });
assert.equal(fanResult.above.value, null);
assert.equal(fanResult.test.value, null);
assert.equal(fanResult.sprint.value, 6);
const splitProtocol = { mode: "run", test: "30 m fly", source: "timing gates", distanceMeters: 30 };
const sprintInput = {
  ...stimulusInput, sprintProtocol: true,
  observations: { protocol: splitProtocol, sprintBest: { protocol: splitProtocol, value: 4, unit: "s", testDate: "2026-11-19" } },
  expectedWorkBouts: 2,
  occurrences: [4, 5].map((workSeconds, position) => ({ ...stimulusInput.occurrences[position], workSeconds,
    actual: { effort: "sprint", distanceMeters: 30 } })),
};
const sprintResult = conditioningStimulus(sprintInput);
assert.equal(sprintResult.test.value, 1);
assert.equal(sprintResult.sprintBest.value, 4);
assert.equal(sprintResult.sprintDrop[1].drop, 25);
assert.equal(conditioningStimulus({ ...sprintInput, performedLocalDate: "2026-11-19" }).test.value, null, "the session cannot be its own dated reference");

console.log("conditioning domain and observed stimulus checks passed");
