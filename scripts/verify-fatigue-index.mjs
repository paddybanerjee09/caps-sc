import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "../src/data/database.ts";
import { listCompletedTraining, listTrainingDayConfirmations, setCompletedTrainingLoad, setTrainingDayConfirmation } from "../src/data/trainingIndexRepository.ts";
import { fatigueHistory, observedOutputLoss, sessionLoad } from "../src/domain/training/fatigue.ts";
import { personalPercentile } from "../src/domain/training/metric.ts";
import { localDateInZone, shiftDate } from "../src/recovery/dates.ts";

const today = "2026-11-02";
const asOf = Date.parse("2026-11-02T14:00:00Z");
const oneDayAgo = shiftDate(today, -1);
const twoDaysAgo = shiftDate(today, -2);
const sessions = [
  { id: "1", localDate: twoDaysAgo, endAt: Date.parse("2026-10-31T14:00:00Z"), title: "Lift", modality: "strength", minutes: 60, sessionRpe: 5 },
  { id: "2", localDate: oneDayAgo, endAt: Date.parse("2026-11-01T14:00:00Z"), title: "Intervals", modality: "conditioning", minutes: 30, sessionRpe: 8 },
];
const days = Array.from({ length: 14 }, (_, index) => ({ localDate: shiftDate(today, -index - 1), kind: index < 2 ? "complete" : "rest" }));
const final = (entries, confirmations) => fatigueHistory(today, asOf, entries, confirmations).at(-1);
assert.ok(Math.abs(final(sessions, days).acute.value - 319.70562748477) < 1e-8);
assert.equal(final([...sessions, sessions[0]], days).acute.value, final(sessions, days).acute.value, "duplicate timeline identity contributes once");
assert.equal(final(sessions, days.slice(0, -1)).acute.status, "partial");
assert.equal(final(sessions, days.slice(0, -1)).index.value, null);
assert.equal(final(sessions, days).acute.status, "available");
assert.equal(final(sessions, days).index.value, null, "first complete day lacks earlier snapshots");
assert.equal(final([], days).completeDays, 12, "deleted workouts do not turn into confirmed rest");
assert.equal(final([sessions[0], { ...sessions[1], sessionRpe: null }], days).completeDays, 13);
const allRest = Array.from({ length: 75 }, (_, index) => ({ localDate: shiftDate(today, -index - 1), kind: "rest" }));
assert.equal(final([], allRest).index.value, 50, "same-valued earlier days count as half a tie");
assert.equal(final([], allRest).referenceCount, 60);
assert.equal(final([], allRest).acute.value, 0);
assert.equal(final([], []).acute.value, null);
assert.equal(final([{ ...sessions[0], endAt: asOf + 1 }, { ...sessions[1], localDate: today, endAt: asOf - 1 }], allRest).acute.value, 0);
assert.equal(final([sessions[1]], [...allRest, days[0]]).index.value, 100, "today's burden is excluded from its own reference");
assert.equal(personalPercentile(5, [4, 5, 5, 6]), 50);
assert.equal(personalPercentile(5, [NaN]), null);
assert.equal(sessionLoad(30, 0), 0);
assert.equal(sessionLoad(0, 8), null);
assert.equal(sessionLoad(Infinity, 8), null);
assert.equal(shiftDate(today, -1), "2026-11-01");
assert.equal(localDateInZone("2026-11-01T04:01:00Z", "America/Toronto"), oneDayAgo);
assert.equal(localDateInZone("2026-11-02T04:59:00Z", "America/Toronto"), oneDayAgo);
const test = { observedAt: 10, comparisonKey: "30 m track · seconds", output: 5, direction: "elapsed-time" };
assert.equal(observedOutputLoss({ ...test, observedAt: 20, output: 6 }, test), 20);
assert.equal(observedOutputLoss({ ...test, observedAt: 20, comparisonKey: "30 m grass · seconds" }, test), null);
assert.equal(observedOutputLoss({ ...test, output: 6 }, test), null);

const sqlite = new DatabaseSync(":memory:");
const db = {
  execAsync: async (sql) => sqlite.exec(sql),
  runAsync: async (sql, bindings = []) => sqlite.prepare(sql).run(...bindings),
  getFirstAsync: async (sql, bindings = []) => sqlite.prepare(sql).get(...bindings) ?? null,
  getAllAsync: async (sql, bindings = []) => sqlite.prepare(sql).all(...bindings),
  withTransactionAsync: async (work) => {
    sqlite.exec("BEGIN");
    try { await work(); sqlite.exec("COMMIT"); } catch (err) { sqlite.exec("ROLLBACK"); throw err; }
  },
};
await migrateDatabase(db);
const start = Date.parse("2026-10-30T14:00:00Z");
sqlite.prepare("INSERT INTO timeline_entries(kind,title,start_at,end_at,status,created_at,updated_at) VALUES ('strength','Lift',?,?, 'completed',?,?)").run(start, start + 1800000, start, start);
sqlite.prepare("INSERT INTO timeline_entries(kind,title,start_at,end_at,status,created_at,updated_at) VALUES ('strength','Plan',?,?, 'planned',?,?)").run(start, start + 1800000, start, start);
const insert = sqlite.prepare("INSERT INTO strength_sessions(id,title,started_at,ended_at,local_end_date,timezone,duration_seconds,emphasis_json,emphasis_version,timeline_entry_id,created_at) VALUES (?,?,?,?,'2026-10-30','America/Toronto',1800,'{}','legacy',?,?)");
insert.run("lift", "Lift", start, start + 1800000, 1, start);
insert.run("plan", "Plan", start, start + 1800000, 2, start);
assert.deepEqual((await listCompletedTraining(db, asOf)).map(s => [s.id, s.minutes, s.sessionRpe]), [["1", null, null]], "legacy estimated duration is not completed minutes; plan excluded");
await assert.rejects(setCompletedTrainingLoad(db, "2", 30, 8));
await assert.rejects(setTrainingDayConfirmation(db, "2026-10-30", "rest", "America/Toronto"));
await assert.rejects(setTrainingDayConfirmation(db, "2026-10-30", "complete", "America/Toronto"));
await setCompletedTrainingLoad(db, "1", 30, 0);
await setTrainingDayConfirmation(db, "2026-10-30", "complete", "America/Toronto");
await setTrainingDayConfirmation(db, "2026-10-31", "rest", "America/Toronto");
assert.deepEqual((await listCompletedTraining(db, asOf)).map(s => [s.id, s.minutes, s.sessionRpe]), [["1", 30, 0]]);
assert.deepEqual((await listTrainingDayConfirmations(db)).map(day => day.kind), ["complete", "rest"]);
await setCompletedTrainingLoad(db, "1", 32, 6);
assert.deepEqual((await listCompletedTraining(db, asOf)).map(s => [s.id, s.minutes, s.sessionRpe]), [["1", 32, 6]], "retry/edits overwrite one observation");
sqlite.close();
console.log("Fatigue burden, local days across DST, dedupe, reference coverage, optional load logging, and matched output change passed.");
