import type { SQLiteDatabase } from "expo-sqlite";

import { deviceTimeZone, formatLocalDate, isIanaTimeZone } from "../conditioning/dates";
import { createId } from "../conditioning/ids";
import { CATALOG_SEED } from "../strength/catalogSeed";
import {
  projectTemplateDraft,
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
import type {
  CatalogExercise,
  CatalogSource,
  ExerciseDraft,
  LoadMode,
  StrengthDraft,
  StrengthExerciseRecord,
  StrengthSetRecord,
  StrengthTemplateRecord,
} from "../strength/types";
import { addTimelineEntry } from "./timelineRepository";

export type StrengthSessionSummary = {
  emphasis: StrengthEmphasis;
  endedAt: number;
  id: string;
  localEndDate: string;
  title: string;
};

export type StrengthSessionRecord = StrengthSessionSummary & {
  durationSeconds: number;
  exercises: StrengthExerciseRecord[];
  sourceTemplateId: string | null;
  startedAt: number;
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
  rpe: number | null;
  skipped?: number;
  warmup?: number;
};

type StrengthSnapshot = "template" | "session";

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

export async function listStrengthSessionsForDates(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string,
) {
  const rows = await db.getAllAsync<{
    emphasis_json: string;
    ended_at: number;
    id: string;
    local_end_date: string;
    title: string;
  }>(
    `SELECT id, title, ended_at, local_end_date, emphasis_json
     FROM strength_sessions
     WHERE local_end_date >= ? AND local_end_date <= ?
     ORDER BY ended_at, id`,
    [startDate, endDate],
  );
  return rows.map((row) => ({
    emphasis: parseEmphasis(row.emphasis_json),
    endedAt: row.ended_at,
    id: row.id,
    localEndDate: row.local_end_date,
    title: row.title,
  }));
}

export async function getStrengthSession(db: SQLiteDatabase, sessionId: string) {
  const header = await db.getFirstAsync<{
    duration_seconds: number;
    emphasis_json: string;
    ended_at: number;
    id: string;
    local_end_date: string;
    source_template_id: string | null;
    started_at: number;
    timezone: string;
    timeline_entry_id: number;
    title: string;
  }>(
    `SELECT id, title, started_at, ended_at, local_end_date, timezone,
            source_template_id, duration_seconds, emphasis_json, timeline_entry_id
     FROM strength_sessions
     WHERE id = ?`,
    [sessionId],
  );
  if (!header) {
    return null;
  }
  const exercises = await loadExercises(db, "session", sessionId);
  const record: StrengthSessionRecord = {
    durationSeconds: header.duration_seconds,
    emphasis: parseEmphasis(header.emphasis_json),
    endedAt: header.ended_at,
    exercises,
    id: header.id,
    localEndDate: header.local_end_date,
    sourceTemplateId: header.source_template_id,
    startedAt: header.started_at,
    timeZone: header.timezone,
    timelineEntryId: header.timeline_entry_id,
    title: header.title,
  };
  return record;
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
       WHERE se.exercise_id IN (${placeholders})
         AND ss.skipped = 0
         AND ss.warmup = 0
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
  options?: {
    beforeCommit?: () => void;
    now?: number;
    timeZone?: string;
  },
) {
  const existing = await getStrengthSession(db, draft.sessionId);
  if (existing) {
    const replay: StrengthLogResult = {
      alreadySaved: true,
      sessionId: existing.id,
      templateId: existing.sourceTemplateId,
      timelineEntryId: existing.timelineEntryId,
    };
    return replay;
  }

  const now = options?.now ?? Date.now();
  const timeZone = options?.timeZone ?? deviceTimeZone();
  if (!isIanaTimeZone(timeZone)) {
    throw new Error("Choose an end time that is not in the future.");
  }
  const error = validateStrengthDraft(draft, "log", now);
  if (error) {
    throw new Error(error);
  }
  const durationSeconds = estimateDraftDurationSeconds(draft.exercises);
  if (durationSeconds == null) {
    throw new Error("Add at least one work set.");
  }
  const templateDraft = draft.saveAsTemplate ? projectTemplateDraft(draft) : null;
  if (templateDraft) {
    const templateError = validateStrengthDraft(templateDraft, "template", now);
    if (templateError) {
      throw new Error(templateError);
    }
  }

  const references = await listSameLiftReferences(
    db,
    draft.exercises
      .map((exercise) => exercise.catalogExerciseId)
      .filter((id): id is string => id != null),
    draft.endedAt,
  );
  const emphasis = emphasisFromDraft(draft.exercises, references);
  const startedAt = sessionStartMs(draft.endedAt, durationSeconds);
  const localEndDate = formatLocalDate(new Date(draft.endedAt));
  const title = draft.title.trim();
  let templateId = draft.sourceTemplateId;

  await db.withTransactionAsync(async () => {
    const timelineEntryId = Number(
      await addTimelineEntry(db, {
        endAt: draft.endedAt,
        kind: "strength",
        startAt: startedAt,
        status: "completed",
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
    } else if (templateId) {
      await archiveTemplate(db, templateId, now);
    }

    await db.runAsync(
      `INSERT INTO strength_sessions (
        id, title, started_at, ended_at, local_end_date, timezone,
        source_template_id, duration_seconds, emphasis_json, emphasis_version,
        timeline_entry_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.sessionId,
        title,
        startedAt,
        draft.endedAt,
        localEndDate,
        timeZone,
        templateId,
        durationSeconds,
        JSON.stringify(emphasis),
        STRENGTH_EMPHASIS_VERSION,
        timelineEntryId,
        now,
      ],
    );
    await insertExercises(db, "session", draft.sessionId, draft.exercises);
    options?.beforeCommit?.();
  });

  const saved = await getStrengthSession(db, draft.sessionId);
  if (!saved) {
    throw new Error("Strength session did not save.");
  }
  return {
    alreadySaved: false,
    sessionId: saved.id,
    templateId: saved.sourceTemplateId,
    timelineEntryId: saved.timelineEntryId,
  } satisfies StrengthLogResult;
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
  const performedColumns = includePerformed ? ", skipped, warmup" : "";
  const performedValues = includePerformed ? ", ?, ?" : "";

  for (const [index, exercise] of exercises.entries()) {
    await db.runAsync(
      `INSERT INTO strength_${snapshot}_exercises (
        id, ${snapshot}_id, position, exercise_id, name, equipment,
        muscle_groups_json, load_mode, unilateral, explosive_intent, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exercise.id,
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
      ],
    );
    for (const [setIndex, set] of exercise.sets.entries()) {
      await db.runAsync(
        `INSERT INTO strength_${snapshot}_sets (
          id, ${snapshot}_exercise_id, position, load_kg, assistance_kg,
          reps, rpe, rest_seconds${performedColumns}
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?${performedValues})`,
        [
          set.id,
          exercise.id,
          setIndex,
          storedLoad(exercise.loadMode, set.loadKg),
          exercise.loadMode === "assisted" ? set.assistanceKg : null,
          set.reps,
          set.rpe,
          set.restSeconds,
          ...(includePerformed ? [set.skipped ? 1 : 0, set.warmup ? 1 : 0] : []),
        ],
      );
    }
  }
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
            load_mode, unilateral, explosive_intent, notes
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
  const performedColumns = snapshot === "session" ? ", skipped, warmup" : "";
  const sets = await db.getAllAsync<SetRow>(
    `SELECT id, ${snapshot}_exercise_id AS parent_id, position, load_kg, assistance_kg,
            reps, rpe, rest_seconds${performedColumns}
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
      skipped: set.skipped === 1,
      warmup: set.warmup === 1,
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
    unilateral: exercise.unilateral === 1,
  }));
}
