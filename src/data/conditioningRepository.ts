import type { SQLiteDatabase } from "expo-sqlite";

import {
  isIanaTimeZone,
  isLocalDateString,
  isLocalTimeString,
  isPerformedTimestampAllowed,
  localDateFromInstant,
  scheduledInstant,
} from "../conditioning/dates";
import { createId } from "../conditioning/ids";
import type {
  CircuitConfig,
  ConditioningFormat,
  FreeActivity,
  LocationPointInput,
  OccurrenceInput,
  SegmentInput,
  SessionSource,
  SessionStatus,
  SplitInput,
  StationConfig,
  SyncStatus,
  TemplateConfig,
  WorkoutSnapshot,
} from "../conditioning/types";
import { SNAPSHOT_VERSION } from "../conditioning/types";
import {
  throwIfInvalid,
  validateActual,
  validateOptionalRpe,
  validateSnapshot,
  validateTemplateConfig,
} from "../conditioning/validation";
import { addTimelineEntry } from "./timelineRepository";

let writeQueue: Promise<void> = Promise.resolve();

export function enqueueConditioningWrite<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function inTransaction<T>(db: SQLiteDatabase, task: () => Promise<T>) {
  let value!: T;
  await db.withTransactionAsync(async () => {
    value = await task();
  });
  return value;
}

export type ConditioningTemplateRecord = {
  archivedAt: number | null;
  config: TemplateConfig;
  configVersion: number;
  createdAt: number;
  format: TemplateConfig["format"];
  id: string;
  lastUsedAt: number | null;
  ownerId: string;
  title: string;
  updatedAt: number;
};

export type ConditioningSessionRecord = {
  activeSeconds: number | null;
  activityType: FreeActivity | null;
  createdAt: number;
  distanceMeters: number | null;
  elapsedSeconds: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  elevationProcessingVersion: string | null;
  emphasisJson: string | null;
  finishedAt: number | null;
  format: ConditioningFormat;
  gpsProcessingVersion: string | null;
  id: string;
  notes: string | null;
  ownerId: string;
  performedAt: number | null;
  performedLocalDate: string | null;
  performedTimezone: string | null;
  scheduledLocalDate: string | null;
  scheduledLocalStartTime: string | null;
  schedulingTimezone: string | null;
  sessionRpe: number | null;
  snapshot: WorkoutSnapshot;
  snapshotVersion: number;
  source: SessionSource;
  startedFromPlan: boolean;
  status: SessionStatus;
  syncStatus: SyncStatus;
  targetRpe: number | null;
  templateId: string | null;
  timelineEntryId: number | null;
  title: string;
  updatedAt: number;
};

export type UploadJobRecord = {
  acknowledgedOccurrenceCount: number;
  acknowledgedPointSequence: number;
  acknowledgedSplitCount: number;
  expectedOccurrenceCount: number;
  expectedPointCount: number;
  expectedSplitCount: number;
  lastError: string | null;
  retryCount: number;
  sessionId: string;
  status: "pending" | "uploading" | "synced" | "failed";
  updatedAt: number;
};

type SessionMetrics = {
  activeSeconds?: number | null;
  distanceMeters?: number | null;
  elapsedSeconds?: number | null;
  elevationGainMeters?: number | null;
  elevationLossMeters?: number | null;
  elevationProcessingVersion?: string | null;
  gpsProcessingVersion?: string | null;
};

const sessionSelect = `
  id, owner_id, template_id, started_from_plan, timeline_entry_id, title, format,
  activity_type, status, sync_status, snapshot_json, snapshot_version,
  scheduled_local_date, scheduling_timezone, scheduled_local_start_time,
  performed_at, finished_at, performed_local_date, performed_timezone,
  active_seconds, elapsed_seconds, distance_meters, elevation_gain_meters,
  elevation_loss_meters, target_rpe, session_rpe, notes, source,
  gps_processing_version, elevation_processing_version, emphasis_json,
  created_at, updated_at
`;

export function getConditioningOwnerId(db: SQLiteDatabase) {
  return enqueueConditioningWrite(() => ensureOwner(db));
}

export function saveConditioningTemplate(
  db: SQLiteDatabase,
  ownerId: string,
  config: TemplateConfig,
  templateId?: string,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      throwIfInvalid(validateTemplateConfig(config));
      const now = Date.now();
      const id = templateId ?? createId();
      const existing = await getTemplateRow(db, ownerId, id);
      const stored: TemplateConfig = {
        ...config,
        circuit: config.circuit
          ? {
              ...config.circuit,
              stations: config.circuit.stations.map((station, position) => ({
                ...station,
                exerciseName: station.exerciseName.trim(),
                position,
              })),
            }
          : null,
        notes: cleanNotes(config.notes),
        title: config.title.trim(),
      };

      if (!existing) {
        await db.runAsync(
          `INSERT INTO conditioning_templates (
            id, owner_id, title, format, config_json, config_version,
            archived_at, created_at, updated_at, last_used_at
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
          [
            id,
            ownerId,
            stored.title,
            stored.format,
            JSON.stringify(stored),
            SNAPSHOT_VERSION,
            now,
            now,
          ],
        );
      } else {
        await db.runAsync(
          `UPDATE conditioning_templates
           SET title = ?, format = ?, config_json = ?, config_version = ?, updated_at = ?
           WHERE id = ? AND owner_id = ?`,
          [
            stored.title,
            stored.format,
            JSON.stringify(stored),
            SNAPSHOT_VERSION,
            now,
            id,
            ownerId,
          ],
        );
      }

      await replaceTemplateStations(db, id, stored.circuit);
      const saved = await getTemplateRow(db, ownerId, id);
      if (!saved) {
        throw new Error("Workout could not be saved");
      }

      return mapTemplate(db, saved);
    }),
  );
}

export async function listConditioningTemplates(db: SQLiteDatabase, ownerId: string) {
  const rows = await db.getAllAsync<TemplateRow>(
    `SELECT id, owner_id, title, format, config_json, config_version, archived_at,
            created_at, updated_at, last_used_at
     FROM conditioning_templates
     WHERE owner_id = ? AND archived_at IS NULL
     ORDER BY last_used_at IS NULL, last_used_at DESC, updated_at DESC, id ASC`,
    [ownerId],
  );
  return Promise.all(rows.map((row) => mapTemplate(db, row)));
}

export async function getConditioningTemplate(
  db: SQLiteDatabase,
  ownerId: string,
  templateId: string,
) {
  const row = await getTemplateRow(db, ownerId, templateId);
  return row ? mapTemplate(db, row) : null;
}

export function archiveConditioningTemplate(
  db: SQLiteDatabase,
  ownerId: string,
  templateId: string,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const result = await db.runAsync(
        `UPDATE conditioning_templates
         SET archived_at = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
        [Date.now(), Date.now(), templateId, ownerId],
      );
      if (result.changes !== 1) {
        throw new Error("Workout not found");
      }
    }),
  );
}

export function planConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  input: {
    notes?: string | null;
    scheduledLocalDate: string;
    scheduledLocalStartTime?: string | null;
    schedulingTimezone: string;
    snapshot: WorkoutSnapshot;
    templateId?: string | null;
  },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const snapshot = checkedSnapshot(input.snapshot);
      const schedule = checkedSchedule(
        input.scheduledLocalDate,
        input.schedulingTimezone,
        input.scheduledLocalStartTime ?? null,
      );
      const now = Date.now();
      const id = createId();
      const startAt = scheduledInstant(
        schedule.date,
        schedule.time,
      );
      if (startAt === null) {
        throw new Error("Planned date is invalid");
      }

      const timelineEntryId = Number(
        await addTimelineEntry(db, {
          endAt: null,
          kind: "conditioning",
          notes: snapshot.notes,
          startAt,
          status: "planned",
          title: snapshot.title,
        }),
      );
      await insertSession(db, {
        activityType: snapshot.activityType,
        createdAt: now,
        format: snapshot.format,
        id,
        notes: snapshot.notes,
        ownerId,
        scheduledLocalDate: schedule.date,
        scheduledLocalStartTime: schedule.time,
        schedulingTimezone: schedule.timezone,
        sessionRpe: null,
        snapshot,
        source: "manual",
        startedFromPlan: false,
        status: "planned",
        syncStatus: "local_only",
        targetRpe: snapshot.targetRpe,
        templateId: input.templateId ?? null,
        timelineEntryId,
        title: snapshot.title,
        updatedAt: now,
      });
      return requiredSession(db, ownerId, id);
    }),
  );
}

export function updatePlannedConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  input: {
    scheduledLocalDate: string;
    scheduledLocalStartTime?: string | null;
    schedulingTimezone: string;
    snapshot: WorkoutSnapshot;
  },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const existing = await requiredSession(db, ownerId, sessionId);
      if (existing.status !== "planned") {
        throw new Error("Only a planned session can be edited");
      }

      const snapshot = checkedSnapshot(input.snapshot);
      const schedule = checkedSchedule(
        input.scheduledLocalDate,
        input.schedulingTimezone,
        input.scheduledLocalStartTime ?? null,
      );
      const now = Date.now();
      await db.runAsync(
        `UPDATE conditioning_sessions
         SET title = ?, format = ?, activity_type = ?, snapshot_json = ?,
             snapshot_version = ?, scheduled_local_date = ?, scheduling_timezone = ?,
             scheduled_local_start_time = ?, target_rpe = ?, notes = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND status = 'planned'`,
        [
          snapshot.title,
          snapshot.format,
          snapshot.activityType,
          JSON.stringify(snapshot),
          snapshot.version,
          schedule.date,
          schedule.timezone,
          schedule.time,
          snapshot.targetRpe,
          snapshot.notes,
          now,
          sessionId,
          ownerId,
        ],
      );
      await updateTimeline(db, existing.timelineEntryId, {
        endAt: null,
        notes: snapshot.notes,
        startAt: scheduledInstant(schedule.date, schedule.time) ?? now,
        status: "planned",
        title: snapshot.title,
        updatedAt: now,
      });
      return requiredSession(db, ownerId, sessionId);
    }),
  );
}

export function startConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  input:
    | { performedAt: number; planSessionId: string; timezone: string }
    | {
        performedAt: number;
        snapshot: WorkoutSnapshot;
        templateId?: string | null;
        timezone: string;
      },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      assertPast("performedAt", input.performedAt);
      if (!isIanaTimeZone(input.timezone)) {
        throw new Error("Timezone is invalid");
      }

      await assertNoActiveRecording(db, ownerId);
      const now = Date.now();

      if ("planSessionId" in input) {
        const plan = await requiredSession(db, ownerId, input.planSessionId);
        if (plan.status !== "planned") {
          throw new Error("Start the planned session before it is logged");
        }

        await db.runAsync(
          `UPDATE conditioning_sessions
           SET status = 'in_progress', source = 'live', started_from_plan = 1,
               performed_at = ?, performed_local_date = ?, performed_timezone = ?,
               updated_at = ?
           WHERE id = ? AND owner_id = ? AND status = 'planned'`,
          [
            input.performedAt,
            localDateFromInstant(input.performedAt),
            input.timezone,
            now,
            plan.id,
            ownerId,
          ],
        );
        await markTemplateUsed(db, ownerId, plan.templateId, input.performedAt);
        return requiredSession(db, ownerId, plan.id);
      }

      const snapshot = checkedSnapshot(input.snapshot);
      const id = createId();
      const timelineEntryId = Number(
        await addTimelineEntry(db, {
          kind: "conditioning",
          notes: snapshot.notes,
          startAt: input.performedAt,
          status: "planned",
          title: snapshot.title,
        }),
      );
      await insertSession(db, {
        activityType: snapshot.activityType,
        createdAt: now,
        format: snapshot.format,
        id,
        notes: snapshot.notes,
        ownerId,
        performedAt: input.performedAt,
        performedLocalDate: localDateFromInstant(input.performedAt),
        performedTimezone: input.timezone,
        sessionRpe: null,
        snapshot,
        source: "live",
        startedFromPlan: false,
        status: "in_progress",
        syncStatus: "local_only",
        targetRpe: snapshot.targetRpe,
        templateId: input.templateId ?? null,
        timelineEntryId,
        title: snapshot.title,
        updatedAt: now,
      });
      await markTemplateUsed(db, ownerId, input.templateId ?? null, input.performedAt);
      return requiredSession(db, ownerId, id);
    }),
  );
}

export function finishConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  input: SessionMetrics & {
    finishedAt: number;
    occurrences?: OccurrenceInput[];
    segments?: SegmentInput[];
    splits?: SplitInput[];
  },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const existing = await requiredSession(db, ownerId, sessionId);
      if (existing.status !== "in_progress") {
        throw new Error("Only an active session can be finished for review");
      }

      if (
        existing.performedAt === null ||
        input.finishedAt < existing.performedAt
      ) {
        throw new Error("Finish time is invalid");
      }

      const now = Date.now();
      await db.runAsync(
        `UPDATE conditioning_sessions
         SET status = 'finished_draft', finished_at = ?, active_seconds = ?,
             elapsed_seconds = ?, distance_meters = ?, elevation_gain_meters = ?,
             elevation_loss_meters = ?, gps_processing_version = ?,
             elevation_processing_version = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [
          input.finishedAt,
          input.activeSeconds ?? null,
          input.elapsedSeconds ?? null,
          input.distanceMeters ?? null,
          input.elevationGainMeters ?? null,
          input.elevationLossMeters ?? null,
          input.gpsProcessingVersion ?? null,
          input.elevationProcessingVersion ?? null,
          now,
          sessionId,
          ownerId,
        ],
      );
      if (input.occurrences) {
        await replaceOccurrences(db, sessionId, input.occurrences);
      }
      if (input.segments) {
        await replaceSegments(db, sessionId, input.segments);
      }
      if (input.splits) {
        await replaceSplits(db, sessionId, input.splits);
      }
      return requiredSession(db, ownerId, sessionId);
    }),
  );
}

export function saveConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  input: {
    emphasisJson?: string | null;
    notes?: string | null;
    occurrences?: OccurrenceInput[];
    sessionRpe?: number | null;
    status: "completed" | "ended_early";
  },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const existing = await requiredSession(db, ownerId, sessionId);
      if (existing.status === "completed" || existing.status === "ended_early") {
        return existing;
      }

      if (existing.status !== "finished_draft") {
        throw new Error("Review the session before saving it");
      }

      const sessionRpe = input.sessionRpe ?? null;
      throwIfInvalid(validateOptionalRpe(sessionRpe, "sessionRpe"));
      const notes = input.notes === undefined ? existing.notes : cleanNotes(input.notes);
      const now = Date.now();
      await db.runAsync(
        `UPDATE conditioning_sessions
         SET status = ?, sync_status = 'pending', session_rpe = ?, notes = ?,
             emphasis_json = ?, updated_at = ?
         WHERE id = ? AND owner_id = ? AND status = 'finished_draft'`,
        [
          input.status,
          sessionRpe,
          notes,
          input.emphasisJson ?? existing.emphasisJson,
          now,
          sessionId,
          ownerId,
        ],
      );
      if (input.occurrences) {
        await replaceOccurrences(db, sessionId, input.occurrences);
      }
      await ensureUploadJob(db, sessionId, now);
      await updateTimeline(db, existing.timelineEntryId, {
        endAt: existing.finishedAt,
        notes,
        startAt: existing.performedAt ?? now,
        status: "completed",
        title: existing.title,
        updatedAt: now,
      });
      return requiredSession(db, ownerId, sessionId);
    }),
  );
}

export function logConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  input: {
    emphasisJson?: string | null;
    finishedAt: number;
    metrics?: SessionMetrics;
    notes?: string | null;
    occurrences?: OccurrenceInput[];
    performedAt: number;
    planSessionId?: string | null;
    sessionRpe?: number | null;
    snapshot: WorkoutSnapshot;
    splits?: SplitInput[];
    status?: "completed" | "ended_early";
    templateId?: string | null;
    timezone: string;
  },
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      assertPast("performedAt", input.performedAt);
      if (input.finishedAt < input.performedAt || input.finishedAt > Date.now()) {
        throw new Error("Finish time is invalid");
      }
      if (!isIanaTimeZone(input.timezone)) {
        throw new Error("Timezone is invalid");
      }

      const snapshot = checkedSnapshot(input.snapshot);
      const sessionRpe = input.sessionRpe ?? null;
      throwIfInvalid(validateOptionalRpe(sessionRpe, "sessionRpe"));
      const status = input.status ?? "completed";
      const now = Date.now();
      const notes = input.notes === undefined ? snapshot.notes : cleanNotes(input.notes);

      if (input.planSessionId) {
        const plan = await requiredSession(db, ownerId, input.planSessionId);
        if (plan.status === "completed" || plan.status === "ended_early") {
          return plan;
        }
        if (plan.status !== "planned") {
          throw new Error("Log this session from its plan or its review screen");
        }

        await db.runAsync(
          `UPDATE conditioning_sessions
           SET title = ?, format = ?, activity_type = ?, status = ?, sync_status = 'pending',
               snapshot_json = ?, snapshot_version = ?, source = 'manual',
               performed_at = ?, finished_at = ?, performed_local_date = ?,
               performed_timezone = ?, active_seconds = ?, elapsed_seconds = ?,
               distance_meters = ?, elevation_gain_meters = ?, elevation_loss_meters = ?,
               target_rpe = ?, session_rpe = ?, notes = ?, gps_processing_version = ?,
               elevation_processing_version = ?, emphasis_json = ?, updated_at = ?
           WHERE id = ? AND owner_id = ? AND status = 'planned'`,
          [
            snapshot.title,
            snapshot.format,
            snapshot.activityType,
            status,
            JSON.stringify(snapshot),
            snapshot.version,
            input.performedAt,
            input.finishedAt,
            localDateFromInstant(input.performedAt),
            input.timezone,
            input.metrics?.activeSeconds ?? null,
            input.metrics?.elapsedSeconds ?? null,
            input.metrics?.distanceMeters ?? null,
            input.metrics?.elevationGainMeters ?? null,
            input.metrics?.elevationLossMeters ?? null,
            snapshot.targetRpe,
            sessionRpe,
            notes,
            input.metrics?.gpsProcessingVersion ?? null,
            input.metrics?.elevationProcessingVersion ?? null,
            input.emphasisJson ?? null,
            now,
            plan.id,
            ownerId,
          ],
        );
        if (input.occurrences) {
          await replaceOccurrences(db, plan.id, input.occurrences);
        }
        if (input.splits) {
          await replaceSplits(db, plan.id, input.splits);
        }
        await ensureUploadJob(db, plan.id, now);
        await markTemplateUsed(db, ownerId, plan.templateId, input.performedAt);
        await updateTimeline(db, plan.timelineEntryId, {
          endAt: input.finishedAt,
          notes,
          startAt: input.performedAt,
          status: "completed",
          title: snapshot.title,
          updatedAt: now,
        });
        return requiredSession(db, ownerId, plan.id);
      }

      const id = createId();
      const timelineEntryId = Number(
        await addTimelineEntry(db, {
          endAt: input.finishedAt,
          kind: "conditioning",
          notes,
          startAt: input.performedAt,
          status: "completed",
          title: snapshot.title,
        }),
      );
      await insertSession(db, {
        activeSeconds: input.metrics?.activeSeconds ?? null,
        activityType: snapshot.activityType,
        createdAt: now,
        distanceMeters: input.metrics?.distanceMeters ?? null,
        elapsedSeconds: input.metrics?.elapsedSeconds ?? null,
        elevationGainMeters: input.metrics?.elevationGainMeters ?? null,
        elevationLossMeters: input.metrics?.elevationLossMeters ?? null,
        elevationProcessingVersion: input.metrics?.elevationProcessingVersion ?? null,
        emphasisJson: input.emphasisJson ?? null,
        finishedAt: input.finishedAt,
        format: snapshot.format,
        gpsProcessingVersion: input.metrics?.gpsProcessingVersion ?? null,
        id,
        notes,
        ownerId,
        performedAt: input.performedAt,
        performedLocalDate: localDateFromInstant(input.performedAt),
        performedTimezone: input.timezone,
        sessionRpe,
        snapshot,
        source: "manual",
        startedFromPlan: false,
        status,
        syncStatus: "pending",
        targetRpe: snapshot.targetRpe,
        templateId: input.templateId ?? null,
        timelineEntryId,
        title: snapshot.title,
        updatedAt: now,
      });
      if (input.occurrences) {
        await replaceOccurrences(db, id, input.occurrences);
      }
      if (input.splits) {
        await replaceSplits(db, id, input.splits);
      }
      await ensureUploadJob(db, id, now);
      await markTemplateUsed(db, ownerId, input.templateId ?? null, input.performedAt);
      return requiredSession(db, ownerId, id);
    }),
  );
}

export function discardConditioningRecording(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const existing = await requiredSession(db, ownerId, sessionId);
      if (existing.status !== "in_progress" && existing.status !== "finished_draft") {
        throw new Error("There is no recording to discard");
      }

      await deleteSessionChildren(db, sessionId);
      if (!existing.startedFromPlan) {
        await db.runAsync(
          `DELETE FROM conditioning_sessions WHERE id = ? AND owner_id = ?`,
          [sessionId, ownerId],
        );
        if (existing.timelineEntryId !== null) {
          await db.runAsync(
            `DELETE FROM timeline_entries WHERE id = ? AND kind = 'conditioning'`,
            [existing.timelineEntryId],
          );
        }
        return;
      }

      const now = Date.now();
      await db.runAsync(
        `UPDATE conditioning_sessions
         SET status = 'planned', source = 'manual', started_from_plan = 0,
             performed_at = NULL, finished_at = NULL, performed_local_date = NULL,
             performed_timezone = NULL, active_seconds = NULL, elapsed_seconds = NULL,
             distance_meters = NULL, elevation_gain_meters = NULL,
             elevation_loss_meters = NULL, session_rpe = NULL,
             gps_processing_version = NULL, elevation_processing_version = NULL,
             emphasis_json = NULL, sync_status = 'local_only', updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [now, sessionId, ownerId],
      );
      const restored = await requiredSession(db, ownerId, sessionId);
      await updateTimeline(db, restored.timelineEntryId, {
        endAt: null,
        notes: restored.notes,
        startAt:
          scheduledInstant(
            restored.scheduledLocalDate ?? localDateFromInstant(now),
            restored.scheduledLocalStartTime,
          ) ?? now,
        status: "planned",
        title: restored.title,
        updatedAt: now,
      });
    }),
  );
}

export function cancelPlannedConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      const existing = await requiredSession(db, ownerId, sessionId);
      if (existing.status !== "planned") {
        throw new Error("Only a planned session can be cancelled");
      }

      await db.runAsync(
        `UPDATE conditioning_sessions
         SET status = 'cancelled', updated_at = ?
         WHERE id = ? AND owner_id = ?`,
        [Date.now(), sessionId, ownerId],
      );
      if (existing.timelineEntryId !== null) {
        await db.runAsync(
          `DELETE FROM timeline_entries WHERE id = ? AND kind = 'conditioning'`,
          [existing.timelineEntryId],
        );
      }
    }),
  );
}

export async function getConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT ${sessionSelect}
     FROM conditioning_sessions
     WHERE id = ? AND owner_id = ?`,
    [sessionId, ownerId],
  );
  return row ? mapSession(row) : null;
}

export async function listConditioningSessionsForDates(
  db: SQLiteDatabase,
  ownerId: string,
  startDate: string,
  endDate: string,
) {
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT ${sessionSelect}
     FROM conditioning_sessions
     WHERE owner_id = ?
       AND status != 'cancelled'
       AND (
         (performed_local_date >= ? AND performed_local_date <= ?)
         OR (
           performed_local_date IS NULL
           AND scheduled_local_date >= ?
           AND scheduled_local_date <= ?
         )
       )
     ORDER BY COALESCE(performed_at, created_at), id`,
    [ownerId, startDate, endDate, startDate, endDate],
  );
  return rows.map(mapSession);
}

export async function findInProgressConditioningSession(
  db: SQLiteDatabase,
  ownerId: string,
) {
  const row = await db.getFirstAsync<SessionRow>(
    `SELECT ${sessionSelect}
     FROM conditioning_sessions
     WHERE owner_id = ? AND status = 'in_progress'
     ORDER BY performed_at DESC
     LIMIT 1`,
    [ownerId],
  );
  return row ? mapSession(row) : null;
}

export function insertConditioningLocationPoints(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  points: LocationPointInput[],
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      await requiredSession(db, ownerId, sessionId);
      for (const point of points) {
        await insertPoint(db, sessionId, point);
      }
    }),
  );
}

export async function listConditioningLocationPoints(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const session = await getConditioningSession(db, ownerId, sessionId);
  if (!session) {
    return [];
  }

  return db.getAllAsync<LocationPointInput & { sessionId: string }>(
    `SELECT sequence, segment_id AS segmentId, recorded_at AS recordedAt,
            latitude, longitude, horizontal_accuracy AS horizontalAccuracy,
            altitude, altitude_accuracy AS altitudeAccuracy, acceptance,
            rejection_reason AS rejectionReason,
            distance_delta_meters AS distanceDeltaMeters
     FROM conditioning_location_points
     WHERE session_id = ?
     ORDER BY sequence`,
    [sessionId],
  );
}

export function replaceConditioningOccurrences(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  occurrences: OccurrenceInput[],
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      await requiredSession(db, ownerId, sessionId);
      await replaceOccurrences(db, sessionId, occurrences);
    }),
  );
}

export async function listConditioningOccurrences(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const session = await getConditioningSession(db, ownerId, sessionId);
  if (!session) {
    return [];
  }

  const rows = await db.getAllAsync<OccurrenceRow>(
    `SELECT id, position, station_id, round_index, set_index, phase_type, target_json,
            started_at, ended_at, work_seconds, completion_method, completion_status,
            actual_json
     FROM conditioning_occurrences
     WHERE session_id = ?
     ORDER BY position`,
    [sessionId],
  );
  return rows.map(mapOccurrence);
}

export function mergeConditioningRunnerState(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  patch: Record<string, unknown>,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      await requiredSession(db, ownerId, sessionId);
      const existing = await db.getFirstAsync<{ state_json: string }>(
        "SELECT state_json FROM conditioning_runner_state WHERE session_id = ?",
        [sessionId],
      );
      const current = existing ? (JSON.parse(existing.state_json) as Record<string, unknown>) : {};
      const next = { ...current, ...patch };
      await db.runAsync(
        `INSERT INTO conditioning_runner_state (session_id, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
        [sessionId, JSON.stringify(next), Date.now()],
      );
      return next;
    }),
  );
}

export function saveConditioningRunnerState(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  stateJson: string,
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      await requiredSession(db, ownerId, sessionId);
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO conditioning_runner_state (session_id, state_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           state_json = excluded.state_json,
           updated_at = excluded.updated_at`,
        [sessionId, stateJson, now],
      );
    }),
  );
}

export async function getConditioningRunnerState(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const session = await getConditioningSession(db, ownerId, sessionId);
  if (!session) {
    return null;
  }

  return db.getFirstAsync<{ stateJson: string; updatedAt: number }>(
    `SELECT state_json AS stateJson, updated_at AS updatedAt
     FROM conditioning_runner_state
     WHERE session_id = ?`,
    [sessionId],
  );
}

export async function getConditioningUploadJob(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const session = await getConditioningSession(db, ownerId, sessionId);
  if (!session) {
    return null;
  }

  return db.getFirstAsync<UploadJobRecord>(
    `SELECT session_id AS sessionId, status, retry_count AS retryCount,
            acknowledged_point_sequence AS acknowledgedPointSequence,
            acknowledged_occurrence_count AS acknowledgedOccurrenceCount,
            acknowledged_split_count AS acknowledgedSplitCount,
            expected_point_count AS expectedPointCount,
            expected_occurrence_count AS expectedOccurrenceCount,
            expected_split_count AS expectedSplitCount,
            last_error AS lastError, updated_at AS updatedAt
     FROM conditioning_upload_jobs
     WHERE session_id = ?`,
    [sessionId],
  );
}

export function replaceConditioningSplits(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
  splits: SplitInput[],
) {
  return enqueueConditioningWrite(() =>
    inTransaction(db, async () => {
      await requireDeviceOwner(db, ownerId);
      await requiredSession(db, ownerId, sessionId);
      await replaceSplits(db, sessionId, splits);
    }),
  );
}

async function ensureOwner(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM conditioning_owner WHERE singleton = 1",
  );
  if (existing) {
    return existing.id;
  }

  const id = createId();
  try {
    await db.runAsync(
      "INSERT INTO conditioning_owner (singleton, id) VALUES (1, ?)",
      [id],
    );
    return id;
  } catch {
    const retry = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM conditioning_owner WHERE singleton = 1",
    );
    if (!retry) {
      throw new Error("Could not create the local conditioning owner");
    }
    return retry.id;
  }
}

async function requireDeviceOwner(db: SQLiteDatabase, ownerId: string) {
  const actual = await ensureOwner(db);
  if (actual !== ownerId) {
    throw new Error("Session not found");
  }
}

async function assertNoActiveRecording(db: SQLiteDatabase, ownerId: string) {
  const active = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM conditioning_sessions
     WHERE owner_id = ? AND status = 'in_progress'
     LIMIT 1`,
    [ownerId],
  );
  if (active) {
    throw new Error("Finish or discard the active session before starting another");
  }
}

function checkedSnapshot(snapshot: WorkoutSnapshot) {
  throwIfInvalid(validateSnapshot(snapshot));
  return {
    ...snapshot,
    notes: cleanNotes(snapshot.notes),
    title: snapshot.title.trim(),
  };
}

function checkedSchedule(
  date: string,
  timezone: string,
  time: string | null,
) {
  if (!isLocalDateString(date)) {
    throw new Error("Planned date is invalid");
  }
  if (!isIanaTimeZone(timezone)) {
    throw new Error("Timezone is invalid");
  }
  if (time !== null && !isLocalTimeString(time)) {
    throw new Error("Planned time is invalid");
  }

  return { date, time, timezone };
}

function assertPast(field: string, timestamp: number) {
  if (!isPerformedTimestampAllowed(timestamp)) {
    throw new Error(
      field === "performedAt"
        ? "Performed time cannot be in the future"
        : "Time cannot be in the future",
    );
  }
}

function cleanNotes(notes: string | null | undefined) {
  if (notes == null) {
    return null;
  }

  const trimmed = notes.trim();
  return trimmed ? trimmed : null;
}

async function markTemplateUsed(
  db: SQLiteDatabase,
  ownerId: string,
  templateId: string | null,
  usedAt: number,
) {
  if (!templateId) {
    return;
  }

  await db.runAsync(
    `UPDATE conditioning_templates
     SET last_used_at = ?
     WHERE id = ? AND owner_id = ? AND archived_at IS NULL`,
    [usedAt, templateId, ownerId],
  );
}

async function requiredSession(
  db: SQLiteDatabase,
  ownerId: string,
  sessionId: string,
) {
  const session = await getConditioningSession(db, ownerId, sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  return session;
}

async function insertSession(
  db: SQLiteDatabase,
  session: {
    activeSeconds?: number | null;
    activityType: FreeActivity | null;
    createdAt: number;
    distanceMeters?: number | null;
    elapsedSeconds?: number | null;
    elevationGainMeters?: number | null;
    elevationLossMeters?: number | null;
    elevationProcessingVersion?: string | null;
    emphasisJson?: string | null;
    finishedAt?: number | null;
    format: ConditioningFormat;
    gpsProcessingVersion?: string | null;
    id: string;
    notes: string | null;
    ownerId: string;
    performedAt?: number | null;
    performedLocalDate?: string | null;
    performedTimezone?: string | null;
    scheduledLocalDate?: string | null;
    scheduledLocalStartTime?: string | null;
    schedulingTimezone?: string | null;
    sessionRpe: number | null;
    snapshot: WorkoutSnapshot;
    source: SessionSource;
    startedFromPlan: boolean;
    status: SessionStatus;
    syncStatus: SyncStatus;
    targetRpe: number | null;
    templateId: string | null;
    timelineEntryId: number | null;
    title: string;
    updatedAt: number;
  },
) {
  await db.runAsync(
    `INSERT INTO conditioning_sessions (
      id, owner_id, template_id, started_from_plan, timeline_entry_id, title, format,
      activity_type, status, sync_status, snapshot_json, snapshot_version,
      scheduled_local_date, scheduling_timezone, scheduled_local_start_time,
      performed_at, finished_at, performed_local_date, performed_timezone,
      active_seconds, elapsed_seconds, distance_meters, elevation_gain_meters,
      elevation_loss_meters, target_rpe, session_rpe, notes, source,
      gps_processing_version, elevation_processing_version, emphasis_json,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      session.id,
      session.ownerId,
      session.templateId,
      session.startedFromPlan ? 1 : 0,
      session.timelineEntryId,
      session.title,
      session.format,
      session.activityType,
      session.status,
      session.syncStatus,
      JSON.stringify(session.snapshot),
      session.snapshot.version,
      session.scheduledLocalDate ?? null,
      session.schedulingTimezone ?? null,
      session.scheduledLocalStartTime ?? null,
      session.performedAt ?? null,
      session.finishedAt ?? null,
      session.performedLocalDate ?? null,
      session.performedTimezone ?? null,
      session.activeSeconds ?? null,
      session.elapsedSeconds ?? null,
      session.distanceMeters ?? null,
      session.elevationGainMeters ?? null,
      session.elevationLossMeters ?? null,
      session.targetRpe,
      session.sessionRpe,
      session.notes,
      session.source,
      session.gpsProcessingVersion ?? null,
      session.elevationProcessingVersion ?? null,
      session.emphasisJson ?? null,
      session.createdAt,
      session.updatedAt,
    ],
  );
}

async function replaceTemplateStations(
  db: SQLiteDatabase,
  templateId: string,
  circuit: CircuitConfig | null,
) {
  await db.runAsync(
    "DELETE FROM conditioning_template_stations WHERE template_id = ?",
    [templateId],
  );
  if (!circuit) {
    return;
  }

  for (const station of circuit.stations) {
    await db.runAsync(
      `INSERT INTO conditioning_template_stations (
        id, template_id, position, exercise_name, completion_type, target_json,
        recovery_seconds, target_rpe, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        station.id,
        templateId,
        station.position,
        station.exerciseName.trim(),
        station.completionType,
        JSON.stringify(stationTarget(station)),
        station.recoverySeconds,
        station.targetRpe,
        cleanNotes(station.notes),
      ],
    );
  }
}

function stationTarget(station: StationConfig) {
  return {
    distanceMeters: station.distanceMeters,
    instructions: station.instructions,
    loadKg: station.loadKg,
    machineCalories: station.machineCalories,
    targetReps: station.targetReps,
    workSeconds: station.workSeconds,
  };
}

async function insertPoint(
  db: SQLiteDatabase,
  sessionId: string,
  point: LocationPointInput,
) {
  if (
    !Number.isFinite(point.latitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    !Number.isFinite(point.longitude) ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new Error("Location point is invalid");
  }

  await db.runAsync(
    `INSERT INTO conditioning_location_points (
      session_id, sequence, segment_id, recorded_at, latitude, longitude,
      horizontal_accuracy, altitude, altitude_accuracy, acceptance,
      rejection_reason, distance_delta_meters
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      point.sequence,
      point.segmentId,
      point.recordedAt,
      point.latitude,
      point.longitude,
      point.horizontalAccuracy,
      point.altitude,
      point.altitudeAccuracy,
      point.acceptance,
      point.rejectionReason,
      point.distanceDeltaMeters,
    ],
  );
}

async function replaceOccurrences(
  db: SQLiteDatabase,
  sessionId: string,
  occurrences: OccurrenceInput[],
) {
  await db.runAsync(
    "DELETE FROM conditioning_occurrences WHERE session_id = ?",
    [sessionId],
  );
  for (const occurrence of occurrences) {
    throwIfInvalid(validateActual(occurrence.actual));
    await db.runAsync(
      `INSERT INTO conditioning_occurrences (
        id, session_id, position, station_id, round_index, set_index, phase_type,
        target_json, started_at, ended_at, work_seconds, completion_method,
        completion_status, actual_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        occurrence.id,
        sessionId,
        occurrence.position,
        occurrence.stationId,
        occurrence.roundIndex,
        occurrence.setIndex,
        occurrence.phaseType,
        occurrence.target ? JSON.stringify(occurrence.target) : null,
        occurrence.startedAt,
        occurrence.endedAt,
        occurrence.workSeconds,
        occurrence.completionMethod,
        occurrence.completionStatus,
        occurrence.actual ? JSON.stringify(occurrence.actual) : null,
      ],
    );
  }
}

async function replaceSplits(
  db: SQLiteDatabase,
  sessionId: string,
  splits: SplitInput[],
) {
  await db.runAsync("DELETE FROM conditioning_splits WHERE session_id = ?", [
    sessionId,
  ]);
  for (const split of splits) {
    await db.runAsync(
      `INSERT INTO conditioning_splits (
        session_id, unit_system, ordinal, distance_meters, active_seconds, partial, complete
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        split.unitSystem,
        split.ordinal,
        split.distanceMeters,
        split.activeSeconds,
        split.partial ? 1 : 0,
        split.complete ? 1 : 0,
      ],
    );
  }
}

async function replaceSegments(
  db: SQLiteDatabase,
  sessionId: string,
  segments: SegmentInput[],
) {
  await db.runAsync("DELETE FROM conditioning_segments WHERE session_id = ?", [
    sessionId,
  ]);
  for (const segment of segments) {
    await db.runAsync(
      `INSERT INTO conditioning_segments (
        id, session_id, sequence, started_at, ended_at, break_reason
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        segment.id,
        sessionId,
        segment.sequence,
        segment.startedAt,
        segment.endedAt,
        segment.breakReason,
      ],
    );
  }
}

async function deleteSessionChildren(db: SQLiteDatabase, sessionId: string) {
  await db.runAsync(
    "DELETE FROM conditioning_location_points WHERE session_id = ?",
    [sessionId],
  );
  await db.runAsync(
    "DELETE FROM conditioning_occurrences WHERE session_id = ?",
    [sessionId],
  );
  await db.runAsync("DELETE FROM conditioning_splits WHERE session_id = ?", [
    sessionId,
  ]);
  await db.runAsync("DELETE FROM conditioning_segments WHERE session_id = ?", [
    sessionId,
  ]);
  await db.runAsync(
    "DELETE FROM conditioning_runner_state WHERE session_id = ?",
    [sessionId],
  );
  await db.runAsync(
    "DELETE FROM conditioning_upload_jobs WHERE session_id = ?",
    [sessionId],
  );
}

async function ensureUploadJob(
  db: SQLiteDatabase,
  sessionId: string,
  now: number,
) {
  const existing = await db.getFirstAsync<{ session_id: string }>(
    "SELECT session_id FROM conditioning_upload_jobs WHERE session_id = ?",
    [sessionId],
  );
  if (existing) {
    return;
  }

  const points = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM conditioning_location_points WHERE session_id = ?`,
    [sessionId],
  );
  const occurrences = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM conditioning_occurrences WHERE session_id = ?`,
    [sessionId],
  );
  const splits = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM conditioning_splits WHERE session_id = ?`,
    [sessionId],
  );
  await db.runAsync(
    `INSERT INTO conditioning_upload_jobs (
      session_id, status, retry_count, acknowledged_point_sequence,
      acknowledged_occurrence_count, acknowledged_split_count,
      expected_point_count, expected_occurrence_count, expected_split_count,
      last_error, updated_at
    ) VALUES (?, 'pending', 0, 0, 0, 0, ?, ?, ?, NULL, ?)`,
    [
      sessionId,
      Number(points?.count ?? 0),
      Number(occurrences?.count ?? 0),
      Number(splits?.count ?? 0),
      now,
    ],
  );
}

async function updateTimeline(
  db: SQLiteDatabase,
  timelineEntryId: number | null,
  entry: {
    endAt: number | null;
    notes: string | null;
    startAt: number;
    status: "planned" | "completed";
    title: string;
    updatedAt: number;
  },
) {
  if (timelineEntryId === null) {
    return;
  }

  await db.runAsync(
    `UPDATE timeline_entries
     SET title = ?, start_at = ?, end_at = ?, status = ?, notes = ?, updated_at = ?
     WHERE id = ? AND kind = 'conditioning'`,
    [
      entry.title,
      entry.startAt,
      entry.endAt,
      entry.status,
      entry.notes,
      entry.updatedAt,
      timelineEntryId,
    ],
  );
}

type TemplateRow = {
  archived_at: number | null;
  config_json: string;
  config_version: number;
  created_at: number;
  format: TemplateConfig["format"];
  id: string;
  last_used_at: number | null;
  owner_id: string;
  title: string;
  updated_at: number;
};

type StationRow = {
  completion_type: StationConfig["completionType"];
  exercise_name: string;
  id: string;
  notes: string | null;
  position: number;
  recovery_seconds: number;
  target_json: string;
  target_rpe: number | null;
};

async function getTemplateRow(
  db: SQLiteDatabase,
  ownerId: string,
  templateId: string,
) {
  return db.getFirstAsync<TemplateRow>(
    `SELECT id, owner_id, title, format, config_json, config_version, archived_at,
            created_at, updated_at, last_used_at
     FROM conditioning_templates
     WHERE id = ? AND owner_id = ?`,
    [templateId, ownerId],
  );
}

async function mapTemplate(db: SQLiteDatabase, row: TemplateRow) {
  const config = JSON.parse(row.config_json) as TemplateConfig;
  if (config.format === "circuit" && config.circuit) {
    const stations = await db.getAllAsync<StationRow>(
      `SELECT id, position, exercise_name, completion_type, target_json,
              recovery_seconds, target_rpe, notes
       FROM conditioning_template_stations
       WHERE template_id = ?
       ORDER BY position`,
      [row.id],
    );
    config.circuit = {
      ...config.circuit,
      stations: stations.map(mapStation),
    };
  }

  const record: ConditioningTemplateRecord = {
    archivedAt: row.archived_at,
    config,
    configVersion: row.config_version,
    createdAt: row.created_at,
    format: row.format,
    id: row.id,
    lastUsedAt: row.last_used_at,
    ownerId: row.owner_id,
    title: row.title,
    updatedAt: row.updated_at,
  };
  return record;
}

function mapStation(row: StationRow): StationConfig {
  const target = JSON.parse(row.target_json) as ReturnType<typeof stationTarget>;
  return {
    completionType: row.completion_type,
    distanceMeters: target.distanceMeters,
    exerciseName: row.exercise_name,
    id: row.id,
    instructions: target.instructions,
    loadKg: target.loadKg,
    machineCalories: target.machineCalories,
    notes: row.notes,
    position: row.position,
    recoverySeconds: row.recovery_seconds,
    targetReps: target.targetReps,
    targetRpe: row.target_rpe,
    workSeconds: target.workSeconds,
  };
}

type SessionRow = {
  active_seconds: number | null;
  activity_type: FreeActivity | null;
  created_at: number;
  distance_meters: number | null;
  elapsed_seconds: number | null;
  elevation_gain_meters: number | null;
  elevation_loss_meters: number | null;
  elevation_processing_version: string | null;
  emphasis_json: string | null;
  finished_at: number | null;
  format: ConditioningFormat;
  gps_processing_version: string | null;
  id: string;
  notes: string | null;
  owner_id: string;
  performed_at: number | null;
  performed_local_date: string | null;
  performed_timezone: string | null;
  scheduled_local_date: string | null;
  scheduled_local_start_time: string | null;
  scheduling_timezone: string | null;
  session_rpe: number | null;
  snapshot_json: string;
  snapshot_version: number;
  source: SessionSource;
  started_from_plan: number;
  status: SessionStatus;
  sync_status: SyncStatus;
  target_rpe: number | null;
  template_id: string | null;
  timeline_entry_id: number | null;
  title: string;
  updated_at: number;
};

function mapSession(row: SessionRow): ConditioningSessionRecord {
  return {
    activeSeconds: row.active_seconds,
    activityType: row.activity_type,
    createdAt: row.created_at,
    distanceMeters: row.distance_meters,
    elapsedSeconds: row.elapsed_seconds,
    elevationGainMeters: row.elevation_gain_meters,
    elevationLossMeters: row.elevation_loss_meters,
    elevationProcessingVersion: row.elevation_processing_version,
    emphasisJson: row.emphasis_json,
    finishedAt: row.finished_at,
    format: row.format,
    gpsProcessingVersion: row.gps_processing_version,
    id: row.id,
    notes: row.notes,
    ownerId: row.owner_id,
    performedAt: row.performed_at,
    performedLocalDate: row.performed_local_date,
    performedTimezone: row.performed_timezone,
    scheduledLocalDate: row.scheduled_local_date,
    scheduledLocalStartTime: row.scheduled_local_start_time,
    schedulingTimezone: row.scheduling_timezone,
    sessionRpe: row.session_rpe,
    snapshot: JSON.parse(row.snapshot_json) as WorkoutSnapshot,
    snapshotVersion: row.snapshot_version,
    source: row.source,
    startedFromPlan: row.started_from_plan === 1,
    status: row.status,
    syncStatus: row.sync_status,
    targetRpe: row.target_rpe,
    templateId: row.template_id,
    timelineEntryId: row.timeline_entry_id,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

type OccurrenceRow = {
  actual_json: string | null;
  completion_method: string | null;
  completion_status: OccurrenceInput["completionStatus"];
  ended_at: number | null;
  id: string;
  phase_type: OccurrenceInput["phaseType"];
  position: number;
  round_index: number | null;
  set_index: number | null;
  started_at: number | null;
  station_id: string | null;
  target_json: string | null;
  work_seconds: number | null;
};

function mapOccurrence(row: OccurrenceRow): OccurrenceInput {
  return {
    actual: row.actual_json
      ? (JSON.parse(row.actual_json) as OccurrenceInput["actual"])
      : null,
    completionMethod: row.completion_method,
    completionStatus: row.completion_status,
    endedAt: row.ended_at,
    id: row.id,
    phaseType: row.phase_type,
    position: row.position,
    roundIndex: row.round_index,
    setIndex: row.set_index,
    startedAt: row.started_at,
    stationId: row.station_id,
    target: row.target_json
      ? (JSON.parse(row.target_json) as OccurrenceInput["target"])
      : null,
    workSeconds: row.work_seconds,
  };
}
