import type { HealthMeasurement } from "../recovery/types";
import { localDateAt, normalizeSleep, reconcileStages, validTimezone } from "./normalization";
import { unavailableCapabilities, type HealthAdapter, type SleepCache, type SleepStage } from "./types";

type HealthKit = typeof import("@kingstinct/react-native-healthkit");
const quantities = [
  { identifier: "HKQuantityTypeIdentifierRestingHeartRate", metric: "rhr", nativeUnit: "count/min", unit: "bpm", subtype: null },
  { identifier: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", metric: "hrv", nativeUnit: "ms", unit: "ms", subtype: "SDNN" },
  { identifier: "HKQuantityTypeIdentifierRespiratoryRate", metric: "respiratory_rate", nativeUnit: "count/min", unit: "breaths/min", subtype: null },
] as const;
const sleepIdentifier = "HKCategoryTypeIdentifierSleepAnalysis" as const;
const readTypes = [...quantities.map((item) => item.identifier), sleepIdentifier];
type Cursor = { version: 1; from: string; anchors: Record<string, string>; sleep: SleepCache };

export function createAppleHealthAdapter(hk: HealthKit): HealthAdapter {
  return {
    platform: "healthkit",
    async availability() {
      const available = await hk.isHealthDataAvailableAsync();
      return { available, reason: available ? null : "HealthKit is unavailable on this device." };
    },
    async requestReadPermission() {
      // Completion does not reveal individual HealthKit read authorization decisions.
      const completed = await hk.requestAuthorization({ toRead: readTypes });
      if (!completed) throw new Error("HealthKit authorization did not complete.");
    },
    async read(state) {
      const now = new Date().toISOString();
      let cursor: Cursor = { version: 1, from: new Date(Date.now() - 28 * 86_400_000).toISOString(), anchors: {}, sleep: { stages: [], emittedIds: [] } };
      if (state?.cursor) {
        try {
          const saved = JSON.parse(state.cursor) as Cursor;
          if (saved.version === 1 && saved.from && saved.anchors && Array.isArray(saved.sleep?.stages) && Array.isArray(saved.sleep?.emittedIds)) cursor = saved;
        } catch { /* Reimport the authorized recent window without deleting retained measurements. */ }
      }
      const errors: string[] = [];
      const measurements: HealthMeasurement[] = [];
      const deletedExternalIds: string[] = [];
      const capabilities: Record<string, string> = { ...unavailableCapabilities };
      for (const config of quantities) {
        try {
          const result = await hk.queryQuantitySamplesWithAnchor(config.identifier, {
            anchor: cursor.anchors[config.identifier], limit: 0, unit: config.nativeUnit,
            filter: { date: { startDate: new Date(cursor.from) } },
          });
          for (const sample of result.samples) {
            if (!Number.isFinite(sample.quantity)) continue;
            const timezone = validTimezone(sample.metadata.HKTimeZone);
            const measuredAt = sample.startDate.toISOString();
            const sourceApp = sample.sourceRevision.source.bundleIdentifier;
            const sourceDevice = sample.device?.localIdentifier ?? sample.device?.model ?? sample.sourceRevision.productType;
            const source = `${sourceApp}${sourceDevice ? ` / ${sourceDevice}` : ""}`;
            measurements.push({ id: `healthkit:${sample.uuid}:${config.metric}`, metric: config.metric, value: sample.quantity,
              unit: config.unit, measuredAt, measuredUntil: sample.endDate.toISOString(), recordedAt: now,
              localDate: localDateAt(sample.endDate.toISOString(), timezone), timezone, platform: "healthkit", source, sourceApp, sourceDevice,
              externalId: sample.uuid, subtype: config.subtype, protocol: null, quality: sample.metadata.HKWasUserEntered === true ? "unverified" : "valid",
              metadata: { nativeType: config.identifier, originalUnit: sample.unit, originalMetadata: sample.metadata,
                sourceName: sample.sourceRevision.source.name, timezoneBasis: sample.metadata.HKTimeZone ? "source" : "device_at_import" } });
          }
          deletedExternalIds.push(...result.deletedSamples.map((sample) => sample.uuid));
          cursor.anchors[config.identifier] = result.newAnchor;
          capabilities[config.metric] = "Read requested; no suitable sample can also mean unavailable or unshared data.";
        } catch {
          capabilities[config.metric] = "sync_error";
          errors.push(`${config.metric}: HealthKit read failed; retained previous records.`);
        }
      }
      try {
        const result = await hk.queryCategorySamplesWithAnchor(sleepIdentifier, { anchor: cursor.anchors[sleepIdentifier], limit: 0,
          filter: { date: { startDate: new Date(cursor.from) } } });
        const stages: SleepStage[] = result.samples.map((sample) => {
          const sourceApp = sample.sourceRevision.source.bundleIdentifier;
          const sourceDevice = sample.device?.localIdentifier ?? sample.device?.model ?? sample.sourceRevision.productType;
          return { id: sample.uuid, source: `${sourceApp}${sourceDevice ? ` / ${sourceDevice}` : ""}`, sourceApp, sourceDevice,
            start: sample.startDate.toISOString(), end: sample.endDate.toISOString(), timezone: validTimezone(sample.metadata.HKTimeZone),
            nativeStage: sample.value, manuallyEntered: sample.metadata.HKWasUserEntered === true,
            kind: sample.value === 0 ? "in_bed" : sample.value === 2 ? "awake" : [1, 3, 4, 5].includes(sample.value) ? "asleep" : "unknown" };
        });
        cursor.sleep.stages = reconcileStages(cursor.sleep.stages, stages, result.deletedSamples.map((item) => item.uuid));
        const normalized = normalizeSleep("healthkit", cursor.sleep, now);
        // Replace derived sleep rows only when their underlying native records changed/deleted.
        deletedExternalIds.push(...cursor.sleep.emittedIds);
        measurements.push(...normalized.measurements);
        cursor.sleep.emittedIds = normalized.emittedIds;
        cursor.anchors[sleepIdentifier] = result.newAnchor;
        capabilities.sleep_duration = "Source-specific asleep stages; longest session assigned to local wake day.";
        capabilities.sleep_efficiency = "Requires in-bed and asleep intervals from the same source; otherwise unavailable.";
      } catch {
        errors.push("sleep: HealthKit read failed; retained previous records.");
        capabilities.sleep_duration = "sync_error";
        capabilities.sleep_efficiency = "sync_error";
      }
      return { measurements, deletedExternalIds, cursor: JSON.stringify(cursor), capabilities, errors };
    },
    subscribe(callback) {
      const subscriptions = readTypes.map((identifier) => hk.subscribeToChanges(identifier, callback));
      return () => subscriptions.forEach((subscription) => subscription.remove());
    },
  };
}
