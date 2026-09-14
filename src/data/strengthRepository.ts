import type { SQLiteDatabase } from "expo-sqlite";
import type { StrengthExercise, StrengthSessionDraft, StoredStrengthTemplate, StoredStrengthSession,
  StrengthCalendarRecord, StrengthExerciseScore, StrengthAdaptation } from "../types/strength";
import { validateStrengthSession } from "../utils/strengthSessionDraft";
import { scoreStrengthExercise, scoreStrengthSession } from "../utils/strengthScoring";

type TemplateRow = { id: number; title: string; created_at: number; updated_at: number };
type ExerciseRow = {
  exercise_external_id: string; exercise_name: string; movement_profile: StrengthExercise["movementProfile"];
  movement_profile_source: StrengthExercise["movementProfileSource"]; external_load_kg: number;
  sets: number; reps: number; rpe: number; percent_1rm: number | null; notes: string | null;
  intensity_source: StrengthExerciseScore["intensitySource"];
};
type ScoreRow = { hypertrophy_score: number; power_score: number; endurance_score: number;
  primary_adaptation: StrengthAdaptation; evidence_level: "full" | "limited"; scoring_model_version: string };
type SessionRow = ScoreRow & { timeline_entry_id: number; title: string; start_at: number; source_template_id: number | null };
type ContributionRow = { hard_sets: number; total_repetitions: number; volume_load_kg: number; percent_1rm_used: number | null;
  hypertrophy_contribution: number; power_contribution: number; endurance_contribution: number;
  evidence_level: "full" | "limited"; scoring_model_version: string; intensity_source: StrengthExerciseScore["intensitySource"] };

function validateId(id: number) { if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid strength record ID."); }
function mapExercise(e: ExerciseRow): StrengthExercise {
  return { exerciseId: e.exercise_external_id, name: e.exercise_name, labelConfirmed: true,
    movementProfile: e.movement_profile, movementProfileSource: e.movement_profile_source,
    externalLoadKg: e.external_load_kg, sets: e.sets, reps: e.reps, rpe: e.rpe, percent1RM: e.percent_1rm, notes: e.notes };
}
async function writeExercises(db: SQLiteDatabase, kind: "template" | "log", id: number, exercises: StrengthExercise[]) {
  const table = kind === "template" ? "strength_template_exercises" : "strength_log_exercises";
  const key = kind === "template" ? "template_id" : "timeline_entry_id";
  for (const [position, e] of exercises.entries()) {
    // Explicit allowlist: provider anatomy, instructions and media never enter storage.
    await db.runAsync(`INSERT INTO ${table} (${key}, position, exercise_external_id, exercise_name,
      movement_profile, movement_profile_source, external_load_kg, sets, reps, rpe, percent_1rm, intensity_source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, position, e.exerciseId, e.name, e.movementProfile, e.movementProfileSource, e.externalLoadKg,
      e.sets, e.reps, e.rpe, e.percent1RM, scoreStrengthExercise(e).intensitySource, e.notes]);
  }
}
export async function createStrengthTemplate(db: SQLiteDatabase, input: StrengthSessionDraft): Promise<StoredStrengthTemplate> {
  const draft = validateStrengthSession(input); const now = Date.now(); let id = 0;
  await db.withExclusiveTransactionAsync(async tx => {
    const result = await tx.runAsync("INSERT INTO strength_session_templates (title, created_at, updated_at) VALUES (?, ?, ?)", [draft.title, now, now]);
    id = result.lastInsertRowId;
    await writeExercises(tx, "template", id, draft.exercises);
  });
  return { ...draft, id, createdAt: now, updatedAt: now };
}
export async function updateStrengthTemplate(db: SQLiteDatabase, id: number, input: StrengthSessionDraft): Promise<void> {
  validateId(id); const draft = validateStrengthSession(input);
  await db.withExclusiveTransactionAsync(async tx => {
    const result = await tx.runAsync("UPDATE strength_session_templates SET title = ?, updated_at = ? WHERE id = ?", [draft.title, Date.now(), id]);
    if (result.changes !== 1) throw new Error("Saved workout not found.");
    await tx.runAsync("DELETE FROM strength_template_exercises WHERE template_id = ?", [id]);
    await writeExercises(tx, "template", id, draft.exercises);
  });
}
async function templateFromRow(db: SQLiteDatabase, row: TemplateRow): Promise<StoredStrengthTemplate> {
  const exercises = await db.getAllAsync<ExerciseRow>("SELECT * FROM strength_template_exercises WHERE template_id = ? ORDER BY position", [row.id]);
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, exercises: exercises.map(mapExercise) };
}
export async function listStrengthTemplates(db: SQLiteDatabase): Promise<StoredStrengthTemplate[]> {
  const rows = await db.getAllAsync<TemplateRow>("SELECT * FROM strength_session_templates ORDER BY updated_at DESC, id DESC");
  return Promise.all(rows.map(row => templateFromRow(db, row)));
}
export async function getStrengthTemplate(db: SQLiteDatabase, id: number): Promise<StoredStrengthTemplate | null> {
  validateId(id);
  const row = await db.getFirstAsync<TemplateRow>("SELECT * FROM strength_session_templates WHERE id = ?", [id]);
  return row ? templateFromRow(db, row) : null;
}
export async function logCompletedStrengthSession(db: SQLiteDatabase, input: StrengthSessionDraft & { startAt: number; sourceTemplateId?: number | null }): Promise<number> {
  const draft = validateStrengthSession(input);
  if (!Number.isSafeInteger(input.startAt) || !Number.isFinite(new Date(input.startAt).getTime()) || input.startAt > Date.now()) throw new Error("Log time must be valid and cannot be in the future.");
  if (input.sourceTemplateId != null) validateId(input.sourceTemplateId);
  const score = scoreStrengthSession(draft.exercises);
  if (score.status === "insufficient") throw new Error(score.reasons.join(" "));
  let id = 0; const now = Date.now();
  await db.withExclusiveTransactionAsync(async tx => {
    const entry = await tx.runAsync(`INSERT INTO timeline_entries (kind, title, start_at, end_at, status, notes, created_at, updated_at)
      VALUES ('strength', ?, ?, NULL, 'completed', NULL, ?, ?)`, [draft.title, input.startAt, now, now]);
    id = entry.lastInsertRowId;
    await tx.runAsync("INSERT INTO strength_logs (timeline_entry_id, source_template_id) VALUES (?, ?)", [id, input.sourceTemplateId ?? null]);
    await writeExercises(tx, "log", id, draft.exercises);
    await tx.runAsync(`INSERT INTO strength_adaptation_scores (timeline_entry_id, hypertrophy_score, power_score, endurance_score, primary_adaptation, evidence_level, scoring_model_version)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, score.scores.hypertrophy, score.scores.power, score.scores.endurance, score.primaryAdaptation, score.evidence, score.modelVersion]);
    for (const [position, e] of score.exercises.entries()) await tx.runAsync(`INSERT INTO strength_exercise_adaptation_scores
      (timeline_entry_id, position, hard_sets, total_repetitions, volume_load_kg, percent_1rm_used, hypertrophy_contribution, power_contribution, endurance_contribution, evidence_level, scoring_model_version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, position, e.hardSets, e.totalRepetitions, e.volumeLoadKg, e.percent1RMUsed, e.scores.hypertrophy, e.scores.power, e.scores.endurance, e.evidence, e.modelVersion]);
  });
  return id;
}
const sessionSelect = `SELECT timeline.id AS timeline_entry_id, timeline.title, timeline.start_at, logs.source_template_id, scores.*
  FROM timeline_entries AS timeline JOIN strength_logs AS logs ON logs.timeline_entry_id = timeline.id
  JOIN strength_adaptation_scores AS scores ON scores.timeline_entry_id = timeline.id
  WHERE timeline.kind = 'strength' AND timeline.status = 'completed'`;
function calendarRecord(row: SessionRow): StrengthCalendarRecord {
  return { timelineEntryId: row.timeline_entry_id, title: row.title, startAt: row.start_at, primaryAdaptation: row.primary_adaptation, evidence: row.evidence_level };
}
export async function getStrengthSessionsForRange(db: SQLiteDatabase, start: number, end: number): Promise<StrengthCalendarRecord[]> {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid strength date range.");
  const rows = await db.getAllAsync<SessionRow>(`${sessionSelect} AND timeline.start_at >= ? AND timeline.start_at < ? ORDER BY timeline.start_at, timeline.id`, [start, end]);
  return rows.map(calendarRecord);
}
export async function getStrengthSessionByTimelineEntryId(db: SQLiteDatabase, id: number): Promise<StoredStrengthSession | null> {
  validateId(id);
  const row = await db.getFirstAsync<SessionRow>(`${sessionSelect} AND timeline.id = ?`, [id]);
  if (!row) return null;
  const exercises = await db.getAllAsync<ExerciseRow>("SELECT * FROM strength_log_exercises WHERE timeline_entry_id = ? ORDER BY position", [id]);
  const contributions = await db.getAllAsync<ContributionRow>(`SELECT scores.*, exercise.intensity_source FROM strength_exercise_adaptation_scores AS scores
    JOIN strength_log_exercises AS exercise USING (timeline_entry_id, position) WHERE timeline_entry_id = ? ORDER BY position`, [id]);
  return { ...calendarRecord(row), sourceTemplateId: row.source_template_id, exercises: exercises.map(mapExercise),
    score: { status: "scored", scores: { hypertrophy: row.hypertrophy_score, power: row.power_score, endurance: row.endurance_score }, primaryAdaptation: row.primary_adaptation,
      evidence: row.evidence_level, modelVersion: row.scoring_model_version,
      missingInputs: row.evidence_level === "limited" ? ["Stored score uses estimated/missing intensity or unknown movement intent."] : [],
      exercises: contributions.map(e => ({ hardSets: e.hard_sets, totalRepetitions: e.total_repetitions, volumeLoadKg: e.volume_load_kg,
        percent1RMUsed: e.percent_1rm_used, estimated1RM: null, intensitySource: e.intensity_source,
        scores: { hypertrophy: e.hypertrophy_contribution, power: e.power_contribution, endurance: e.endurance_contribution }, evidence: e.evidence_level, modelVersion: e.scoring_model_version })) } };
}
