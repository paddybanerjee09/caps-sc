import type { SQLiteDatabase } from "expo-sqlite";
import { sessionLoad, type ComparableOutput, type CompletedTraining, type TrainingDayConfirmation } from "../domain/training/fatigue";
import { isLocalDate, isValidTimezone, localDateInZone, shiftDate } from "../recovery/dates";

type SessionRow = {
  id: number; title: string; modality: CompletedTraining["modality"]; local_date: string; end_at: number; timezone: string | null;
  minutes: number | null; session_rpe: number | null; source_id: string; source_owner_id: string | null;
};
const completedSessionsSql = `
  SELECT t.id, t.title, 'conditioning' AS modality, c.performed_local_date AS local_date, c.finished_at AS end_at, c.performed_timezone AS timezone,
    COALESCE(l.minutes, (COALESCE(c.active_seconds, CASE WHEN c.source='manual' THEN c.elapsed_seconds END)) / 60.0) AS minutes,
    COALESCE(l.session_rpe, c.session_rpe) AS session_rpe, c.id AS source_id, c.owner_id AS source_owner_id
  FROM timeline_entries t JOIN conditioning_sessions c ON c.timeline_entry_id=t.id
    LEFT JOIN training_session_loads l ON l.timeline_entry_id=t.id
  WHERE t.kind='conditioning' AND c.status IN ('completed','ended_early')
  UNION ALL
  SELECT t.id, t.title, 'strength', s.local_end_date, s.ended_at, s.timezone, l.minutes, l.session_rpe, s.id, NULL
  FROM timeline_entries t JOIN strength_sessions s ON s.timeline_entry_id=t.id
    LEFT JOIN training_session_loads l ON l.timeline_entry_id=t.id
  WHERE t.kind='strength' AND t.status='completed'
  UNION ALL
  SELECT t.id, t.title, 'skill', s.local_end_date, s.ended_at, s.timezone, l.minutes, l.session_rpe, s.id, NULL
  FROM timeline_entries t JOIN skill_sessions s ON s.timeline_entry_id=t.id
    LEFT JOIN training_session_loads l ON l.timeline_entry_id=t.id
  WHERE t.kind='skill' AND t.status='completed'`;

export async function listCompletedTraining(db: SQLiteDatabase, asOf = Date.now()): Promise<CompletedTraining[]> {
  const rows = await db.getAllAsync<SessionRow>(`SELECT * FROM (${completedSessionsSql}) WHERE end_at <= ? ORDER BY end_at,id`, [asOf]);
  return rows.flatMap(row => {
    const localDate = row.modality === "conditioning" && row.timezone && isValidTimezone(row.timezone)
      ? localDateInZone(row.end_at, row.timezone)
      : row.local_date;
    return isLocalDate(localDate) ? [{ id: String(row.id), title: row.title, modality: row.modality, localDate, endAt: row.end_at, minutes: row.minutes, sessionRpe: row.session_rpe, sourceId: row.source_id, sourceOwnerId: row.source_owner_id }] : [];
  });
}

export async function listTrainingDayConfirmations(db: SQLiteDatabase): Promise<TrainingDayConfirmation[]> {
  return db.getAllAsync<TrainingDayConfirmation>("SELECT local_date AS localDate,kind FROM training_day_confirmations ORDER BY local_date");
}

export async function setTrainingDayConfirmation(db: SQLiteDatabase, date: string, kind: TrainingDayConfirmation["kind"] | null, timezone: string) {
  const now = Date.now();
  if (!isLocalDate(date) || date >= localDateInZone(now, timezone)) throw new Error("Choose a past date.");
  if (kind === null) {
    await db.runAsync("DELETE FROM training_day_confirmations WHERE local_date=?", [date]);
    return;
  }
  const sessions = (await listCompletedTraining(db, now)).filter(session => session.localDate === date);
  if (kind === "rest" && sessions.length) throw new Error("A workout is logged for this day.");
  if (kind === "complete" && (!sessions.length || sessions.some(session => sessionLoad(session.minutes, session.sessionRpe) === null))) throw new Error("Add elapsed minutes and session RPE for each workout first.");
  await db.runAsync(`INSERT INTO training_day_confirmations(local_date,kind,updated_at) VALUES (?,?,?)
    ON CONFLICT(local_date) DO UPDATE SET kind=excluded.kind, updated_at=excluded.updated_at`, [date, kind, now]);
}

export async function setCompletedTrainingLoad(db: SQLiteDatabase, id: string, minutes: number, rpe: number) {
  if (sessionLoad(minutes, rpe) === null || minutes > 10080) throw new Error("Enter completed minutes and a session RPE from 0 to 10.");
  const result = await db.runAsync(`INSERT INTO training_session_loads(timeline_entry_id,minutes,session_rpe)
    SELECT id,?,? FROM (${completedSessionsSql}) WHERE id=? AND end_at <= ? LIMIT 1
    ON CONFLICT(timeline_entry_id) DO UPDATE SET minutes=excluded.minutes, session_rpe=excluded.session_rpe`, [minutes, rpe, Number(id), Date.now()]);
  if (result.changes === 0) throw new Error("The completed workout could not be found.");
}

export type SleepTarget = { effectiveDate: string; hours: number | null };
export async function listSleepTargets(db: SQLiteDatabase): Promise<SleepTarget[]> {
  return db.getAllAsync<SleepTarget>("SELECT effective_date AS effectiveDate,hours FROM recovery_sleep_targets ORDER BY effective_date");
}
export function sleepTargetForDate(targets: readonly SleepTarget[], date: string): number | null {
  return targets.findLast(entry => entry.effectiveDate <= date)?.hours ?? null;
}
export async function setSleepTarget(db: SQLiteDatabase, date: string, timezone: string, hours: number | null) {
  if (date !== localDateInZone(Date.now(), timezone) || (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 24))) throw new Error("Enter a sleep target above 0 and at most 24 hours.");
  await db.runAsync(`INSERT INTO recovery_sleep_targets(effective_date,hours) VALUES (?,?) ON CONFLICT(effective_date) DO UPDATE SET hours=excluded.hours`, [date, hours]);
}

export async function listTrainingOutputTests(db: SQLiteDatabase, asOf: number): Promise<ComparableOutput[]> {
  return db.getAllAsync<ComparableOutput>(`SELECT observed_at AS observedAt,comparison_key AS comparisonKey,direction,output
    FROM training_output_tests WHERE observed_at <= ? ORDER BY observed_at DESC`, [asOf]);
}
export async function saveTrainingOutputTest(db: SQLiteDatabase, test: ComparableOutput) {
  const key = test.comparisonKey.trim();
  if (!key || key.length > 100 || !Number.isFinite(test.observedAt) || test.observedAt <= 0 || test.observedAt > Date.now() ||
      !Number.isFinite(test.output) || test.output < 0 || (test.direction === "elapsed-time" && test.output === 0)) throw new Error("Enter a test name and a valid measured result.");
  await db.runAsync(`INSERT INTO training_output_tests(observed_at,comparison_key,direction,output) VALUES (?,?,?,?)
    ON CONFLICT(observed_at,comparison_key,direction) DO UPDATE SET output=excluded.output`, [test.observedAt, key, test.direction, test.output]);
}

export async function recentFoodLogCount(db: SQLiteDatabase, day: string, timezone: string, asOf: number): Promise<number> {
  const after = Date.parse(`${shiftDate(day, -4)}T00:00:00Z`);
  const rows = await db.getAllAsync<{ start_at: number }>("SELECT t.start_at FROM timeline_entries t JOIN meal_logs m ON m.timeline_entry_id=t.id WHERE t.start_at>=? AND t.start_at<=?", [after, asOf]);
  return rows.filter(row => localDateInZone(row.start_at, timezone) >= shiftDate(day, -2)).length;
}
