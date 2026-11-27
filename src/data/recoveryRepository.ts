import { calculateORI } from "../recovery/objectiveRecovery";
import type { SQLiteDatabase } from "expo-sqlite";
import { BASELINE_DAYS, SRI_VERSION, calculateSRI, comparableKey, personalBaseline, validateQuestionnaire } from "../recovery/calculations";
import { isInstant, isLocalDate, isValidTimezone, localDateInZone, shiftDate } from "../recovery/dates";
import type { HealthBatch, HealthMeasurement, HealthMetric, HealthPlatform, HealthState, PreferredSources, Questionnaire, RecoverySnapshot } from "../recovery/types";

/** This app has a single device-local athlete; this is not account authentication. */
const LOCAL_OWNER = "device-local";
const pendingWrites = new WeakMap<SQLiteDatabase, Promise<unknown>>();

function write<T>(db: SQLiteDatabase, action: () => Promise<T>): Promise<T> {
  const prior = pendingWrites.get(db) ?? Promise.resolve();
  const result = prior.catch(() => undefined).then(async () => {
    let value!: T;
    await db.withTransactionAsync(async () => { value = await action(); });
    return value;
  });
  pendingWrites.set(db, result);
  return result;
}

export async function getQuestionnaire(db: SQLiteDatabase, localDate: string): Promise<Questionnaire | null> {
  if (!isLocalDate(localDate)) throw new Error("Invalid recovery date");
  const row = await db.getFirstAsync<{ response_json: string }>("SELECT response_json FROM daily_questionnaires WHERE owner_id = ? AND local_date = ?", [LOCAL_OWNER, localDate]);
  return row ? JSON.parse(row.response_json) as Questionnaire : null;
}

export async function listQuestionnaires(db: SQLiteDatabase): Promise<Questionnaire[]> {
  const rows = await db.getAllAsync<{ response_json: string }>("SELECT response_json FROM daily_questionnaires WHERE owner_id = ? ORDER BY local_date", [LOCAL_OWNER]);
  return rows.map((row) => JSON.parse(row.response_json) as Questionnaire);
}

export async function saveQuestionnaire(db: SQLiteDatabase, questionnaire: Questionnaire, complete: boolean): Promise<Questionnaire> {
  const candidate = { ...questionnaire, sriVersion: SRI_VERSION };
  const errors = validateQuestionnaire(candidate, complete);
  if (errors.length) throw new Error(errors.join(" "));
  return write(db, async () => {
    const previous = await getQuestionnaire(db, questionnaire.localDate);
    if (previous && previous.revision !== questionnaire.revision) throw new Error("This questionnaire changed elsewhere. Reload before saving.");
    const now = new Date().toISOString();
    const saved: Questionnaire = { ...candidate, status: complete ? "completed" : "in_progress", revision: (previous?.revision ?? 0) + 1, completedAt: complete ? now : null };
    await db.runAsync(`INSERT INTO daily_questionnaires(owner_id,local_date,timezone,status,revision,completed_at,response_json,updated_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,local_date) DO UPDATE SET timezone=excluded.timezone,status=excluded.status,revision=excluded.revision,completed_at=excluded.completed_at,response_json=excluded.response_json,updated_at=excluded.updated_at`, [LOCAL_OWNER, saved.localDate, saved.timezone, saved.status, saved.revision, saved.completedAt, JSON.stringify(saved), now]);
    await db.runAsync("INSERT INTO questionnaire_revisions(owner_id,local_date,revision,response_json,recorded_at) VALUES (?,?,?,?,?)", [LOCAL_OWNER, saved.localDate, saved.revision, JSON.stringify(saved), now]);
    if (saved.trainingCheckInVersion !== 1) await recomputeDerived(db, saved.localDate);
    return saved;
  });
}

export async function listWeights(db: SQLiteDatabase): Promise<{ measuredAt: number; kg: number }[]> {
  // Weight's existing table belongs to the app's single local profile; do not duplicate it.
  const rows = await db.getAllAsync<{ measured_at: number; kg: number }>(`SELECT t.start_at AS measured_at,w.weight_kg AS kg FROM weight_logs w INNER JOIN timeline_entries t ON t.id=w.timeline_entry_id WHERE t.kind='weight' ORDER BY t.start_at,t.id`);
  return rows.map((row) => ({ measuredAt: row.measured_at, kg: row.kg }));
}

export async function listMeasurements(db: SQLiteDatabase): Promise<HealthMeasurement[]> {
  const rows = await db.getAllAsync<{ measurement_json: string }>("SELECT measurement_json FROM health_measurements WHERE owner_id = ? ORDER BY local_date,measured_at,external_id,metric", [LOCAL_OWNER]);
  return rows.map((row) => JSON.parse(row.measurement_json) as HealthMeasurement);
}

export async function listSnapshots(db: SQLiteDatabase): Promise<RecoverySnapshot[]> {
  // A legacy cache can be the only record for a day. Reading it must not rebuild it.
  const rows = await db.getAllAsync<{ snapshot_json: string }>("SELECT snapshot_json FROM recovery_snapshots WHERE owner_id = ? ORDER BY local_date", [LOCAL_OWNER]);
  return rows.map((row) => JSON.parse(row.snapshot_json) as RecoverySnapshot);
}

const units: Record<HealthMetric, string> = { rhr: "bpm", hrv: "ms", hrr60: "bpm", respiratory_rate: "breaths/min", temperature_deviation: "°C", sleep_duration: "min", sleep_efficiency: "%" };

export function validateHealthMeasurement(item: HealthMeasurement) {
  if (!(item.metric in units) || item.unit !== units[item.metric] || !Number.isFinite(item.value)) throw new Error("Invalid health value or canonical unit");
  if (!item.id.trim() || !item.externalId.trim() || !item.source.trim() || !["healthkit", "health_connect"].includes(item.platform)) throw new Error("Health provenance is required");
  if (!["valid", "invalid", "unverified"].includes(item.quality)) throw new Error("Invalid health quality");
  if (!isInstant(item.measuredAt) || !isInstant(item.recordedAt) || !isLocalDate(item.localDate) || !isValidTimezone(item.timezone)) throw new Error("Invalid health timestamp or timezone");
  const dayInstant = item.measuredUntil ?? item.measuredAt;
  if (!isInstant(dayInstant) || localDateInZone(dayInstant, item.timezone) !== item.localDate) throw new Error("Health date must match acquisition/wake date");
  if (item.measuredUntil && Date.parse(item.measuredUntil) < Date.parse(item.measuredAt)) throw new Error("Invalid health interval");
  if (item.metric !== "temperature_deviation" && item.metric !== "hrr60" && item.value < 0) throw new Error("Health value cannot be negative");
  if (["rhr", "hrv", "respiratory_rate"].includes(item.metric) && item.value <= 0) throw new Error("Physiological value must be positive");
  if (item.metric === "sleep_duration" && item.value > 1440) throw new Error("Sleep duration exceeds a day");
  if (item.metric === "sleep_efficiency" && item.value > 100) throw new Error("Sleep efficiency exceeds 100%");
  // Broad corruption guards, not clinical reference ranges or readiness cutoffs.
  if ((item.metric === "rhr" && item.value > 300) || (item.metric === "hrr60" && Math.abs(item.value) > 300) || (item.metric === "respiratory_rate" && item.value > 150) || (item.metric === "hrv" && item.value > 10_000) || (item.metric === "temperature_deviation" && Math.abs(item.value) > 50)) throw new Error("Health value is outside a physically credible range");
  if (item.metric === "hrv" && !["RMSSD", "SDNN"].includes(item.subtype ?? "")) throw new Error("HRV requires RMSSD or SDNN subtype");
  if (item.metric === "hrr60" && !item.protocol?.trim()) throw new Error("HRR60 requires a comparable test protocol");
}

export async function upsertHealthBatch(db: SQLiteDatabase, batch: HealthBatch) {
  if (!["healthkit", "health_connect"].includes(batch.platform) || batch.state.platform !== batch.platform) throw new Error("Mismatched health batch platform");
  batch.measurements.forEach((item) => { validateHealthMeasurement(item); if (item.platform !== batch.platform) throw new Error("Mismatched measurement platform"); });
  if (batch.replaceWindow && (!isInstant(batch.replaceWindow.from) || !isInstant(batch.replaceWindow.to) || Date.parse(batch.replaceWindow.from) >= Date.parse(batch.replaceWindow.to))) throw new Error("Invalid reconciliation window");
  return write(db, async () => {
    const existing = await listMeasurements(db);
    // A replaceWindow is only supplied after a complete successful bounded read.
    if (batch.replaceWindow) {
      const { from, to, metrics } = batch.replaceWindow;
      const incoming = new Set(batch.measurements.map((item) => `${item.externalId}\u0000${item.metric}`));
      for (const item of existing) {
        if (item.platform === batch.platform && metrics.includes(item.metric) && Date.parse(item.measuredAt) >= Date.parse(from) && Date.parse(item.measuredAt) < Date.parse(to) && !incoming.has(`${item.externalId}\u0000${item.metric}`)) await db.runAsync("DELETE FROM health_measurements WHERE owner_id=? AND platform=? AND external_id=? AND metric=?", [LOCAL_OWNER, item.platform, item.externalId, item.metric]);
      }
    }
    for (const id of batch.deletedExternalIds) await db.runAsync("DELETE FROM health_measurements WHERE owner_id=? AND platform=? AND external_id=?", [LOCAL_OWNER, batch.platform, id]);
    for (const item of batch.measurements) {
      const normalized = { ...item, measuredAt: new Date(item.measuredAt).toISOString(), recordedAt: new Date(item.recordedAt).toISOString(), metadata: { ...item.metadata, originalMeasuredAt: item.measuredAt, originalRecordedAt: item.recordedAt } };
      await db.runAsync(`INSERT INTO health_measurements(owner_id,platform,external_id,metric,local_date,measured_at,measurement_json) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner_id,platform,external_id,metric) DO UPDATE SET local_date=excluded.local_date,measured_at=excluded.measured_at,measurement_json=excluded.measurement_json`, [LOCAL_OWNER, item.platform, item.externalId, item.metric, item.localDate, normalized.measuredAt, JSON.stringify(normalized)]);
    }
    await saveHealthState(db, batch.state);
    await recomputeDerived(db, undefined, existing.filter(item => item.platform === batch.platform).map(item => item.localDate));
  });
}

export async function getHealthState(db: SQLiteDatabase, platform: HealthPlatform): Promise<HealthState | null> {
  const row = await db.getFirstAsync<{ state_json: string }>("SELECT state_json FROM health_connections WHERE owner_id=? AND platform=?", [LOCAL_OWNER, platform]);
  return row ? JSON.parse(row.state_json) as HealthState : null;
}
async function saveHealthState(db: SQLiteDatabase, state: HealthState) {
  await db.runAsync("INSERT INTO health_connections(owner_id,platform,state_json) VALUES (?,?,?) ON CONFLICT(owner_id,platform) DO UPDATE SET state_json=excluded.state_json", [LOCAL_OWNER, state.platform, JSON.stringify(state)]);
}
export async function setHealthState(db: SQLiteDatabase, state: HealthState) { return write(db, () => saveHealthState(db, state)); }

export async function deleteImportedHealth(db: SQLiteDatabase, platform?: HealthPlatform) {
  return write(db, async () => {
    const previousDays = (await listMeasurements(db)).filter(item => !platform || item.platform === platform).map(item => item.localDate);
    if (platform) await db.runAsync("DELETE FROM health_measurements WHERE owner_id=? AND platform=?", [LOCAL_OWNER, platform]);
    else await db.runAsync("DELETE FROM health_measurements WHERE owner_id=?", [LOCAL_OWNER]);
    // Clear import cursors so a later intentional reconnect can backfill again.
    const platforms: HealthPlatform[] = platform ? [platform] : ["healthkit", "health_connect"];
    for (const selected of platforms) {
      const state = await getHealthState(db, selected);
      if (state) await saveHealthState(db, { ...state, cursor: null, lastSuccessfulSync: null, status: "not_connected", error: null });
    }
    await recomputeDerived(db, undefined, previousDays);
  });
}

export async function getPreferredSources(db: SQLiteDatabase): Promise<PreferredSources> {
  const row = await db.getFirstAsync<{ preferred_sources_json: string }>("SELECT preferred_sources_json FROM recovery_preferences WHERE owner_id=?", [LOCAL_OWNER]);
  return row ? JSON.parse(row.preferred_sources_json) as PreferredSources : {};
}
export async function setPreferredSources(db: SQLiteDatabase, sources: PreferredSources) {
  for (const [metric, source] of Object.entries(sources)) if (!(metric in units) || typeof source !== "string" || !source.trim()) throw new Error("Invalid preferred health source");
  return write(db, async () => {
    await db.runAsync("INSERT INTO recovery_preferences(owner_id,preferred_sources_json) VALUES (?,?) ON CONFLICT(owner_id) DO UPDATE SET preferred_sources_json=excluded.preferred_sources_json", [LOCAL_OWNER, JSON.stringify(sources)]);
    await recomputeDerived(db);
  });
}

async function recomputeDerived(db: SQLiteDatabase, questionnaireDay?: string, previousHealthDays: string[] = []) {
  const questionnaires = await listQuestionnaires(db);
  const measurements = await listMeasurements(db);
  const preferred = await getPreferredSources(db);
  const snapshotsByDay = new Map((await listSnapshots(db)).map(snapshot => [snapshot.localDate, snapshot]));
  const [apple, android] = await Promise.all([getHealthState(db, "healthkit"), getHealthState(db, "health_connect")]);
  const eligibleMeasurements = measurements.filter(item => {
    const state = item.platform === "healthkit" ? apple : android;
    return !state || (state.status === "ready" || state.status === "sync_error" && state.capabilities.authorization_requested === "true") &&
      !/not granted/i.test(state.capabilities[item.metric] ?? "");
  });
  const questionnaireByDay = new Map(questionnaires.map((q) => [q.localDate, q]));
  const measurementsByDay = new Map<string, HealthMeasurement[]>();
  const comparableDays = new Map<string, Map<string, HealthMeasurement>>();
  for (const measurement of eligibleMeasurements) {
    if (measurement.quality !== "valid" || (preferred[measurement.metric] && preferred[measurement.metric] !== measurement.source)) continue;
    const daily = measurementsByDay.get(measurement.localDate) ?? [];
    daily.push(measurement);
    measurementsByDay.set(measurement.localDate, daily);
    const key = comparableKey(measurement);
    const comparable = comparableDays.get(key) ?? new Map<string, HealthMeasurement>();
    const previous = comparable.get(measurement.localDate);
    if (!previous || Date.parse(previous.measuredAt) < Date.parse(measurement.measuredAt)) comparable.set(measurement.localDate, measurement);
    comparableDays.set(key, comparable);
  }
  const biometricDays = new Set([...measurements.map(item => item.localDate), ...previousHealthDays]);
  const days = questionnaireDay ? new Set([questionnaireDay]) : new Set([...questionnaires.filter(q => q.trainingCheckInVersion !== 1).map(q => q.localDate), ...biometricDays]);
  const now = new Date().toISOString();
  if (!questionnaireDay) {
    await db.runAsync("DELETE FROM metric_baselines WHERE owner_id=?", [LOCAL_OWNER]);
  }
  for (const localDate of days) {
    const questionnaire = questionnaireByDay.get(localDate);
    const previous = snapshotsByDay.get(localDate);
    const inputs = measurementsByDay.get(localDate) ?? [];
    const preserveOri = Boolean(questionnaireDay) || !biometricDays.has(localDate);
    const ori = preserveOri ? previous?.oriDetails : calculateORI(localDate, eligibleMeasurements, preferred);
    const legacyQuestionnaire = questionnaire && questionnaire.trainingCheckInVersion !== 1 ? questionnaire : null;
    const sri = legacyQuestionnaire ? (legacyQuestionnaire.status === "completed" ? calculateSRI(legacyQuestionnaire) : null) : previous?.sri ?? null;
    const snapshot: RecoverySnapshot = { localDate, sri, ori: preserveOri ? previous?.ori ?? null : ori?.score ?? null, oriDetails: ori,
      sriVersion: legacyQuestionnaire?.sriVersion ?? previous?.sriVersion ?? "sri_v1", oriVersion: ori?.version ?? previous?.oriVersion ?? null,
      inputCount: new Set(inputs.map((item) => item.metric)).size, computedAt: now };
    await db.runAsync(`INSERT INTO recovery_snapshots(owner_id,local_date,snapshot_json) VALUES (?,?,?)
      ON CONFLICT(owner_id,local_date) DO UPDATE SET snapshot_json=excluded.snapshot_json`, [LOCAL_OWNER, localDate, JSON.stringify(snapshot)]);
    if (questionnaireDay) continue;
    const latest = new Map<string, HealthMeasurement>();
    for (const item of inputs) {
      const key = comparableKey(item);
      const old = latest.get(key);
      if (!old || Date.parse(old.measuredAt) < Date.parse(item.measuredAt)) latest.set(key, item);
    }
    for (const [key, item] of latest) {
      // Scan 28 calendar slots, rather than scanning years of samples per day.
      const prior: HealthMeasurement[] = [];
      const byDay = comparableDays.get(key)!;
      for (let daysBack = 1; daysBack <= BASELINE_DAYS; daysBack += 1) {
        const observation = byDay.get(shiftDate(localDate, -daysBack));
        if (observation) prior.push(observation);
      }
      await db.runAsync("INSERT INTO metric_baselines(owner_id,local_date,comparable_key,baseline_json) VALUES (?,?,?,?)", [LOCAL_OWNER, localDate, key, JSON.stringify(personalBaseline(item, prior))]);
    }
  }
}
