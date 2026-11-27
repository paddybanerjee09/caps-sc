import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "../src/data/database.ts";
import { recoveryMigrationSql } from "../src/data/recoveryMigration.ts";
import { deleteImportedHealth, listQuestionnaires, listSnapshots, saveQuestionnaire, setPreferredSources } from "../src/data/recoveryRepository.ts";
import { listSleepTargets, setSleepTarget } from "../src/data/trainingIndexRepository.ts";
import { createEmptyQuestionnaire } from "../src/recovery/calculations.ts";
import { localDateInZone, shiftDate } from "../src/recovery/dates.ts";
import { recoveryInputs } from "../src/recovery/indexData.ts";
import { calculateRecoveryIndex, questionnaireRecoverySleep } from "../src/recovery/recoveryIndex.ts";

const localDate = "2026-11-27";
const recent = (daysBack) => shiftDate(localDate, -daysBack);
const timestamp = (day, time = "07:00:00") => `${day}T${time}-05:00`;
const asOf = Date.parse(timestamp(localDate, "12:00:00"));
const checkIn = { localDate, readiness: 8, soreness: 0, availableAt: timestamp(localDate, "08:00:00") };
const night = (day, hours, extra = {}) => ({ id: `manual:${day}`, localDate: day, hours, endedAt: timestamp(day), ...extra });
const baselineWindow = { protocol: "rest in the morning, 5 min seated" };
const sample = (metric, day, value, extra = {}) => ({
  id: `${metric}:${day}`, externalId: `${metric}:${day}`, metric, value,
  unit: { rhr: "bpm", hrv: "ms", sleep_duration: "min" }[metric],
  measuredAt: timestamp(day), recordedAt: timestamp(day, "08:00:00"), localDate: day, timezone: "America/Toronto",
  platform: "health_connect", source: "Watch", sourceDevice: "Watch 001", sourceApp: "sample.source", quality: "valid",
  subtype: metric === "hrv" ? "RMSSD" : null, protocol: null, ...extra,
});
const score = (changes = {}) => calculateRecoveryIndex({ localDate, asOf, checkIn, ...changes });

const manualInput = { sleepTargetHours: 8, manualSleep: [night(localDate, 7)] };
const manual = score(manualInput);
assert.equal(manual.index.value, 65);
assert.equal(manual.method, "Manual");
assert.equal(manual.index.status, "partial");
assert.deepEqual(manual.index.coverage, { valid: 2, total: 3 });
assert.equal(manual.checkIn.soreness, 0);
assert.equal(manual.sleep.severity.value, 0.5);
assert.equal(manual.sleep.latest.hours, 7);
assert.deepEqual(manual.sleep.severity.coverage, { valid: 1, total: 3 });
assert.equal(score().index.value, null);
assert.equal(score().checkIn.readiness, 8);
assert.match(score().index.missingInputs.join(" "), /sleep deficit/);
assert.equal(score({ ...manualInput, checkIn: { localDate, fatigue: 0, sleepQuality: 10 } }).index.value, null);
assert.equal(score({ ...manualInput, checkIn: { localDate, readiness: 0 } }).checkIn.severity.value, 1);
assert.equal(score({ ...manualInput, checkIn: { localDate, readiness: 15 } }).checkIn.severity.reasonCodes[0], "invalid");
assert.equal(score({ ...manualInput, checkIn: { localDate: recent(1), readiness: 8 } }).checkIn.severity.reasonCodes[0], "stale");
assert.equal(score({ ...manualInput, checkIn: { ...checkIn, availableAt: timestamp(localDate, "14:00:00") } }).index.value, null);
assert.equal(score({ sleepTargetHours: 8, manualSleep: [night(localDate, 0)] }).sleep.severity.value, 1);
assert.equal(score({ sleepTargetHours: 8, manualSleep: [night(localDate, NaN)] }).sleep.severity.reasonCodes[0], "invalid");
assert.equal(score({ sleepTargetHours: 8, manualSleep: [night(recent(1), 6)] }).sleep.severity.reasonCodes[0], "stale");
assert.equal(score({ localDate: "2026-02-30" }).index.value, null);

const noTarget = score({ manualSleep: [night(localDate, 7)] });
assert.equal(noTarget.index.value, null);
assert.equal(noTarget.sleep.severity.value, null);
assert.equal(noTarget.sleep.latest.hours, 7);
assert.deepEqual(noTarget.sleep.severity.missingInputs, ["Personal sleep target", "Some earlier nights are unrecorded"]);

const duplicateSleep = [sample("sleep_duration", localDate, 450), sample("sleep_duration", localDate, 450, { id: "duplicate" })];
const wearableSleep = score({ sleepTargetHours: 8, measurements: duplicateSleep });
assert.equal(wearableSleep.method, "Wearable assisted");
assert.equal(wearableSleep.sleep.latest.hours, 7.5);
assert.equal(wearableSleep.sleep.nights.length, 1);
const correctedSleep = score({ ...manualInput, measurements: duplicateSleep, manualSleep: [
  night(localDate, 4, { correctedAt: timestamp(localDate, "08:00:00") }),
  night(localDate, 7, { id: "correction", correctedAt: timestamp(localDate, "09:00:00") }),
  night(localDate, 3, { id: "future-correction", correctedAt: timestamp(localDate, "18:00:00") }),
] });
assert.equal(correctedSleep.index.value, 65);
assert.equal(correctedSleep.method, "Manual");
assert.equal(correctedSleep.sleep.nights.length, 1);
assert.notEqual(wearableSleep.comparisonKey, manual.comparisonKey);
assert.equal(score({ ...manualInput, measurements: duplicateSleep, allowWearables: false }).index.value, 65);
assert.equal(score({ sleepTargetHours: 8, measurements: duplicateSleep, blockedWearableMetrics: ["sleep_duration"] }).sleep.severity.reasonCodes.includes("opted-out"), true);
const mixedSleep = score({ ...manualInput, measurements: [...duplicateSleep, sample("sleep_duration", recent(1), 420)],
  manualSleep: [...manualInput.manualSleep, night(recent(2), 10)] });
assert.equal(mixedSleep.method, "Wearable assisted");
assert.equal(mixedSleep.sleep.nights.length, 3);
assert.equal(mixedSleep.sleep.severity.value, 1 / 3);
assert.notEqual(mixedSleep.comparisonKey, manual.comparisonKey);

const rhr = sample("rhr", localDate, 62, baselineWindow);
const hrv = sample("hrv", localDate, 90, baselineWindow);
const priorRhr = Array.from({ length: 14 }, (_, index) => sample("rhr", recent(index + 1), 60, baselineWindow));
const priorHrv = Array.from({ length: 14 }, (_, index) => sample("hrv", recent(index + 1), 50, baselineWindow));
const withAutonomic = score({ ...manualInput, measurements: [...priorRhr, ...priorHrv, rhr, hrv] });
assert.equal(withAutonomic.autonomic.rhr.baselineCount, 14);
assert.equal(withAutonomic.autonomic.rhr.z, 2);
assert.equal(withAutonomic.autonomic.rhr.severity.value, 2 / 3);
assert.equal(withAutonomic.autonomic.hrv.z, 3);
assert.equal(withAutonomic.autonomic.hrv.severity.value, 0);
assert.equal(withAutonomic.autonomic.severity.value, 1 / 3);
assert.equal(withAutonomic.method, "Wearable assisted");
assert.equal(withAutonomic.index.status, "available");
const discordant = score({ checkIn: { localDate, readiness: 0 }, measurements: [...priorHrv, hrv] });
assert.equal(discordant.index.value, 50);
assert.equal(discordant.autonomic.hrv.severity.value, 0);
assert.equal(discordant.checkIn.severity.value, 1);
assert.notEqual(discordant.comparisonKey, withAutonomic.comparisonKey);
assert.equal(score({ measurements: [...priorHrv, { ...hrv, value: 10 }] }).autonomic.hrv.severity.value, 1);
assert.equal(score({ measurements: [...priorHrv, { ...hrv, value: 0 }] }).autonomic.hrv.severity.reasonCodes[0], "invalid");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, subtype: "SDNN" }] }).autonomic.hrv.severity.reasonCodes[0], "incompatible");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, protocol: null }] }).autonomic.hrv.severity.reasonCodes[0], "incompatible");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, sourceDevice: undefined }] }).autonomic.hrv.severity.reasonCodes[0], "incompatible");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, sourceDevice: "Watch 002" }] }).autonomic.hrv.baselineCount, 0);
assert.equal(score({ measurements: [...priorHrv, { ...hrv, protocol: "different window" }] }).autonomic.hrv.baselineCount, 0);
assert.equal(score({ measurements: priorHrv }).autonomic.hrv.severity.reasonCodes[0], "stale");
assert.equal(score({ measurements: [...priorHrv, hrv], allowWearables: false }).autonomic.hrv.severity.reasonCodes[0], "opted-out");
assert.equal(score({ measurements: [...priorHrv, hrv], preferred: { hrv: "Other watch" } }).autonomic.hrv.severity.reasonCodes[0], "missing");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, measuredUntil: timestamp(localDate, "15:00:00") }] }).autonomic.hrv.severity.reasonCodes[0], "invalid");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, recordedAt: timestamp(localDate, "15:00:00") }] }).autonomic.hrv.severity.reasonCodes[0], "invalid");

const denseButSparse = score({ measurements: [...priorHrv.slice(1), { ...priorHrv[0], value: Infinity }, {
  ...priorHrv[1], id: "duplicate-prior", measuredAt: timestamp(recent(2), "07:01:00"),
}, { ...hrv, id: "same-day", measuredAt: timestamp(localDate, "06:59:00") }, hrv, sample("hrv", recent(-1), 50, baselineWindow)] });
assert.equal(denseButSparse.autonomic.hrv.baselineCount, 13);
assert.equal(denseButSparse.autonomic.hrv.severity.reasonCodes[0], "insufficient-history");
assert.equal(score({ measurements: [...priorHrv, { ...hrv, externalId: priorHrv[0].externalId }] }).autonomic.hrv.baselineCount, 13);
assert.equal(score({ measurements: [...priorHrv.slice(1), hrv, sample("hrv", recent(42), 50, baselineWindow)] }).autonomic.hrv.baselineCount, 14);
assert.equal(score({ measurements: [...priorHrv.slice(1), hrv, sample("hrv", recent(43), 50, baselineWindow)] }).autonomic.hrv.baselineCount, 13);

const dstQuestionnaire = { ...createEmptyQuestionnaire("2026-03-08", "America/Toronto"), status: "completed", minutesAwake: 30,
  sleepOnset: "2026-03-07T23:00:00-05:00", wakeTime: "2026-03-08T07:00:00-04:00", completedAt: "2026-03-08T08:00:00-04:00" };
assert.equal(questionnaireRecoverySleep(dstQuestionnaire).hours, 6.5);
assert.equal(questionnaireRecoverySleep({ ...dstQuestionnaire, minutesAwake: null }), null);
assert.equal(questionnaireRecoverySleep({ ...dstQuestionnaire, sleepHours: 0 }).hours, 0);
assert.equal(questionnaireRecoverySleep({ ...dstQuestionnaire, sleepHours: 7, sleepOnset: null, wakeTime: null }).hours, 7);
assert.equal(questionnaireRecoverySleep({ ...dstQuestionnaire, sleepHours: 25 }), null);
assert.equal(questionnaireRecoverySleep({ ...dstQuestionnaire, status: "in_progress" }), null);

console.log("Recovery Index verified: manual and wearable sleep, duplicate/corrected nights, local dates/DST, optional check-ins, robust source-specific baselines, sparse/invalid inputs and opt-out.");

const currentZone = "America/Toronto";
const currentDate = localDateInZone(Date.now(), currentZone);
const legacyDate = shiftDate(currentDate, -5);
const legacySnapshot = { localDate: legacyDate, sri: 45, ori: 90, sriVersion: "sri_v1", oriVersion: null, inputCount: 3, computedAt: `${legacyDate}T12:00:00Z` };
const sqlite = new DatabaseSync(":memory:");
const db = {
  async execAsync(sql) { sqlite.exec(sql); },
  async getFirstAsync(sql, params = []) { return sqlite.prepare(sql).get(...params) ?? null; },
  async getAllAsync(sql, params = []) { return sqlite.prepare(sql).all(...params); },
  async runAsync(sql, params = []) {
    const { changes, lastInsertRowid } = sqlite.prepare(sql).run(...params);
    return { changes: Number(changes), lastInsertRowId: Number(lastInsertRowid) };
  },
  async withTransactionAsync(task) {
    sqlite.exec("BEGIN");
    try { await task(); sqlite.exec("COMMIT"); }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
await db.execAsync(recoveryMigrationSql);
await db.runAsync("INSERT INTO recovery_snapshots(owner_id,local_date,snapshot_json) VALUES (?,?,?)", ["device-local", legacyDate, JSON.stringify(legacySnapshot)]);
await migrateDatabase(db);
const savedLegacy = await db.getFirstAsync("SELECT snapshot_json FROM recovery_snapshots WHERE owner_id=? AND local_date=?", ["device-local", legacyDate]);
assert.deepEqual(JSON.parse(savedLegacy.snapshot_json), legacySnapshot);
assert.deepEqual(await listSnapshots(db), [legacySnapshot], "reading the legacy cache preserves its original version and score");
const manualCheckIn = { ...createEmptyQuestionnaire(currentDate, currentZone), trainingCheckInVersion: 1, readiness: 8, sleepHours: 7,
  awakenings: null, sleepQuality: null, fatigue: null, soreness: null, stress: null, motivation: null, mood: null };
await saveQuestionnaire(db, manualCheckIn, true);
await setSleepTarget(db, currentDate, currentZone, 8);
const questionnaires = await listQuestionnaires(db);
const sleepTargets = await listSleepTargets(db);
const manualOnly = recoveryInputs({ questionnaires, sleepTargets, measurements: [], health: null, preferred: {} });
const now = Date.now();
assert.equal(manualOnly.calculate(currentDate, now).index.value, 65);
assert.equal(manualOnly.calculate(currentDate, now).method, "Manual");
assert.equal(manualOnly.calculate(legacyDate, now).index.value, null);
assert.equal(manualOnly.calculate(legacyDate, now).sleep.targetHours, null);
await setPreferredSources(db, { sleep_duration: "Watch" });
await deleteImportedHealth(db, "healthkit");
assert.deepEqual((await listSnapshots(db)).find(snapshot => snapshot.localDate === legacyDate), legacySnapshot, "unrelated preference refresh and import deletion retain the snapshot-only day");
sqlite.close();

const readinessOnly = { ...createEmptyQuestionnaire(localDate, currentZone), readiness: 8, status: "completed", completedAt: checkIn.availableAt };
const health = { status: "ready", platform: "health_connect", capabilities: {} };
const deviceOnlySleep = { questionnaires: [readinessOnly], sleepTargets: [{ effectiveDate: localDate, hours: 8 }], measurements: duplicateSleep, preferred: {}, health };
assert.equal(recoveryInputs(deviceOnlySleep).calculate(localDate, asOf).method, "Wearable assisted");
const disconnected = recoveryInputs({ ...deviceOnlySleep, health: { ...health, status: "not_connected" } });
assert.equal(disconnected.calculate(localDate, asOf).index.value, null);
assert.equal(disconnected.permitted.length, 0);
const denied = recoveryInputs({ ...deviceOnlySleep, health: { ...health, capabilities: { sleep_duration: "Read permission not granted." } } });
assert.equal(denied.calculate(localDate, asOf).sleep.severity.reasonCodes.includes("opted-out"), true);
assert.equal(denied.permitted.length, 0);
assert.equal(recoveryInputs({ ...deviceOnlySleep, health: { ...health, platform: "healthkit" } }).calculate(localDate, asOf).index.value, null);
console.log("Recovery migration and live record adapters verified: retained legacy cache, persisted manual score, dated sleep target and per-field source permission.");
