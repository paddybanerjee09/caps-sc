import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { migrateDatabase } from "../src/data/database.ts";
import { addWeightLog, deleteWeightLog, getLatestWeightKg, getTimelineEntriesForDay, updateWeightLog } from "../src/data/timelineRepository.ts";
import { convertKilogramsToWeight, convertWeightToKilograms } from "../src/utils/weight.ts";

const db = new DatabaseSync(":memory:");
const bindParams = (params) => params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
const adapter = {
  async execAsync(sql) { db.exec(sql); },
  async getFirstAsync(sql, ...params) { return db.prepare(sql).get(...bindParams(params)) ?? null; },
  async getAllAsync(sql, ...params) { return db.prepare(sql).all(...bindParams(params)); },
  async runAsync(sql, ...params) {
    const result = db.prepare(sql).run(...bindParams(params));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  },
  async withTransactionAsync(task) {
    db.exec("BEGIN");
    try { await task(); db.exec("COMMIT"); }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  },
};
await migrateDatabase(adapter);
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 12);
assert.equal(await getLatestWeightKg(adapter), null);

const olderAt = new Date(2026, 9, 10, 8, 14).getTime();
const newerAt = new Date(2026, 9, 12, 19, 41).getTime();
const exactKg = 73.123456;
await addWeightLog(adapter, exactKg, newerAt);
const newerId = db.prepare("SELECT id FROM timeline_entries WHERE kind = 'weight'").get().id;
await addWeightLog(adapter, 72.25, olderAt);
const olderId = db.prepare("SELECT id FROM timeline_entries WHERE start_at = ?").get(olderAt).id;
assert.equal(await getLatestWeightKg(adapter), exactKg, "Backdating must not replace the latest measurement");
const dayStart = new Date(2026, 9, 10).getTime();
const dayEnd = new Date(2026, 9, 11).getTime();
const oldDay = await getTimelineEntriesForDay(adapter, dayStart, dayEnd);
assert.equal(oldDay.length, 1);
assert.equal(oldDay[0].id, olderId);
assert.equal(oldDay[0].startAt, olderAt, "Local timestamp keeps the selected hour and minute");
assert.equal(oldDay[0].weightKg, 72.25);

for (const unit of ["metric", "imperial"]) {
  const roundTrip = convertWeightToKilograms(convertKilogramsToWeight(exactKg, unit), unit);
  assert.ok(Math.abs(roundTrip - exactKg) < 1e-10, `${unit} boundary conversion should retain precision`);
}

await updateWeightLog(adapter, olderId, 74.5, newerAt + 60_000);
assert.equal(await getLatestWeightKg(adapter), 74.5, "Moving an entry updates chronological latest weight");
assert.equal((await getTimelineEntriesForDay(adapter, dayStart, dayEnd)).length, 0);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM weight_logs").get().n, 2, "An edit preserves the existing entry identity");
await deleteWeightLog(adapter, olderId);
assert.equal(await getLatestWeightKg(adapter), exactKg);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM weight_logs WHERE timeline_entry_id = ?").get(olderId).n, 0, "Deleting timeline parent cascades to its weight detail");

const beforeFailedInsert = db.prepare("SELECT COUNT(*) AS n FROM timeline_entries").get().n;
db.exec("CREATE TRIGGER fail_weight_insert BEFORE INSERT ON weight_logs BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
await assert.rejects(addWeightLog(adapter, 80, olderAt), /injected failure/);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM timeline_entries").get().n, beforeFailedInsert, "A failed detail insert cannot leave an orphan timeline marker");
db.exec("DROP TRIGGER fail_weight_insert");
db.exec("CREATE TRIGGER fail_weight_edit BEFORE UPDATE ON weight_logs BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
await assert.rejects(updateWeightLog(adapter, newerId, 81, olderAt), /injected failure/);
assert.equal(db.prepare("SELECT start_at FROM timeline_entries WHERE id = ?").get(newerId).start_at, newerAt, "Failed edits roll back the timestamp too");
assert.equal(await getLatestWeightKg(adapter), exactKg);
db.exec("DROP TRIGGER fail_weight_edit");
for (const invalid of [0, -1, NaN, Infinity]) await assert.rejects(addWeightLog(adapter, invalid, olderAt));
await assert.rejects(updateWeightLog(adapter, newerId, 70, Date.now() + 60_000), /future/);
await deleteWeightLog(adapter, newerId);
assert.equal(await getLatestWeightKg(adapter), null);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM weight_logs").get().n, 0);
db.close();
console.log("Weight history verified: kg precision, local timestamps, backdating/latest, edit identity, cascade and transaction rollback.");
