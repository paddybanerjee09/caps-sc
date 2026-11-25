import type { SQLiteDatabase } from "expo-sqlite";

import { deviceTimeZone, formatLocalDate, isIanaTimeZone } from "../conditioning/dates";
import { createId } from "../conditioning/ids";
import { estimateActivities, rpeBandFor, sumEnergyKcal, weightForEstimate } from "../skill/energy";
import { focusFromDisciplines } from "../skill/focus";
import { elapsedSeconds, sessionStartMs } from "../skill/timing";
import { validateSkillDraft } from "../skill/validation";
import {
  SKILL_ENERGY_VERSION,
  type RpeBand,
  type SessionMode,
  type SkillActivityDraft,
  type SkillActivityRecord,
  type SkillDiscipline,
  type SkillDraft,
  type SkillFocus,
  type SkillSessionRecord,
  type SkillSessionSummary,
  type SkillTemplateRecord,
  type TimingMode,
  type WeightBasis,
} from "../skill/types";
import { addTimelineEntry, getWeightKgAtOrBefore } from "./timelineRepository";

export type SkillLogResult = {
  alreadySaved: boolean;
  localEndDate: string;
  sessionId: string;
  timelineEntryId: number;
};

type ActivityRow = {
  activity_key: string;
  base_met: number | null;
  discipline: SkillDiscipline;
  duration_seconds: number | null;
  energy_kcal: number | null;
  id: string;
  name: string;
  position: number;
  rest_between_rounds_seconds: number | null;
  rest_seconds: number | null;
  rounds: number | null;
  rpe_band: RpeBand;
  rpe_multiplier: number | null;
  seconds_per_round: number | null;
  session_mode: SessionMode | null;
  timing_mode: TimingMode;
  sets: number | null;
  reps: number | null;
  rpe: number | null;
  rest_between_sets_seconds: number | null;
  work_seconds: number | null;
};

type TemplateHeader = {
  archived_at: number | null;
  id: string;
  title: string;
  updated_at: number;
};

type SessionHeader = {
  elapsed_seconds: number;
  ended_at: number;
  energy_kcal: number;
  estimator_version: string;
  focus: SkillFocus;
  id: string;
  local_end_date: string;
  source_template_id: string | null;
  started_at: number;
  timeline_entry_id: number;
  timezone: string;
  title: string;
  weight_basis: WeightBasis;
  weight_kg: number;
};

export async function listSkillTemplates(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: string; title: string }>(
    `SELECT id, title
     FROM skill_templates
     WHERE archived_at IS NULL
     ORDER BY title COLLATE NOCASE, id`,
  );
  return rows;
}

export async function getSkillTemplate(db: SQLiteDatabase, templateId: string) {
  const header = await db.getFirstAsync<TemplateHeader>(
    `SELECT id, title, updated_at, archived_at
     FROM skill_templates
     WHERE id = ?`,
    [templateId],
  );
  if (!header) {
    return null;
  }
  const activities = await loadActivities(db, "template", templateId);
  return {
    activities,
    archivedAt: header.archived_at,
    id: header.id,
    title: header.title,
    updatedAt: header.updated_at,
  } satisfies SkillTemplateRecord;
}

export async function listSkillSessionsForDates(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string,
) {
  const rows = await db.getAllAsync<SessionHeader>(
    `SELECT id, title, ended_at, local_end_date, focus
     FROM skill_sessions
     WHERE local_end_date >= ? AND local_end_date <= ?
     ORDER BY ended_at, id`,
    [startDate, endDate],
  );
  return rows.map(
    (row) =>
      ({
        endedAt: row.ended_at,
        focus: row.focus,
        id: row.id,
        localEndDate: row.local_end_date,
        title: row.title,
      }) satisfies SkillSessionSummary,
  );
}

export async function getSkillSession(db: SQLiteDatabase, sessionId: string) {
  const header = await db.getFirstAsync<SessionHeader>(
    `SELECT id, title, started_at, ended_at, local_end_date, timezone,
            source_template_id, elapsed_seconds, focus, energy_kcal, weight_kg,
            weight_basis, estimator_version, timeline_entry_id
     FROM skill_sessions
     WHERE id = ?`,
    [sessionId],
  );
  if (!header) {
    return null;
  }
  const activities = await loadSessionActivities(db, sessionId);
  return {
    activities,
    elapsedSeconds: header.elapsed_seconds,
    endedAt: header.ended_at,
    energyKcal: header.energy_kcal,
    estimatorVersion: header.estimator_version,
    focus: header.focus,
    id: header.id,
    localEndDate: header.local_end_date,
    sourceTemplateId: header.source_template_id,
    startedAt: header.started_at,
    timeZone: header.timezone,
    timelineEntryId: header.timeline_entry_id,
    title: header.title,
    weightBasis: header.weight_basis,
    weightKg: header.weight_kg,
  } satisfies SkillSessionRecord;
}

export async function saveSkillTemplate(
  db: SQLiteDatabase,
  draft: SkillDraft,
  now = Date.now(),
) {
  const error = validateSkillDraft(draft, "template", now);
  if (error) {
    throw new Error(error);
  }
  const title = draft.title.trim();
  let templateId = draft.templateLink === "linked" ? draft.sourceTemplateId : null;

  await db.withTransactionAsync(async () => {
    if (templateId) {
      const updated = await db.runAsync(
        `UPDATE skill_templates
         SET title = ?, updated_at = ?, archived_at = NULL
         WHERE id = ?`,
        [title, now, templateId],
      );
      if (updated.changes !== 1) {
        throw new Error("That saved session is no longer available.");
      }
      await db.runAsync(`DELETE FROM skill_template_activities WHERE template_id = ?`, [
        templateId,
      ]);
    } else {
      templateId = createId();
      await db.runAsync(
        `INSERT INTO skill_templates (id, title, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, NULL)`,
        [templateId, title, now, now],
      );
    }
    await insertActivities(db, "template", templateId, draft.activities);
  });

  return templateId!;
}

export async function archiveSkillTemplate(
  db: SQLiteDatabase,
  templateId: string,
  now = Date.now(),
) {
  const updated = await db.runAsync(
    `UPDATE skill_templates
     SET archived_at = ?, updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
    [now, now, templateId],
  );
  if (updated.changes !== 1) {
    throw new Error("That saved session is no longer available.");
  }
}

export async function logSkillSession(
  db: SQLiteDatabase,
  draft: SkillDraft,
  options?: { beforeCommit?: () => void; now?: number; timeZone?: string },
): Promise<SkillLogResult> {
  const now = options?.now ?? Date.now();
  const timeZone = options?.timeZone ?? deviceTimeZone();
  if (!isIanaTimeZone(timeZone)) {
    throw new Error("The timezone on this device is not valid.");
  }
  const error = validateSkillDraft(draft, "log", now, timeZone);
  if (error) {
    throw new Error(error);
  }
  const existing = await getSkillSession(db, draft.sessionId);
  if (existing) {
    return {
      alreadySaved: true,
      localEndDate: existing.localEndDate,
      sessionId: existing.id,
      timelineEntryId: existing.timelineEntryId,
    };
  }

  const elapsed = elapsedSeconds(draft.activities);
  if (elapsed == null) {
    throw new Error("Add at least one activity.");
  }
  const focus = focusFromDisciplines(draft.activities.map((activity) => activity.discipline));
  if (!focus) {
    throw new Error("Add at least one activity.");
  }
  const loggedWeight = await getWeightKgAtOrBefore(db, draft.endedAt);
  const weight = weightForEstimate(loggedWeight);
  const estimates = estimateActivities(draft.activities, weight.kg);
  if (estimates.length !== draft.activities.length) {
    throw new Error("Choose a mode for every activity that needs one.");
  }
  const energyKcal = sumEnergyKcal(estimates);
  const startedAt = sessionStartMs(draft.endedAt, elapsed);
  const localEndDate = formatLocalDate(new Date(draft.endedAt));
  const title = draft.title.trim();
  const estimateById = new Map(estimates.map((estimate) => [estimate.id, estimate]));

  let timelineEntryId = 0;
  await db.withTransactionAsync(async () => {
    timelineEntryId = Number(
      await addTimelineEntry(db, {
        endAt: draft.endedAt,
        kind: "skill",
        startAt: startedAt,
        status: "completed",
        title,
      }),
    );
    await db.runAsync(
      `INSERT INTO skill_sessions (
        id, title, started_at, ended_at, local_end_date, timezone,
        source_template_id, elapsed_seconds, focus, energy_kcal, weight_kg,
        weight_basis, estimator_version, timeline_entry_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.sessionId,
        title,
        startedAt,
        draft.endedAt,
        localEndDate,
        timeZone,
        draft.sourceTemplateId,
        elapsed,
        focus,
        energyKcal,
        weight.kg,
        weight.basis,
        SKILL_ENERGY_VERSION,
        timelineEntryId,
        now,
      ],
    );
    await insertActivities(db, "session", draft.sessionId, draft.activities, estimateById);
    options?.beforeCommit?.();
  });

  return {
    alreadySaved: false,
    localEndDate,
    sessionId: draft.sessionId,
    timelineEntryId,
  };
}

async function loadActivities(
  db: SQLiteDatabase,
  parent: "template",
  parentId: string,
) {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT id, position, activity_key, name, discipline, timing_mode,
            duration_seconds, rounds, seconds_per_round, rest_between_rounds_seconds,
            rpe_band, session_mode, sets, reps, rpe, rest_between_sets_seconds, NULL AS work_seconds, NULL AS rest_seconds,
            NULL AS base_met, NULL AS rpe_multiplier, NULL AS energy_kcal
     FROM skill_${parent}_activities
     WHERE ${parent}_id = ?
     ORDER BY position`,
    [parentId],
  );
  return rows.map(toDraftActivity);
}

async function loadSessionActivities(db: SQLiteDatabase, sessionId: string) {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT id, position, activity_key, name, discipline, timing_mode,
            duration_seconds, rounds, seconds_per_round, rest_between_rounds_seconds,
            rpe_band, session_mode, sets, reps, rpe, rest_between_sets_seconds, work_seconds, rest_seconds, base_met,
            rpe_multiplier, energy_kcal
     FROM skill_session_activities
     WHERE session_id = ?
     ORDER BY position`,
    [sessionId],
  );
  return rows.map((row) => {
    const draft = toDraftActivity(row);
    return {
      ...draft,
      baseMet: row.base_met ?? 0,
      energyKcal: row.energy_kcal ?? 0,
      position: row.position,
      restSeconds: row.rest_seconds ?? 0,
      rpeMultiplier: row.rpe_multiplier ?? 0,
      workSeconds: row.work_seconds ?? 0,
    } satisfies SkillActivityRecord;
  });
}

function toDraftActivity(row: ActivityRow): SkillActivityDraft {
  return {
    activityKey: row.activity_key,
    discipline: row.discipline,
    durationSeconds: row.duration_seconds ?? 180,
    id: row.id,
    name: row.name,
    restBetweenRoundsSeconds: row.rest_between_rounds_seconds ?? 60,
    rounds: row.rounds ?? 3,
    rpeBand: row.rpe_band,
    sets: row.sets ?? 1,
    reps: row.reps ?? 5,
    rpe: row.rpe,
    restBetweenSetsSeconds: row.rest_between_sets_seconds,
    secondsPerRound: row.seconds_per_round ?? 180,
    sessionMode: row.session_mode,
    timingMode: row.timing_mode,
  };
}

async function insertActivities(
  db: SQLiteDatabase,
  parent: "template" | "session",
  parentId: string,
  activities: readonly SkillActivityDraft[],
  estimates?: Map<string, ReturnType<typeof estimateActivities>[number]>,
) {
  for (const [index, activity] of activities.entries()) {
    const duration = activity.timingMode === "duration";
    const rounds = activity.timingMode === "rounds";
    const reps = activity.timingMode === "reps";
    const estimate = estimates?.get(activity.id);
    const performedColumns = estimates
      ? ", work_seconds, rest_seconds, base_met, rpe_multiplier, energy_kcal"
      : "";
    const performedValues = estimates ? ", ?, ?, ?, ?, ?" : "";
    const params: (string | number | null)[] = [
      parent === "session" ? activity.id : createId(),
      parentId,
      index,
      activity.activityKey,
      activity.name.trim(),
      activity.discipline,
      activity.timingMode,
      duration ? activity.durationSeconds : null,
      rounds ? activity.rounds : null,
      rounds ? activity.secondsPerRound : null,
      rounds ? activity.restBetweenRoundsSeconds : null,
      rpeBandFor(activity.rpe, activity.rpeBand),
      activity.sessionMode,
      reps ? activity.sets : null,
      reps ? activity.reps : null,
      activity.rpe,
      reps ? activity.restBetweenSetsSeconds : null,
    ];
    if (estimate) {
      params.push(
        estimate.workSeconds,
        estimate.restSeconds,
        estimate.baseMet,
        estimate.rpeMultiplier,
        estimate.energyKcal,
      );
    }
    await db.runAsync(
      `INSERT INTO skill_${parent}_activities (
        id, ${parent}_id, position, activity_key, name, discipline, timing_mode,
        duration_seconds, rounds, seconds_per_round, rest_between_rounds_seconds,
        rpe_band, session_mode, sets, reps, rpe, rest_between_sets_seconds${performedColumns}
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${performedValues})`,
      params,
    );
  }
}
