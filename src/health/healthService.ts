import Constants from "expo-constants";
import type { SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";

import { deleteImportedHealth, getHealthState, setHealthState, upsertHealthBatch } from "../data/recoveryRepository";
import type { HealthPlatform, HealthState } from "../recovery/types";
import { createAppleHealthAdapter } from "./appleHealthAdapter";
import { createHealthConnectAdapter } from "./healthConnectAdapter";
import type { HealthAdapter } from "./types";

const activeSyncs = new WeakMap<SQLiteDatabase, Promise<HealthState>>();
const suspended = new WeakSet<SQLiteDatabase>();
const platform: HealthPlatform = Platform.OS === "android" ? "health_connect" : "healthkit";

function unsupported(reason: string): HealthAdapter {
  return { platform, availability: async () => ({ available: false, reason }),
    requestReadPermission: async () => { throw new Error(reason); },
    read: async () => { throw new Error(reason); } };
}

/** Native bridges must never be evaluated in Expo Go or on the other platform. */
export async function getHealthAdapter(): Promise<HealthAdapter> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return unsupported("Native health import requires an iOS or Android development build.");
  if (Constants.executionEnvironment === "storeClient") return unsupported("Health import needs a new native development build; it is unavailable in Expo Go.");
  try {
    if (Platform.OS === "ios") return createAppleHealthAdapter(await import("@kingstinct/react-native-healthkit"));
    return createHealthConnectAdapter(await import("react-native-health-connect"));
  } catch {
    return unsupported("The native health bridge is missing. Rebuild this app with its health configuration.");
  }
}

function initialState(): HealthState {
  return { platform, status: "not_connected", cursor: null, lastSuccessfulSync: null, error: null, capabilities: {} };
}

export function getCurrentHealthState(db: SQLiteDatabase): Promise<HealthState | null> { return getHealthState(db, platform); }

async function performSync(db: SQLiteDatabase, connect: boolean): Promise<HealthState> {
  const previous = await getHealthState(db, platform) ?? initialState();
  if (!connect && suspended.has(db)) return previous;
  if (!connect && previous.status === "not_connected") return previous;
  // An unavailable Expo Go connection attempt must not turn into an unauthorised native read after rebuilding.
  if (!connect && previous.capabilities.authorization_requested !== "true") return previous;
  let authorizationRequested = previous.capabilities.authorization_requested === "true";
  try {
    const adapter = await getHealthAdapter();
    const available = await adapter.availability();
    if (!available.available) {
      const state: HealthState = { ...previous, status: "unsupported", error: available.reason };
      await setHealthState(db, state);
      return state;
    }
    if (connect) { await adapter.requestReadPermission(); authorizationRequested = true; }
    const result = await adapter.read(previous);
    const state: HealthState = { platform, status: result.errors.length ? "sync_error" : "ready", cursor: result.cursor,
      lastSuccessfulSync: result.errors.length ? previous.lastSuccessfulSync : new Date().toISOString(),
      error: result.errors.join(" ") || null, capabilities: { ...result.capabilities, authorization_requested: "true" } };
    await upsertHealthBatch(db, { platform, measurements: result.measurements, deletedExternalIds: result.deletedExternalIds, state });
    return state;
  } catch {
    // No cursor advancement or destructive replacement after an incomplete read.
    const state: HealthState = { ...previous, status: "sync_error", error: "Health import could not finish. Check native availability and read permissions, then retry. Saved records were retained.",
      capabilities: { ...previous.capabilities, authorization_requested: authorizationRequested ? "true" : "false" } };
    await setHealthState(db, state);
    return state;
  }
}

function enqueueSync(db: SQLiteDatabase, connect: boolean): Promise<HealthState> {
  if (connect) suspended.delete(db);
  if (!connect && suspended.has(db)) return getHealthState(db, platform).then((state) => state ?? initialState());
  const pending = activeSyncs.get(db);
  if (pending && !connect) return pending;
  const operation = (pending ? pending.then(() => performSync(db, connect)) : performSync(db, connect));
  activeSyncs.set(db, operation);
  void operation.finally(() => { if (activeSyncs.get(db) === operation) activeSyncs.delete(db); }).catch(() => undefined);
  return operation;
}

export function connectHealth(db: SQLiteDatabase) { return enqueueSync(db, true); }
export function syncHealth(db: SQLiteDatabase) { return enqueueSync(db, false); }

/** Disconnect is local: platform read permissions and saved imported records are retained. */
export async function disconnectHealth(db: SQLiteDatabase): Promise<void> {
  suspended.add(db);
  await activeSyncs.get(db);
  const previous = await getHealthState(db, platform) ?? initialState();
  await setHealthState(db, { ...previous, status: "not_connected", error: null });
}

/** Explicit deletion also clears native cursors/raw sleep cache and prevents automatic reimport. */
export async function deleteHealthData(db: SQLiteDatabase): Promise<void> {
  await disconnectHealth(db);
  await deleteImportedHealth(db, platform);
  await setHealthState(db, initialState());
}

export async function subscribeHealthUpdates(db: SQLiteDatabase, callback: () => void): Promise<() => void> {
  const state = await getCurrentHealthState(db);
  if (!state || state.status !== "ready") return () => undefined;
  const adapter = await getHealthAdapter();
  try { return adapter.subscribe?.(callback) ?? (() => undefined); } catch { return () => undefined; }
}
