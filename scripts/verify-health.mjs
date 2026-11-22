import assert from "node:assert/strict";

import { createAppleHealthAdapter } from "../src/health/appleHealthAdapter.ts";
import { createHealthConnectAdapter } from "../src/health/healthConnectAdapter.ts";
import { localDateAt, normalizeSleep, reconcileStages, unionMinutes } from "../src/health/normalization.ts";

const now = "2026-11-21T14:00:00.000Z";
const stage = (id, start, end, kind = "asleep", source = "watch") => ({ id, start, end, kind, source, timezone: "America/Toronto" });
const asleep = stage("a", "2026-11-21T04:00:00Z", "2026-11-21T12:00:00Z");
const overlapping = stage("b", "2026-11-21T06:00:00Z", "2026-11-21T10:00:00Z");
assert.equal(unionMinutes([asleep, overlapping]), 480, "overlapping sleep stages are not counted twice");
assert.equal(unionMinutes([{ start: "invalid", end: now }]), 0);
assert.equal(localDateAt("2026-11-21T02:00:00Z", "America/Toronto"), "2026-11-20");
assert.equal(unionMinutes([stage("dst", "2026-11-01T00:00:00-04:00", "2026-11-01T08:00:00-05:00")]), 540, "DST uses elapsed time");
let normalized = normalizeSleep("healthkit", { stages: [asleep, overlapping], emittedIds: [] }, now);
assert.equal(normalized.measurements.length, 1, "asleep time alone cannot create efficiency");
assert.equal(normalized.measurements[0].value, 480);
assert.equal(normalized.measurements[0].localDate, "2026-11-21");
normalized = normalizeSleep("healthkit", { stages: [asleep, stage("bed", asleep.start, asleep.end, "in_bed", "phone")], emittedIds: [] }, now);
assert.equal(normalized.measurements.length, 1, "in-bed intervals from a different source cannot create efficiency");
normalized = normalizeSleep("healthkit", { stages: [asleep, stage("bed", asleep.start, asleep.end, "in_bed")], emittedIds: [] }, now);
assert.equal(normalized.measurements.find((item) => item.metric === "sleep_efficiency").value, 100);
normalized = normalizeSleep("healthkit", { stages: [asleep, stage("awake-conflict", asleep.start, asleep.end, "awake")], emittedIds: [] }, now);
assert.equal(normalized.measurements.length, 0, "conflicting asleep/awake stage coverage is rejected");
normalized = normalizeSleep("healthkit", { stages: [asleep, stage("bed-outside", "2026-11-20T20:00:00Z", "2026-11-21T04:00:00Z", "in_bed")], emittedIds: [] }, now);
assert.equal(normalized.measurements.some((item) => item.metric === "sleep_efficiency"), false, "asleep intervals must be covered by actual in-bed intervals");
assert.deepEqual(reconcileStages([asleep], [], ["a"]), []);

let round = 0;
const nativeSleep = {
  uuid: "native-sleep", startDate: new Date(asleep.start), endDate: new Date(asleep.end), value: 1,
  sourceRevision: { source: { name: "Watch", bundleIdentifier: "watch" } }, metadata: { HKTimeZone: "America/Toronto" },
};
const hk = createAppleHealthAdapter({
  isHealthDataAvailableAsync: async () => true,
  requestAuthorization: async ({ toRead }) => { assert.equal(toRead.length, 4); return true; },
  queryQuantitySamplesWithAnchor: async (type) => ({ samples: type.endsWith("HeartRateVariabilitySDNN") ? [{ ...nativeSleep, uuid: "hrv", quantity: 50, unit: "ms" }] : [], deletedSamples: [], newAnchor: `q${round}` }),
  queryCategorySamplesWithAnchor: async () => ({ samples: round ? [] : [nativeSleep], deletedSamples: round ? [{ uuid: "native-sleep" }] : [], newAnchor: `s${round}` }),
  subscribeToChanges: () => ({ remove() {} }),
});
await hk.requestReadPermission();
const first = await hk.read(null);
assert.equal(first.measurements.find((item) => item.metric === "hrv").subtype, "SDNN");
assert.equal(first.measurements.find((item) => item.metric === "sleep_duration").value, 480);
round = 1;
const second = await hk.read({ cursor: first.cursor });
assert.equal(second.measurements.filter((item) => item.metric === "sleep_duration").length, 0);
assert.ok(second.deletedExternalIds.includes(first.measurements.find((item) => item.metric === "sleep_duration").externalId), "deleted native sleep removes its derived daily observation");

const record = { recordType: "HeartRateVariabilityRmssd", time: now, heartRateVariabilityMillis: 42,
  metadata: { id: "rmssd", dataOrigin: "wearable", lastModifiedTime: now } };
let changeCalls = 0;
const hc = createHealthConnectAdapter({
  getGrantedPermissions: async () => [{ accessType: "read", recordType: "HeartRateVariabilityRmssd" }],
  getChanges: async () => ({ nextChangesToken: `token${++changeCalls}`, changesTokenExpired: false, hasMore: false,
    upsertionChanges: [], deletionChanges: changeCalls > 1 ? [{ recordId: "rmssd" }] : [] }),
  readRecords: async () => ({ records: [record] }),
});
const changes = await hc.read(null);
assert.equal(changes.measurements.length, 0, "a record deleted during backfill is not resurrected");
assert.ok(changes.deletedExternalIds.includes("rmssd"));
assert.equal(JSON.parse(changes.cursor).token, "token2");
const hcRmssd = createHealthConnectAdapter({
  getGrantedPermissions: async () => [{ accessType: "read", recordType: "HeartRateVariabilityRmssd" }],
  getChanges: async () => ({ nextChangesToken: "token", changesTokenExpired: false, hasMore: false, upsertionChanges: [], deletionChanges: [] }),
  readRecords: async () => ({ records: [record] }),
});
assert.equal((await hcRmssd.read(null)).measurements[0].subtype, "RMSSD");
const expired = createHealthConnectAdapter({
  getGrantedPermissions: async () => [{ accessType: "read", recordType: "HeartRateVariabilityRmssd" }],
  getChanges: async () => ({ nextChangesToken: "unused", changesTokenExpired: true, hasMore: false, upsertionChanges: [], deletionChanges: [] }),
});
const expiredResult = await expired.read({ cursor: JSON.stringify({ version: 1, from: now, token: "expired", permissionKey: "HeartRateVariabilityRmssd", sleep: { stages: [], emittedIds: [] } }) });
assert.equal(expiredResult.measurements.length, 0);
assert.equal(expiredResult.errors.length, 1);
assert.equal(JSON.parse(expiredResult.cursor).token, undefined, "expired cursor is reset without wiping imported data");
console.log("Health verification passed: source-isolated sleep, gaps, DST, native anchors, deletions, backfill race, RMSSD/SDNN, expired tokens.");
