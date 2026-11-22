import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "../src/data/database.ts";
import { recoveryMigrationSql } from "../src/data/recoveryMigration.ts";
import { deleteImportedHealth, getHealthState, getPreferredSources, getQuestionnaire, listMeasurements, listQuestionnaires, listSnapshots, listWeights, saveQuestionnaire, setHealthState, setPreferredSources, upsertHealthBatch } from "../src/data/recoveryRepository.ts";
import { calculateSRI, createEmptyQuestionnaire, hrr60, lnRMSSD, manualSleep, personalBaseline, rmssd, sleepEfficiency, sleepTimingSd, standardizedDeviation, validateQuestionnaire } from "../src/recovery/calculations.ts";
import { fixedOffsetTimezone, isQuarterHour, isValidTimezone, localDateInZone, shiftDate } from "../src/recovery/dates.ts";

function adapterFor(sqlite) {
  return {
    async execAsync(sql) { sqlite.exec(sql); },
    async getFirstAsync(sql, params = []) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, params = []) { return sqlite.prepare(sql).all(...params); },
    async runAsync(sql, params = []) { const result = sqlite.prepare(sql).run(...params); return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }; },
    async withTransactionAsync(task) { sqlite.exec("BEGIN"); try { await task(); sqlite.exec("COMMIT"); } catch (error) { sqlite.exec("ROLLBACK"); throw error; } },
  };
}
const blank = createEmptyQuestionnaire("2026-11-21", "America/Toronto");
assert.equal(blank.fatigue, 5);
assert.equal(blank.awakenings, 0);
assert.equal(blank.mood, 5);
assert.equal(calculateSRI(blank), 53);
const sample = { ...blank, sriVersion: "sri_v1", sleepOnset: "2026-11-20T23:00:00-05:00", wakeTime: "2026-11-21T07:00:00-05:00", awakenings: 1, sleepQuality: 7, fatigue: 3, soreness: 4, stress: 2, motivation: 8 };
assert.equal(calculateSRI(sample), 73);
assert.equal(calculateSRI({ ...sample, mood: 0 }), 73);
assert.equal(calculateSRI({ ...sample, awakenings: 0, sleepQuality: 0, fatigue: 0, soreness: 0, stress: 0, motivation: 0 }), 67);
assert.equal(calculateSRI({ ...sample, sleepQuality: 1.5 }), null);
assert.equal(validateQuestionnaire(sample, true).length, 0);
assert.ok(validateQuestionnaire({ ...sample, awakenings: -1 }, true).length);
assert.equal(validateQuestionnaire({ ...sample, wakeTime: "2026-11-21T07:07:00-05:00" }, true).length, 0);
assert.ok(validateQuestionnaire({ ...sample, wakeTime: "2026-11-22T07:00:00-05:00" }, true).length);
assert.ok(validateQuestionnaire({ ...sample, timezone: "No/SuchZone" }, true).length);
assert.deepEqual(manualSleep(sample), { intervalMinutes: 480, asleepMinutes: null });
assert.deepEqual(manualSleep({ ...sample, minutesAwake: 30 }), { intervalMinutes: 480, asleepMinutes: 450 });
assert.equal(manualSleep({ ...sample, sleepOnset: "2026-03-07T23:00:00-05:00", wakeTime: "2026-03-08T07:00:00-04:00" }).intervalMinutes, 420);
assert.equal(manualSleep({ ...sample, sleepOnset: "2026-10-31T23:00:00-04:00", wakeTime: "2026-11-01T07:00:00-05:00" }).intervalMinutes, 540);
assert.equal(localDateInZone("2026-11-21T02:00:00Z", "America/Toronto"), "2026-11-20");
assert.equal(fixedOffsetTimezone("-05:00"), "UTC-05:00");
assert.equal(fixedOffsetTimezone("+05:30"), "UTC+05:30");
assert.equal(fixedOffsetTimezone("Z"), "UTC+00:00");
assert.equal(fixedOffsetTimezone("UTC-00:00"), "UTC+00:00");
assert.equal(fixedOffsetTimezone("UTC+14:00"), "UTC+14:00");
assert.equal(fixedOffsetTimezone("+14:30"), null);
assert.equal(fixedOffsetTimezone("-14:30"), null);
assert.equal(fixedOffsetTimezone("UTC+15:00"), null);
assert.equal(fixedOffsetTimezone("America/Toronto"), null);
assert.equal(isValidTimezone("UTC-05:00"), true);
assert.equal(isValidTimezone("UTC+14:30"), false);
// Source offsets determine historical acquisition days independently of import/device zone.
assert.equal(localDateInZone("2026-11-21T02:00:00Z", "UTC-05:00"), "2026-11-20");
assert.equal(localDateInZone("2026-11-20T20:00:00Z", "UTC+05:30"), "2026-11-21");
assert.equal(isQuarterHour("2026-11-20T20:15:00Z", "UTC+05:30"), true);
assert.equal(isQuarterHour("2026-11-20T20:16:00Z", "UTC+05:30"), false);
assert.equal(isQuarterHour("2026-11-20T20:15:00Z", "UTC+14:30"), false);
assert.equal(shiftDate("2024-03-01", -1), "2024-02-29");
assert.equal(sleepEfficiency(450, null), null);
assert.equal(sleepEfficiency(450, 500), 90);
assert.equal(sleepEfficiency(501, 500), null);
assert.equal(hrr60(182, 140, "cycle-seated-60s", "cycle-seated-60s"), 42);
assert.equal(hrr60(182, 140, "cycle", "run"), null);
assert.equal(lnRMSSD(0), null);
assert.equal(lnRMSSD(40, "SDNN"), null);
assert.equal(lnRMSSD(Math.E), 1);
assert.equal(rmssd([1000, 1010, 1000]), 10);
assert.equal(rmssd([1000]), null);
assert.ok(Math.abs(sleepTimingSd([1430, 10], 0) - Math.sqrt(200)) < 1e-10);

assert.equal(standardizedDeviation(61, 55, 3), 2);
assert.equal(standardizedDeviation(61, 55, 0), null);

const measurement = (day, value = 55, extra = {}) => ({ id: `rhr-${day}`, metric: "rhr", value, unit: "bpm", measuredAt: `${day}T12:00:00Z`, recordedAt: `${day}T13:00:00Z`, localDate: day, timezone: "UTC", platform: "healthkit", source: "watch", externalId: `rhr-${day}`, subtype: null, protocol: null, quality: "valid", ...extra });
const today = measurement("2026-11-21", 61);
const previous = [measurement("2026-11-19", 52), measurement("2026-11-20", 58)];
const base = personalBaseline(today, [...previous, today], 2);
assert.equal(base.mean, 55);
assert.ok(Math.abs(base.sd - Math.sqrt(18)) < 1e-10);
assert.equal(personalBaseline(today, previous).zScore, null);
assert.equal(personalBaseline(today, [measurement("2026-11-19"), measurement("2026-11-20")], 2).zScore, null);
assert.equal(personalBaseline(today, [...previous, measurement("2026-11-18", 200, { source: "other" })], 2).count, 2);
const hrv = measurement("2026-11-21", 40, { metric: "hrv", unit: "ms", subtype: "RMSSD" });
assert.equal(personalBaseline(hrv, [measurement("2026-11-20", 40, { metric: "hrv", unit: "ms", subtype: "SDNN" })]).count, 0);

const sqlite = new DatabaseSync(":memory:");
const db = adapterFor(sqlite);
await migrateDatabase(db);
assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 10);
await migrateDatabase(db);
await db.execAsync(recoveryMigrationSql);
sqlite.exec("INSERT INTO timeline_entries(id,kind,title,start_at,status,created_at,updated_at) VALUES (1,'weight','Weight',1000,'completed',1000,1000); INSERT INTO weight_logs(timeline_entry_id,weight_kg) VALUES (1,72.5); PRAGMA user_version=9;");
await migrateDatabase(db);
assert.equal(sqlite.prepare("PRAGMA user_version").get().user_version, 10);
assert.deepEqual(await listWeights(db), [{ measuredAt: 1000, kg: 72.5 }]);
assert.equal(await getQuestionnaire(db, sample.localDate), null);
const draft = await saveQuestionnaire(db, blank, false);
assert.equal(draft.status, "in_progress");
assert.equal(draft.sleepQuality, 5);
let completed = await saveQuestionnaire(db, { ...sample, revision: draft.revision }, true);
assert.equal(completed.status, "completed");
assert.ok(completed.completedAt);
assert.equal((await listSnapshots(db))[0].sri, 70);
assert.equal((await listSnapshots(db))[0].sriVersion, "sri_v2");
assert.equal((await listSnapshots(db))[0].ori, null);
const edited = await saveQuestionnaire(db, { ...completed, fatigue: 10 }, true);
assert.equal(edited.revision, 3);
assert.equal((await listSnapshots(db))[0].sri, calculateSRI(edited));
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM daily_questionnaires").get().n, 1);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM questionnaire_revisions").get().n, 3);
await assert.rejects(() => saveQuestionnaire(db, completed, true), /changed elsewhere/);
await assert.rejects(() => saveQuestionnaire(db, { ...edited, sleepQuality: null }, true), /sleepQuality/);
assert.equal(await getQuestionnaire(db, "2026-11-22"), null);
assert.equal((await listQuestionnaires(db)).length, 1);
assert.deepEqual(await listWeights(db), [{ measuredAt: 1000, kg: 72.5 }]);

const state = { platform: "healthkit", status: "ready", cursor: "first", lastSuccessfulSync: "2026-11-21T14:00:00Z", error: null, capabilities: { rhr: "supported" } };
await upsertHealthBatch(db, { platform: "healthkit", measurements: [today, ...previous], deletedExternalIds: [], state });
await upsertHealthBatch(db, { platform: "healthkit", measurements: [today], deletedExternalIds: [], state });
assert.equal((await listMeasurements(db)).length, 3);
assert.equal((await getHealthState(db, "healthkit")).cursor, "first");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM metric_baselines").get().n, 3);
assert.equal(JSON.parse(sqlite.prepare("SELECT baseline_json FROM metric_baselines WHERE local_date='2026-11-21'").get().baseline_json).mean, 55);
assert.ok((await listSnapshots(db)).every((s) => s.ori === null));
await setPreferredSources(db, { rhr: "watch" });
assert.deepEqual(await getPreferredSources(db), { rhr: "watch" });
await upsertHealthBatch(db, { platform: "healthkit", measurements: [measurement("2026-11-20", 57)], deletedExternalIds: [previous[0].externalId], state: { ...state, cursor: "second" } });
assert.equal((await listMeasurements(db)).length, 2);
assert.equal((await listMeasurements(db)).find((item) => item.localDate === "2026-11-20").value, 57);
assert.equal((await getHealthState(db, "healthkit")).cursor, "second");
assert.equal(JSON.parse(sqlite.prepare("SELECT baseline_json FROM metric_baselines WHERE local_date='2026-11-21'").get().baseline_json).mean, 57);
await upsertHealthBatch(db, { platform: "healthkit", measurements: [today], deletedExternalIds: [], state: { ...state, cursor: "reconciled" }, replaceWindow: { from: "2026-11-19T00:00:00Z", to: "2026-11-22T00:00:00Z", metrics: ["rhr"] } });
assert.equal((await listMeasurements(db)).length, 1);
assert.equal((await getHealthState(db, "healthkit")).cursor, "reconciled");
await assert.rejects(() => upsertHealthBatch(db, { platform: "healthkit", measurements: [{ ...today, unit: "wrong" }], deletedExternalIds: [], state: { ...state, cursor: "bad" } }), /canonical unit/);
assert.equal((await getHealthState(db, "healthkit")).cursor, "reconciled");
// Simulated disk failure after a batch has started proves sample + cursor rollback.
const failing = { ...db, runAsync: async (sql, params) => { if (sql.startsWith("INSERT INTO health_connections")) throw new Error("disk full"); return db.runAsync(sql, params); } };
await assert.rejects(() => upsertHealthBatch(failing, { platform: "healthkit", measurements: [measurement("2026-11-18")], deletedExternalIds: [], state }), /disk full/);
assert.equal((await listMeasurements(db)).length, 1);
await setHealthState(db, { ...state, status: "sync_error", error: "Read failed" });
assert.equal((await listMeasurements(db)).length, 1);
await deleteImportedHealth(db, "healthkit");
assert.equal((await listMeasurements(db)).length, 0);
assert.equal((await listQuestionnaires(db)).length, 1);
assert.equal((await getHealthState(db, "healthkit")).cursor, null);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM metric_baselines").get().n, 0);
console.log("recovery checks passed");

// A complete native biometric history produces ORI and upstream deletion removes eligibility.
const oriSamples = [];
for (let i=0;i<=14;i++) { const date=shiftDate("2026-10-30",-i); for (const [metric,value,unit] of [["hrv",50,"ms"],["rhr",60,"bpm"],["sleep_duration",480,"min"]]) oriSamples.push({id:metric+date,externalId:metric+date,metric,value,unit,measuredAt:date+"T10:00:00Z",recordedAt:date+"T11:00:00Z",localDate:date,timezone:"UTC",platform:"healthkit",source:"watch",subtype:metric==="hrv"?"SDNN":null,protocol:null,quality:"valid"}); }
await upsertHealthBatch(db,{platform:"healthkit",measurements:oriSamples,deletedExternalIds:[],state});
assert.equal((await listSnapshots(db)).find(s=>s.localDate==="2026-10-30").ori,100);
await upsertHealthBatch(db,{platform:"healthkit",measurements:[],deletedExternalIds:["hrv2026-10-30"],state});
assert.equal((await listSnapshots(db)).find(s=>s.localDate==="2026-10-30").ori,null);
console.log("Persisted ORI and deletion invalidation verified");

// Weighted model boundaries, priorities and historical version isolation.
const v2 = {...sample, sriVersion:'sri_v2',mood:5};
assert.equal(calculateSRI(v2),70);
assert.equal(calculateSRI({...v2,mood:null}),null);
assert.equal(calculateSRI({...v2,sleepQuality:10,fatigue:0,soreness:0,stress:0,motivation:10,mood:10,awakenings:0}),100);
assert.equal(calculateSRI({...v2,sleepQuality:0,fatigue:10,soreness:10,stress:10,motivation:0,mood:0,awakenings:10}),0);
assert.ok(calculateSRI({...blank,sleepQuality:10})-calculateSRI(blank) > calculateSRI({...blank,motivation:10})-calculateSRI(blank));
assert.equal(calculateSRI({...v2,awakenings:10}),calculateSRI({...v2,awakenings:25}));
const oldSqlite = new DatabaseSync(':memory:'); const oldDb=adapterFor(oldSqlite); await migrateDatabase(oldDb);
const legacy={...sample,mood:null,status:'completed',revision:1,completedAt:'2026-11-21T13:00:00Z'};delete legacy.sriVersion;
oldSqlite.prepare('INSERT INTO daily_questionnaires(owner_id,local_date,timezone,status,revision,completed_at,response_json,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('device-local',legacy.localDate,legacy.timezone,legacy.status,1,legacy.completedAt,JSON.stringify(legacy),legacy.completedAt);
oldSqlite.prepare('INSERT INTO questionnaire_revisions(owner_id,local_date,revision,response_json,recorded_at) VALUES (?,?,?,?,?)').run('device-local',legacy.localDate,1,JSON.stringify(legacy),legacy.completedAt);
await upsertHealthBatch(oldDb,{platform:'healthkit',measurements:[],deletedExternalIds:[],state});
assert.equal((await listSnapshots(oldDb))[0].sri,73);assert.equal((await listSnapshots(oldDb))[0].sriVersion,'sri_v1');
await saveQuestionnaire(oldDb,{...legacy,mood:5},true);
assert.equal((await listSnapshots(oldDb))[0].sri,70);assert.equal((await listSnapshots(oldDb))[0].sriVersion,'sri_v2');
assert.equal(oldSqlite.prepare('SELECT COUNT(*) AS n FROM questionnaire_revisions').get().n,2);
console.log('Weighted SRI v2 defaults/priorities/minute input and legacy score preservation verified');
