import type { SQLiteDatabase } from "expo-sqlite";

import { deviceTimeZone, isIanaTimeZone } from "../conditioning/dates";
import { createId } from "../conditioning/ids";
import { localDateInZone, shiftDate } from "../recovery/dates";
import { CATALOG_SEED } from "../strength/catalogSeed";
import {
  draftToCompletePlan,
  performedSets,
  plannedSetTarget,
  projectTemplateDraft,
  setStrengthTarget,
  strengthSessionTime,
  validateStrengthDraft,
} from "../strength/drafts";
import {
  estimateDraftDurationSeconds,
  sessionStartMs,
} from "../strength/duration";
import {
  STRENGTH_EMPHASIS_VERSION,
  emphasisFromDraft,
  type EmphasisReference,
  type StrengthEmphasis,
} from "../strength/emphasis";
import type { StrengthMaxReference, StrengthStimulusExercise } from "../strength/stimulus";
import type {
  CatalogExercise,
  CatalogSource,
  ExerciseDraft,
  LoadMode,
  StrengthDraft,
  StrengthExerciseRecord,
  StrengthSessionMode,
  StrengthSetIntent,
  StrengthSetRecord,
  StrengthTemplateRecord,
} from "../strength/types";
import { addTimelineEntry } from "./timelineRepository";

export type StrengthSessionSummary = {
  emphasis: StrengthEmphasis;
  endedAt: number;
  id: string;
  localDate: string;
  localEndDate: string;
  startedAt: number;
  status: StrengthSessionMode;
  title: string;
};

export type StrengthSessionRecord = StrengthSessionSummary & {
  durationSeconds: number;
  exercises: StrengthExerciseRecord[];
  sourceTemplateId: string | null;
  timeZone: string;
  timelineEntryId: number;
};

export type StrengthTemplateSummary = {
  id: string;
  title: string;
};

export type StrengthLogResult = {
  alreadySaved: boolean;
  sessionId: string;
  templateId: string | null;
  timelineEntryId: number;
};

type StrengthLogOptions = {
  beforeCommit?: () => void;
  now?: number;
  timeZone?: string;
};

const completionQueues = new WeakMap<SQLiteDatabase, Promise<StrengthLogResult>>();

type ExerciseRow = {
  equipment: string;
  exercise_id: string | null;
  explosive_intent: number;
  id: string;
  load_mode: LoadMode;
  muscle_groups_json: string;
  name: string;
  notes: string | null;
  position: number;
  target_json: string | null;
  unilateral: number;
};

type SetRow = {
  assistance_kg: number | null;
  id: string;
  load_kg: number | null;
  parent_id: string;
  position: number;
  reps: number;
  rest_seconds: number | null;
  rir: number | null;
  rpe: number | null;
  skipped?: number;
  warmup?: number;
  work_seconds?: number | null;
  preceding_rest_seconds?: number | null;
  rom?: string | null;
  intent?: StrengthSetIntent | null;
  isometric?: number;
  tested_max?: number;
};

type StrengthSnapshot = "template" | "session";

type SessionRow = {
  emphasis_json: string;
  ended_at: number;
  id: string;
  local_end_date: string;
  scheduled_local_date: string | null;
  started_at: number;
  status: StrengthSessionMode;
  title: string;
};

function mapSession(row: SessionRow): StrengthSessionSummary {
  return {
    emphasis: parseEmphasis(row.emphasis_json),
    endedAt: row.ended_at,
    id: row.id,
    localDate: row.scheduled_local_date ?? row.local_end_date,
    localEndDate: row.local_end_date,
    startedAt: row.started_at,
    status: row.status,
    title: row.title,
  };
}

type CatalogRow = {
  aliases_json: string;
  default_load_mode: LoadMode;
  default_unilateral: number;
  equipment: string;
  id: string;
  muscle_groups_json: string;
  name: string;
  source: CatalogSource;
  source_revision: string | null;
  suggests_explosive: number;
  upstream_id: string | null;
};

export async function ensureStrengthCatalog(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM strength_exercises
     WHERE source = 'free_exercise_db'`,
  );
  if ((row?.count ?? 0) >= CATALOG_SEED.length) {
    return;
  }

  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const exercise of CATALOG_SEED) {
      await db.runAsync(
        `INSERT OR IGNORE INTO strength_exercises (
          id, source, source_revision, upstream_id, name, equipment,
          muscle_groups_json, aliases_json, suggests_explosive,
          default_load_mode, default_unilateral, created_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          exercise.id,
          exercise.source,
          exercise.sourceRevision,
          exercise.upstreamId,
          exercise.name,
          exercise.equipment,
          JSON.stringify(exercise.muscleGroups),
          JSON.stringify(exercise.aliases),
          exercise.suggestsExplosive ? 1 : 0,
          exercise.defaultLoadMode,
          exercise.defaultUnilateral ? 1 : 0,
          now,
        ],
      );
    }
  });
}

export async function listStrengthExercises(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<CatalogRow>(
    `SELECT id, source, source_revision, upstream_id, name, equipment,
            muscle_groups_json, aliases_json, suggests_explosive,
            default_load_mode, default_unilateral
     FROM strength_exercises
     WHERE archived_at IS NULL
     ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapCatalog);
}

export async function createCustomExercise(db: SQLiteDatabase, name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new Error("Enter an exercise name.");
  }
  const exercise: CatalogExercise = {
    aliases: [],
    defaultLoadMode: "external",
    defaultUnilateral: false,
    equipment: "custom",
    id: `custom.${createId()}`,
    muscleGroups: [],
    name: trimmed,
    source: "custom",
    sourceRevision: null,
    suggestsExplosive: false,
    upstreamId: null,
  };
  await db.runAsync(
    `INSERT INTO strength_exercises (
      id, source, source_revision, upstream_id, name, equipment,
      muscle_groups_json, aliases_json, suggests_explosive,
      default_load_mode, default_unilateral, created_at, archived_at
    ) VALUES (?, 'custom', NULL, NULL, ?, ?, '[]', '[]', 0, 'external', 0, ?, NULL)`,
    [exercise.id, exercise.name, exercise.equipment, Date.now()],
  );
  return exercise;
}

export async function listStrengthTemplates(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<StrengthTemplateSummary>(
    `SELECT id, title
     FROM strength_templates
     WHERE archived_at IS NULL
     ORDER BY title COLLATE NOCASE, id`,
  );
  return rows;
}

export async function getStrengthTemplate(db: SQLiteDatabase, templateId: string) {
  const header = await db.getFirstAsync<{
    archived_at: number | null;
    id: string;
    title: string;
    updated_at: number;
  }>(
    `SELECT id, title, archived_at, updated_at
     FROM strength_templates
     WHERE id = ?`,
    [templateId],
  );
  if (!header) {
    return null;
  }
  const exercises = await loadExercises(db, "template", templateId);
  const record: StrengthTemplateRecord = {
    archivedAt: header.archived_at,
    exercises,
    id: header.id,
    title: header.title,
    updatedAt: header.updated_at,
  };
  return record;
}

export async function createStrengthTemplate(db: SQLiteDatabase, draft: StrengthDraft) {
  const projected = projectTemplateDraft(draft);
  const error = validateStrengthDraft(projected, "template", Date.now());
  if (error) {
    throw new Error(error);
  }
  const id = createId();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await insertTemplate(db, id, projected, now);
  });
  return id;
}

/** Save the current reusable workout, retaining its identity when editing it. */
export async function saveStrengthTemplate(db: SQLiteDatabase, draft: StrengthDraft) {
  if (!draft.sourceTemplateId) return createStrengthTemplate(db, draft);
  const projected = projectTemplateDraft(draft);
  const now = Date.now();
  const error = validateStrengthDraft(projected, "template", now);
  if (error) throw new Error(error);
  const id = draft.sourceTemplateId;
  await db.withTransactionAsync(async () => {
    await replaceTemplate(db, id, projected, now);
  });
  return id;
}

/** Remove a reusable workout while preserving all logged session snapshots. */
export async function archiveStrengthTemplate(db: SQLiteDatabase, templateId: string) {
  await archiveTemplate(db, templateId, Date.now());
}

export async function listStrengthSessionsForDates(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string,
) {
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT s.id, s.title, s.started_at, s.ended_at, s.local_end_date,
            s.scheduled_local_date, s.emphasis_json, t.status
     FROM strength_sessions s
     JOIN timeline_entries t ON t.id = s.timeline_entry_id
     WHERE COALESCE(s.scheduled_local_date, s.local_end_date) BETWEEN ? AND ?
     ORDER BY CASE WHEN t.status = 'planned' THEN s.started_at ELSE s.ended_at END, s.id`,
    [startDate, endDate],
  );
  return rows.map(mapSession);
}

export async function getStrengthSession(db: SQLiteDatabase, sessionId: string) {
  const header = await db.getFirstAsync<SessionRow & {
    duration_seconds: number;
    source_template_id: string | null;
    timezone: string;
    timeline_entry_id: number;
  }>(
    `SELECT s.id, s.title, s.started_at, s.ended_at, s.local_end_date,
            s.scheduled_local_date, s.timezone, s.source_template_id,
            s.duration_seconds, s.emphasis_json, s.timeline_entry_id, t.status
     FROM strength_sessions s
     JOIN timeline_entries t ON t.id = s.timeline_entry_id
     WHERE s.id = ?`,
    [sessionId],
  );
  if (!header) {
    return null;
  }
  const exercises = await loadExercises(db, "session", sessionId);
  const record: StrengthSessionRecord = {
    ...mapSession(header),
    durationSeconds: header.duration_seconds,
    exercises,
    sourceTemplateId: header.source_template_id,
    timeZone: header.timezone,
    timelineEntryId: header.timeline_entry_id,
  };
  return record;
}

export async function getStrengthStimulusContext(
  db: SQLiteDatabase,
  sessionId: string,
  endedAt: number,
  localDate: string,
  exerciseIds: readonly string[],
) {
  const ids = [...new Set(exerciseIds)];
  const referenceRows = ids.length ? db.getAllAsync<{
    exercise_id: string; equipment: string; unilateral: number; rom: string | null;
    load_kg: number; ended_at: number; session_id: string;
  }>(
    `SELECT e.exercise_id, e.equipment, e.unilateral, sets.rom, sets.load_kg, s.ended_at, s.id AS session_id
     FROM strength_session_sets sets
     JOIN strength_session_exercises e ON e.id = sets.session_exercise_id
     JOIN strength_sessions s ON s.id = e.session_id
     JOIN timeline_entries t ON t.id = s.timeline_entry_id
     WHERE t.status = 'completed' AND s.ended_at < ? AND s.id != ?
       AND sets.tested_max = 1 AND sets.skipped = 0 AND sets.warmup = 0 AND sets.isometric = 0
       AND sets.reps = 1 AND sets.load_kg > 0 AND e.load_mode = 'external'
       AND e.exercise_id IN (${ids.map(() => "?").join(", ")})`,
    [endedAt, sessionId, ...ids],
  ) : Promise.resolve([]);

  const [referenceData, recentRows] = await Promise.all([
    referenceRows,
    db.getAllAsync<{
      exercise_id: string | null; id: string; equipment: string; name: string; unilateral: number;
      load_mode: LoadMode; muscle_groups_json: string; set_id: string; reps: number;
      isometric: number; work_seconds: number | null; rir: number | null;
    }>(
      `SELECT e.exercise_id, e.id, e.equipment, e.name, e.unilateral, e.load_mode, e.muscle_groups_json,
              sets.id AS set_id, sets.reps, sets.isometric, sets.work_seconds, sets.rir
       FROM strength_sessions s
       JOIN timeline_entries t ON t.id = s.timeline_entry_id
       JOIN strength_session_exercises e ON e.session_id = s.id
       JOIN strength_session_sets sets ON sets.session_exercise_id = e.id
       WHERE t.status = 'completed' AND s.id != ? AND s.ended_at < ?
         AND s.local_end_date BETWEEN ? AND ? AND sets.skipped = 0 AND sets.warmup = 0`,
      [sessionId, endedAt, shiftDate(localDate, -6), localDate],
    ),
  ]);
  const references: StrengthMaxReference[] = referenceData.map((row) => ({
    catalogExerciseId: row.exercise_id, equipment: row.equipment, unilateral: row.unilateral === 1,
    rom: row.rom, kg: row.load_kg, performedAt: row.ended_at, sessionId: row.session_id,
  }));
  const recent = new Map<string, StrengthStimulusExercise & { sets: StrengthSetRecord[] }>();
  for (const row of recentRows) {
    const exercise = recent.get(row.id) ?? {
      catalogExerciseId: row.exercise_id, equipment: row.equipment, id: row.id, loadMode: row.load_mode,
      muscleGroups: parseStringList(row.muscle_groups_json), name: row.name, unilateral: row.unilateral === 1,
      sets: [],
    };
    exercise.sets.push({
      id: row.set_id, reps: row.reps, isometric: row.isometric === 1, workSeconds: row.work_seconds,
      rir: row.rir, skipped: false, warmup: false, position: exercise.sets.length,
      rpe: null, restSeconds: null, loadKg: null, assistanceKg: null,
    });
    recent.set(row.id, exercise);
  }
  return { references, recent: [...recent.values()] };
}

export async function listSameLiftReferences(
  db: SQLiteDatabase,
  exerciseIds: readonly string[],
  beforeEndedAt: number,
) {
  const references = new Map<string, EmphasisReference>();
  const ids = [...new Set(exerciseIds.filter((id) => id.length > 0))];
  if (ids.length === 0) {
    return references;
  }
  const placeholders = ids.map(() => "?").join(", ");
  // A lift can appear twice in one session. Its first eligible set determines
  // the load mode, and all eligible sets for that lift contribute to the reference.
  const rows = await db.getAllAsync<{
    exercise_id: string;
    kg: number;
    kind: EmphasisReference["kind"];
  }>(
    `WITH work_sets AS (
       SELECT se.exercise_id, s.id AS session_id, s.ended_at,
              ss.load_kg, ss.assistance_kg,
              FIRST_VALUE(se.load_mode) OVER (
                PARTITION BY se.exercise_id, s.id
                ORDER BY se.position, ss.position
              ) AS load_mode
       FROM strength_session_sets ss
       INNER JOIN strength_session_exercises se
         ON se.id = ss.session_exercise_id
       INNER JOIN strength_sessions s
         ON s.id = se.session_id
       INNER JOIN timeline_entries t ON t.id = s.timeline_entry_id
       WHERE se.exercise_id IN (${placeholders})
         AND ss.skipped = 0
         AND ss.warmup = 0
         AND t.status = 'completed'
         AND s.ended_at < ?
     ), session_references AS (
       SELECT exercise_id, session_id, ended_at,
              CASE WHEN load_mode = 'assisted'
                THEN MIN(CASE WHEN assistance_kg > 0 THEN assistance_kg END)
                ELSE MAX(CASE WHEN load_kg > 0 THEN load_kg END)
              END AS kg,
              CASE WHEN load_mode = 'assisted' THEN 'assistance' ELSE 'load' END AS kind
       FROM work_sets
       GROUP BY exercise_id, session_id
     ), ranked AS (
       SELECT exercise_id, kg, kind,
              ROW_NUMBER() OVER (
                PARTITION BY exercise_id ORDER BY ended_at DESC, session_id DESC
              ) AS recency
       FROM session_references
       WHERE kg IS NOT NULL
     )
     SELECT exercise_id, kg, kind FROM ranked WHERE recency = 1`,
    [...ids, beforeEndedAt],
  );

  for (const row of rows) {
    references.set(row.exercise_id, { kg: row.kg, kind: row.kind });
  }
  return references;
}

export async function logStrengthSession(
  db: SQLiteDatabase,
  draft: StrengthDraft,
  options?: StrengthLogOptions & {
    /** Explicit-save workflows log a snapshot without changing reusable workouts. */
    persistTemplate?: boolean;
  },
) {
  const existing = await getStrengthSession(db, draft.sessionId);
  if (existing) return sessionLogResult(existing, true);

  const now = options?.now ?? Date.now();
  const timeZone = options?.timeZone ?? deviceTimeZone();
  assertValidStrengthLog(draft, now, timeZone);
  const mode = draft.sessionMode ?? "completed";
  const persistTemplate = options?.persistTemplate !== false;
  const templateDraft = persistTemplate && draft.saveAsTemplate ? projectTemplateDraft(draft) : null;
  if (templateDraft) {
    const templateError = validateStrengthDraft(templateDraft, "template", now);
    if (templateError) {
      throw new Error(templateError);
    }
  }

  const { durationSeconds, emphasis, startedAt, endedAt, localEndDate } =
    await estimateStrengthSession(db, draft, mode, timeZone);
  const scheduledLocalDate = mode === "planned" ? localDateInZone(startedAt, timeZone) : null;
  const title = draft.title.trim();
  let templateId = draft.sourceTemplateId;

  await db.withTransactionAsync(async () => {
    const timelineEntryId = Number(
      await addTimelineEntry(db, {
        endAt: endedAt,
        kind: "strength",
        startAt: startedAt,
        status: mode,
        title,
      }),
    );
    if (templateDraft) {
      if (templateId) {
        await replaceTemplate(db, templateId, templateDraft, now);
      } else {
        templateId = createId();
        await insertTemplate(db, templateId, templateDraft, now);
      }
    } else if (persistTemplate && templateId) {
      await archiveTemplate(db, templateId, now);
    }

    await db.runAsync(
      `INSERT INTO strength_sessions (
        id, title, started_at, ended_at, local_end_date, scheduled_local_date, timezone,
        source_template_id, duration_seconds, emphasis_json, emphasis_version,
        timeline_entry_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.sessionId,
        title,
        startedAt,
        endedAt,
        localEndDate,
        scheduledLocalDate,
        timeZone,
        templateId,
        durationSeconds,
        JSON.stringify(emphasis),
        STRENGTH_EMPHASIS_VERSION,
        timelineEntryId,
        now,
      ],
    );
    const snapshots = mode === "planned"
      ? draft.exercises.map((exercise) => setStrengthTarget(exercise, {}, "planned"))
      : draft.exercises;
    await insertExercises(db, "session", draft.sessionId, snapshots);
    options?.beforeCommit?.();
  });

  const saved = await getStrengthSession(db, draft.sessionId);
  if (!saved) {
    throw new Error("Strength session did not save.");
  }
  return sessionLogResult(saved, false);
}

/** Record actuals on the original scheduled session and its linked timeline entry. */
export async function completeStrengthSession(
  db: SQLiteDatabase,
  draft: StrengthDraft,
  options?: StrengthLogOptions,
): Promise<StrengthLogResult> {
  const now = options?.now ?? Date.now();
  // One connection cannot nest withTransactionAsync calls. Let concurrent completion
  // requests see the committed status (or retry after a rolled-back attempt).
  const previous = completionQueues.get(db);
  const completion = Promise.resolve(previous).catch(() => undefined)
    .then(() => completePlan(db, draft, now, options));
  completionQueues.set(db, completion);
  try {
    return await completion;
  } finally {
    if (completionQueues.get(db) === completion) completionQueues.delete(db);
  }
}

async function completePlan(
  db: SQLiteDatabase,
  draft: StrengthDraft,
  now: number,
  options?: StrengthLogOptions,
): Promise<StrengthLogResult> {
  if (draft.sessionMode !== "completed") throw new Error("Open the plan to log its completed sets.");
  const plan = await getStrengthSession(db, draft.sessionId);
  if (!plan) throw new Error("This planned workout could not be found.");
  if (plan.status === "completed") return sessionLogResult(plan, true);

  // Read the prescription from storage. Only the actual inputs and end time
  // come from the editor, so stale target values cannot replace the saved plan.
  const completed = draftToCompletePlan(plan, draft.endedAt);
  const stalePlanError = "The exercise list changed. Reopen this planned workout.";
  if (completed.exercises.length !== draft.exercises.length) throw new Error(stalePlanError);
  for (const [index, exercise] of completed.exercises.entries()) {
    const input = draft.exercises[index];
    if (input.id !== exercise.id || input.sets.length !== exercise.sets.length) {
      throw new Error(stalePlanError);
    }
    exercise.sets = exercise.sets.map((set, setIndex) => ({ ...set, actual: input.sets[setIndex].actual }));
  }

  const timeZone = options?.timeZone ?? deviceTimeZone();
  assertValidStrengthLog(completed, now, timeZone);
  const { durationSeconds, emphasis, startedAt, endedAt, localEndDate } =
    await estimateStrengthSession(db, completed, "completed", timeZone);

  let alreadySaved = false;
  await db.withTransactionAsync(async () => {
    const claimed = await db.runAsync(
      `UPDATE timeline_entries SET status = 'completed', start_at = ?, end_at = ?, updated_at = ?
       WHERE id = ? AND kind = 'strength' AND status = 'planned'`,
      [startedAt, endedAt, now, plan.timelineEntryId],
    );
    if (claimed.changes !== 1) {
      const current = await getStrengthSession(db, plan.id);
      if (current?.status !== "completed") throw new Error("This planned workout could not be found.");
      alreadySaved = true;
      return;
    }
    const updated = await db.runAsync(
      `UPDATE strength_sessions
       SET started_at = ?, ended_at = ?, local_end_date = ?, scheduled_local_date = NULL,
           timezone = ?, duration_seconds = ?, emphasis_json = ?, emphasis_version = ?
       WHERE id = ? AND timeline_entry_id = ?`,
      [
        startedAt, endedAt, localEndDate, timeZone, durationSeconds, JSON.stringify(emphasis),
        STRENGTH_EMPHASIS_VERSION, plan.id, plan.timelineEntryId,
      ],
    );
    if (updated.changes !== 1) throw new Error("This planned workout could not be found.");
    for (const exercise of completed.exercises) {
      await insertSets(db, "session", exercise.id, exercise);
    }
    options?.beforeCommit?.();
  });

  return sessionLogResult(plan, alreadySaved);
}

function sessionLogResult(session: StrengthSessionRecord, alreadySaved: boolean): StrengthLogResult {
  return {
    alreadySaved,
    sessionId: session.id,
    templateId: session.sourceTemplateId,
    timelineEntryId: session.timelineEntryId,
  };
}

function assertValidStrengthLog(draft: StrengthDraft, now: number, timeZone: string) {
  if (!isIanaTimeZone(timeZone)) throw new Error("Choose a valid workout time zone.");
  const error = validateStrengthDraft(draft, "log", now);
  if (error) throw new Error(error);
}

async function estimateStrengthSession(db: SQLiteDatabase, draft: StrengthDraft, mode: StrengthSessionMode, timeZone: string) {
  const timestamp = strengthSessionTime(draft);
  const durationSeconds = estimateDraftDurationSeconds(draft.exercises, mode);
  if (durationSeconds == null) throw new Error("Add at least one work set.");
  const references = await listSameLiftReferences(
    db,
    draft.exercises.flatMap((exercise) => exercise.catalogExerciseId ? [exercise.catalogExerciseId] : []),
    timestamp,
  );
  const startedAt = mode === "planned" ? timestamp : sessionStartMs(timestamp, durationSeconds);
  const endedAt = mode === "planned" ? timestamp + durationSeconds * 1000 : timestamp;
  return {
    durationSeconds,
    emphasis: emphasisFromDraft(draft.exercises, references, mode),
    startedAt,
    endedAt,
    localEndDate: localDateInZone(endedAt, timeZone),
  };
}

async function insertTemplate(
  db: SQLiteDatabase,
  id: string,
  draft: StrengthDraft,
  now: number,
) {
  await db.runAsync(
    `INSERT INTO strength_templates (
      id, title, created_at, updated_at, archived_at
    ) VALUES (?, ?, ?, ?, NULL)`,
    [id, draft.title.trim(), now, now],
  );
  await insertExercises(db, "template", id, draft.exercises);
}

async function replaceTemplate(
  db: SQLiteDatabase,
  id: string,
  draft: StrengthDraft,
  now: number,
) {
  const updated = await db.runAsync(
    `UPDATE strength_templates
     SET title = ?, updated_at = ?, archived_at = NULL
     WHERE id = ?`,
    [draft.title.trim(), now, id],
  );
  if (updated.changes !== 1) {
    throw new Error("Saved workout was not found.");
  }
  await db.runAsync(
    `DELETE FROM strength_template_exercises WHERE template_id = ?`,
    [id],
  );
  await insertExercises(db, "template", id, draft.exercises);
}

async function archiveTemplate(db: SQLiteDatabase, id: string, now: number) {
  await db.runAsync(
    `UPDATE strength_templates
     SET archived_at = ?, updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
    [now, now, id],
  );
}

async function insertExercises(
  db: SQLiteDatabase,
  snapshot: StrengthSnapshot,
  parentId: string,
  exercises: readonly ExerciseDraft[],
) {
  const includePerformed = snapshot === "session";

  for (const [index, exercise] of exercises.entries()) {
    // Template snapshots own their row identities, including after Save/Unsave/Save.
    const snapshotExerciseId = includePerformed ? exercise.id : createId();
    await db.runAsync(
      `INSERT INTO strength_${snapshot}_exercises (
        id, ${snapshot}_id, position, exercise_id, name, equipment,
        muscle_groups_json, load_mode, unilateral, explosive_intent, notes, target_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshotExerciseId,
        parentId,
        index,
        exercise.catalogExerciseId,
        exercise.name.trim(),
        exercise.equipment,
        JSON.stringify(exercise.muscleGroups),
        exercise.loadMode,
        exercise.unilateral ? 1 : 0,
        exercise.explosiveIntent ? 1 : 0,
        noteOrNull(exercise.notes),
        serializeTarget(exercise),
      ],
    );
    await insertSets(db, snapshot, snapshotExerciseId, exercise);
  }
}

async function insertSets(
  db: SQLiteDatabase,
  snapshot: StrengthSnapshot,
  snapshotExerciseId: string,
  exercise: ExerciseDraft,
) {
  const includePerformed = snapshot === "session";
  const performedColumns = includePerformed
    ? ", skipped, warmup, work_seconds, preceding_rest_seconds, rom, intent, isometric, tested_max"
    : "";
  const performedValues = includePerformed ? ", ?, ?, ?, ?, ?, ?, ?, ?" : "";
  const sets = includePerformed ? performedSets(exercise) : exercise.sets.map((set) => ({
    ...set, workSeconds: null, precedingRestSeconds: null, rom: null, intent: null, isometric: false, testedMax: false,
  }));
  for (const [setIndex, set] of sets.entries()) {
    await db.runAsync(
      `INSERT INTO strength_${snapshot}_sets (
        id, ${snapshot}_exercise_id, position, load_kg, assistance_kg,
        reps, rpe, rir, rest_seconds${performedColumns}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${performedValues})`,
      [
        includePerformed ? set.id : createId(),
        snapshotExerciseId,
        setIndex,
        storedLoad(exercise.loadMode, set.loadKg),
        exercise.loadMode === "assisted" ? set.assistanceKg : null,
        set.reps,
        set.rpe,
        set.rir ?? null,
        set.restSeconds,
        ...(includePerformed ? [
          set.skipped ? 1 : 0,
          set.warmup ? 1 : 0,
          set.workSeconds ?? null,
          set.precedingRestSeconds ?? null,
          set.rom ?? null,
          set.intent ?? null,
          set.isometric ? 1 : 0,
          set.testedMax ? 1 : 0,
        ] : []),
      ],
    );
  }
}

function serializeTarget(exercise: ExerciseDraft) {
  if (!exercise.target) return null;
  const { assistanceKg, loadKg } = plannedSetTarget(exercise);
  const target: StrengthExerciseRecord["target"] = {
    ...exercise.target,
    loadKg: storedLoad(exercise.loadMode, loadKg),
    assistanceKg: exercise.loadMode === "assisted" ? assistanceKg : null,
  };
  return JSON.stringify(target);
}

function storedLoad(mode: LoadMode, loadKg: number | null) {
  if (mode === "assisted") {
    return null;
  }
  if (loadKg == null || loadKg <= 0) {
    return null;
  }
  return loadKg;
}

function noteOrNull(notes: string) {
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseEmphasis(value: string): StrengthEmphasis {
  return JSON.parse(value) as StrengthEmphasis;
}

function mapCatalog(row: CatalogRow): CatalogExercise {
  return {
    aliases: parseStringList(row.aliases_json),
    defaultLoadMode: row.default_load_mode,
    defaultUnilateral: row.default_unilateral === 1,
    equipment: row.equipment,
    id: row.id,
    muscleGroups: parseStringList(row.muscle_groups_json),
    name: row.name,
    source: row.source,
    sourceRevision: row.source_revision,
    suggestsExplosive: row.suggests_explosive === 1,
    upstreamId: row.upstream_id,
  };
}

function parseStringList(value: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is string => typeof item === "string");
}

async function loadExercises(
  db: SQLiteDatabase,
  snapshot: StrengthSnapshot,
  parentId: string,
) {
  const exercises = await db.getAllAsync<ExerciseRow>(
    `SELECT id, position, exercise_id, name, equipment, muscle_groups_json,
            load_mode, unilateral, explosive_intent, notes, target_json
     FROM strength_${snapshot}_exercises
     WHERE ${snapshot}_id = ?
     ORDER BY position`,
    [parentId],
  );
  if (exercises.length === 0) {
    return [];
  }
  const ids = exercises.map((exercise) => exercise.id);
  const placeholders = ids.map(() => "?").join(", ");
  const performedColumns = snapshot === "session"
    ? ", skipped, warmup, work_seconds, preceding_rest_seconds, rom, intent, isometric, tested_max"
    : "";
  const sets = await db.getAllAsync<SetRow>(
    `SELECT id, ${snapshot}_exercise_id AS parent_id, position, load_kg, assistance_kg,
            reps, rpe, rir, rest_seconds${performedColumns}
     FROM strength_${snapshot}_sets
     WHERE ${snapshot}_exercise_id IN (${placeholders})
     ORDER BY position`,
    ids,
  );
  const byExercise = new Map<string, StrengthSetRecord[]>();
  for (const set of sets) {
    const bucket = byExercise.get(set.parent_id) ?? [];
    bucket.push({
      assistanceKg: set.assistance_kg,
      id: set.id,
      loadKg: set.load_kg,
      position: set.position,
      reps: set.reps,
      restSeconds: set.rest_seconds,
      rpe: set.rpe,
      ...(set.rir != null ? { rir: set.rir } : {}),
      skipped: set.skipped === 1,
      warmup: set.warmup === 1,
      ...(set.work_seconds != null ? { workSeconds: set.work_seconds } : {}),
      ...(set.preceding_rest_seconds != null ? { precedingRestSeconds: set.preceding_rest_seconds } : {}),
      ...(set.rom != null ? { rom: set.rom } : {}),
      ...(set.intent != null ? { intent: set.intent } : {}),
      ...(set.isometric === 1 ? { isometric: true } : {}),
      ...(set.tested_max === 1 ? { testedMax: true } : {}),
    });
    byExercise.set(set.parent_id, bucket);
  }
  return exercises.map((exercise) => ({
    catalogExerciseId: exercise.exercise_id,
    equipment: exercise.equipment,
    explosiveIntent: exercise.explosive_intent === 1,
    id: exercise.id,
    loadMode: exercise.load_mode,
    muscleGroups: parseStringList(exercise.muscle_groups_json),
    name: exercise.name,
    notes: exercise.notes ?? "",
    position: exercise.position,
    sets: byExercise.get(exercise.id) ?? [],
    ...(exercise.target_json ? { target: JSON.parse(exercise.target_json) as StrengthExerciseRecord["target"] } : {}),
    unilateral: exercise.unilateral === 1,
  }));
}
