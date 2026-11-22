import type { HealthMeasurement } from "../recovery/types";
import { deviceTimezone, localDateAt, normalizeSleep, reconcileStages, timezoneFromOffset } from "./normalization";
import { unavailableCapabilities, type HealthAdapter, type SleepCache, type SleepStage } from "./types";

type HealthConnect = typeof import("react-native-health-connect");
type NativeRecord = import("react-native-health-connect").HealthConnectRecordResult;
const recordTypes = ["RestingHeartRate", "HeartRateVariabilityRmssd", "RespiratoryRate", "SleepSession"] as const;
type Cursor = { version: 1; from: string; token?: string; permissionKey: string; sleep: SleepCache };

async function readPage(hc: HealthConnect, type: typeof recordTypes[number], options: import("react-native-health-connect").ReadRecordsOptions) {
  // The bridge deliberately omits recordType from readRecords results; restore its known discriminator.
  switch (type) {
    case "RestingHeartRate": { const page = await hc.readRecords(type, options); return { ...page, records: page.records.map((record) => ({ ...record, recordType: type })) }; }
    case "HeartRateVariabilityRmssd": { const page = await hc.readRecords(type, options); return { ...page, records: page.records.map((record) => ({ ...record, recordType: type })) }; }
    case "RespiratoryRate": { const page = await hc.readRecords(type, options); return { ...page, records: page.records.map((record) => ({ ...record, recordType: type })) }; }
    case "SleepSession": { const page = await hc.readRecords(type, options); return { ...page, records: page.records.map((record) => ({ ...record, recordType: type })) }; }
  }
}

export function createHealthConnectAdapter(hc: HealthConnect): HealthAdapter {
  return {
    platform: "health_connect",
    async availability() {
      const available = await hc.getSdkStatus() === hc.SdkAvailabilityStatus.SDK_AVAILABLE && await hc.initialize();
      return { available, reason: available ? null : "Health Connect is unavailable or needs an update on this device." };
    },
    async requestReadPermission() { await hc.requestPermission(recordTypes.map((recordType) => ({ accessType: "read", recordType }))); },
    async read(state) {
      const now = new Date().toISOString();
      const permissions = await hc.getGrantedPermissions();
      const granted = recordTypes.filter((recordType) => permissions.some((permission) => permission.accessType === "read" && permission.recordType === recordType));
      const permissionKey = granted.join(",");
      const capabilities: Record<string, string> = { ...unavailableCapabilities };
      for (const [recordType, metric] of [["RestingHeartRate", "rhr"], ["HeartRateVariabilityRmssd", "hrv"], ["RespiratoryRate", "respiratory_rate"], ["SleepSession", "sleep_duration"], ["SleepSession", "sleep_efficiency"]] as const) {
        capabilities[metric] = granted.some((type) => type === recordType) ? "Read permitted; suitable source data may be absent." : "Read permission not granted.";
      }
      let cursor: Cursor = { version: 1, from: new Date(Date.now() - 28 * 86_400_000).toISOString(), permissionKey, sleep: { stages: [], emittedIds: [] } };
      if (state?.cursor) {
        try { const saved = JSON.parse(state.cursor) as Cursor; if (saved.version === 1 && Array.isArray(saved.sleep?.stages) && Array.isArray(saved.sleep?.emittedIds)) cursor = saved; } catch { /* Authorized recent backfill; never wipe retained data on corrupt cursor. */ }
      }
      if (cursor.permissionKey !== permissionKey) { cursor.token = undefined; cursor.permissionKey = permissionKey; }
      if (!granted.length) return { measurements: [], deletedExternalIds: [], cursor: JSON.stringify(cursor), capabilities, errors: ["No Health Connect read categories are permitted; retained imported records."] };
      const recordMap = new Map<string, NativeRecord>();
      const deletedIds = new Set<string>();
      let token = cursor.token;
      // Get a change token before initial backfill so records changing during the read are not lost.
      if (!token) {
        const initial = await hc.getChanges({ recordTypes: [...granted] });
        for (const { record } of initial.upsertionChanges) if (record.metadata?.id) recordMap.set(record.metadata.id, record);
        for (const { recordId } of initial.deletionChanges) { recordMap.delete(recordId); deletedIds.add(recordId); }
        token = initial.nextChangesToken;
        for (const recordType of granted) {
          let pageToken: string | undefined;
          do {
            const page = await readPage(hc, recordType, { timeRangeFilter: { operator: "between", startTime: cursor.from, endTime: now }, pageSize: 1000, pageToken });
            for (const record of page.records) if (record.metadata?.id) { recordMap.set(record.metadata.id, record); deletedIds.delete(record.metadata.id); }
            pageToken = page.pageToken || undefined;
          } while (pageToken);
        }
      }
      let more: boolean;
      do {
        const changes = await hc.getChanges({ changesToken: token, recordTypes: [...granted] });
        if (changes.changesTokenExpired) {
          // Do not claim deletion reconciliation for history no longer exposed by the platform.
          cursor.token = undefined;
          return { measurements: [], deletedExternalIds: [], cursor: JSON.stringify(cursor), capabilities, errors: ["Health Connect change token expired. Refresh again to backfill the authorized recent window; older retained history may need reimport."] };
        }
        for (const { record } of changes.upsertionChanges) if (record.metadata?.id) {
          recordMap.set(record.metadata.id, record);
          deletedIds.delete(record.metadata.id);
        }
        for (const { recordId } of changes.deletionChanges) { recordMap.delete(recordId); deletedIds.add(recordId); }
        token = changes.nextChangesToken;
        more = changes.hasMore;
      } while (more);
      const deletedExternalIds = [...deletedIds];
      const measurements: HealthMeasurement[] = [];
      const sleepUpserts: SleepStage[] = [];
      const sleepChangedRecordIds: string[] = [];
      for (const record of recordMap.values()) {
        const externalId = record.metadata?.id;
        if (!externalId) continue;
        const sourceApp = record.metadata?.dataOrigin ?? "unknown_health_connect_source";
        const sourceDevice = [record.metadata?.device?.manufacturer, record.metadata?.device?.model].filter(Boolean).join(" ") || undefined;
        const source = `${sourceApp}${sourceDevice ? ` / ${sourceDevice}` : ""}`;
        if (record.recordType === "SleepSession") {
          // v4.1.3's Kotlin ReactSleepSessionRecord emits both fields, although its TS interface omits them.
          const offsets = record as typeof record & { startZoneOffset?: unknown; endZoneOffset?: unknown };
          const sourceTimezone = timezoneFromOffset(offsets.endZoneOffset);
          const timezone = sourceTimezone ?? deviceTimezone();
          const timezoneBasis = sourceTimezone ? "session_end_offset" as const : "device_at_import" as const;
          sleepChangedRecordIds.push(externalId);
          // Preserve the source session's explicit wake boundary without treating its window as asleep/in-bed.
          sleepUpserts.push({ id: externalId, sessionId: externalId, source, sourceApp, sourceDevice,
            start: record.startTime, end: record.endTime, timezone, timezoneBasis, kind: "unknown",
            originalStartZoneOffset: offsets.startZoneOffset ?? null, originalEndZoneOffset: offsets.endZoneOffset ?? null });
          for (const stage of record.stages ?? []) sleepUpserts.push({ id: externalId, sessionId: externalId, source, sourceApp, sourceDevice,
            start: stage.startTime, end: stage.endTime, timezone, timezoneBasis,
            originalStartZoneOffset: offsets.startZoneOffset ?? null, originalEndZoneOffset: offsets.endZoneOffset ?? null,
            nativeStage: stage.stage, manuallyEntered: record.metadata?.recordingMethod === 3,
            kind: [2, 4, 5, 6].includes(stage.stage) ? "asleep" : stage.stage === 1 ? "awake" : "unknown" });
          continue;
        }
        if (!["RestingHeartRate", "HeartRateVariabilityRmssd", "RespiratoryRate"].includes(record.recordType)) continue;
        const normalized = record.recordType === "RestingHeartRate" ? { metric: "rhr" as const, value: record.beatsPerMinute, unit: "bpm", subtype: null }
          : record.recordType === "HeartRateVariabilityRmssd" ? { metric: "hrv" as const, value: record.heartRateVariabilityMillis, unit: "ms", subtype: "RMSSD" }
          : record.recordType === "RespiratoryRate" ? { metric: "respiratory_rate" as const, value: record.rate, unit: "breaths/min", subtype: null } : null;
        if (!normalized || !("time" in record)) continue;
        const sourceTimezone = timezoneFromOffset(record.zoneOffset);
        const timezone = sourceTimezone ?? deviceTimezone();
        const measuredAt = new Date(record.time).toISOString();
        measurements.push({ ...normalized, id: `health_connect:${externalId}:${normalized.metric}`, platform: "health_connect", externalId,
          source, sourceApp, sourceDevice, measuredAt, recordedAt: now,
          localDate: localDateAt(measuredAt, timezone), timezone, protocol: null, quality: record.metadata?.recordingMethod === 3 ? "unverified" : "valid",
          metadata: { originalRecordType: record.recordType, originalMetadata: record.metadata, originalMeasuredAt: record.time, timezoneBasis: sourceTimezone ? "source_offset" : "device_at_import", originalZoneOffset: record.zoneOffset ?? null } });
      }
      cursor.sleep.stages = reconcileStages(cursor.sleep.stages, sleepUpserts, [...deletedExternalIds, ...sleepChangedRecordIds]);
      if (granted.includes("SleepSession")) {
        const normalized = normalizeSleep("health_connect", cursor.sleep, now);
        deletedExternalIds.push(...cursor.sleep.emittedIds);
        measurements.push(...normalized.measurements);
        cursor.sleep.emittedIds = normalized.emittedIds;
      }
      cursor.token = token;
      return { measurements, deletedExternalIds, cursor: JSON.stringify(cursor), capabilities, errors: [] };
    },
  };
}
