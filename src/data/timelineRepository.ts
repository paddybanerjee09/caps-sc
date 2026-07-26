import type { SQLiteDatabase } from "expo-sqlite";

export type TimelineKind =
  | "skill"
  | "strength"
  | "conditioning"
  | "meal"
  | "weight"
  | "sleep";

export type TimelineStatus = "planned" | "completed";

export type NewTimelineEntry = {
  kind: TimelineKind;
  title: string;
  startAt: number;
  endAt?: number | null;
  status?: TimelineStatus;
  notes?: string | null;
};

export type TimelineEntry = {
  id: number;
  kind: TimelineKind;
  title: string;
  startAt: number;
  endAt: number | null;
  status: TimelineStatus;
  notes: string | null;
  createdAt: number;
  updatedAt: number;

  weightKg: number | null;
};

type TimelineEntryRow = {
  id: number;
  kind: TimelineKind;
  title: string;
  start_at: number;
  end_at: number | null;
  status: TimelineStatus;
  notes: string | null;
  created_at: number;
  updated_at: number;

  weight_kg: number | null;
};

type LatestWeightRow = {
  weight_kg: number;
};

export async function addTimelineEntry(
  db: SQLiteDatabase,
  entry: NewTimelineEntry,
) {
  const now = Date.now();

  const result = await db.runAsync(
    `INSERT INTO timeline_entries (
      kind,
      title,
      start_at,
      end_at,
      status,
      notes,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.kind,
      entry.title,
      entry.startAt,
      entry.endAt ?? null,
      entry.status ?? "planned",
      entry.notes ?? null,
      now,
      now,
    ],
  );
  return result.lastInsertRowId;
}

export async function addWeightLog(
  db: SQLiteDatabase,
  weightKg: number,
  loggedAt = Date.now(),
) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Weight must be greater than zero");
  }

  await db.withTransactionAsync(async () => {
    const timelineEntryId = await addTimelineEntry(db, {
      kind: "weight",
      title: "Weight",
      startAt: loggedAt,
      status: "completed",
    });

    await db.runAsync(
      `INSERT INTO weight_logs (
          timeline_entry_id,
          weight_kg
        ) VALUES (?, ?)`,
      [timelineEntryId, weightKg],
    );
  });
}

export async function updateWeightLog(
  db: SQLiteDatabase,
  timelineEntryId: number,
  weightKg: number,
  loggedAt: number,
) {
  validateWeightLogValues(timelineEntryId, weightKg, loggedAt);

  await db.withTransactionAsync(async () => {
    const existingLog = await db.getFirstAsync<{ id: number }>(
      `SELECT timeline_entries.id
       FROM timeline_entries
       INNER JOIN weight_logs
         ON weight_logs.timeline_entry_id = timeline_entries.id
       WHERE timeline_entries.id = ?
         AND timeline_entries.kind = 'weight'`,
      [timelineEntryId],
    );

    if (!existingLog) {
      throw new Error("Weight log not found");
    }

    await db.runAsync(
      `UPDATE timeline_entries
       SET start_at = ?, updated_at = ?
       WHERE id = ?`,
      [loggedAt, Date.now(), timelineEntryId],
    );

    await db.runAsync(
      `UPDATE weight_logs
       SET weight_kg = ?
       WHERE timeline_entry_id = ?`,
      [weightKg, timelineEntryId],
    );
  });
}

export async function deleteWeightLog(
  db: SQLiteDatabase,
  timelineEntryId: number,
) {
  if (!Number.isInteger(timelineEntryId) || timelineEntryId <= 0) {
    throw new Error("Invalid weight log");
  }

  const result = await db.runAsync(
    `DELETE FROM timeline_entries
     WHERE id = ?
       AND kind = 'weight'
       AND EXISTS (
         SELECT 1
         FROM weight_logs
         WHERE weight_logs.timeline_entry_id = timeline_entries.id
       )`,
    [timelineEntryId],
  );

  if (result.changes !== 1) {
    throw new Error("Weight log not found");
  }
}

export async function getTimelineEntriesForDay(
  db: SQLiteDatabase,
  dayStart: number,
  dayEnd: number,
) {
  const rows = await db.getAllAsync<TimelineEntryRow>(
    `SELECT
           timeline_entries.*,
           weight_logs.weight_kg
         FROM timeline_entries
         LEFT JOIN weight_logs
           ON weight_logs.timeline_entry_id = timeline_entries.id
         WHERE timeline_entries.start_at < $dayEnd
           AND (
             (
               timeline_entries.end_at IS NULL
               AND timeline_entries.start_at >= $dayStart
             )
             OR timeline_entries.end_at > $dayStart
           )
         ORDER BY timeline_entries.start_at ASC`,
    {
      $dayStart: dayStart,
      $dayEnd: dayEnd,
    },
  );

  return rows.map(convertTimelineEntryRow);
}

export async function getLatestWeightKg(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<LatestWeightRow>(
    `SELECT weight_logs.weight_kg
     FROM weight_logs
     INNER JOIN timeline_entries
       ON timeline_entries.id = weight_logs.timeline_entry_id
     ORDER BY timeline_entries.start_at DESC, timeline_entries.id DESC
     LIMIT 1`,
  );

  return row?.weight_kg ?? null;
}

function convertTimelineEntryRow(row: TimelineEntryRow): TimelineEntry {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    weightKg: row.weight_kg,
  };
}

function validateWeightLogValues(
  timelineEntryId: number,
  weightKg: number,
  loggedAt: number,
) {
  if (!Number.isInteger(timelineEntryId) || timelineEntryId <= 0) {
    throw new Error("Invalid weight log");
  }

  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("Weight must be greater than zero");
  }

  if (!Number.isFinite(loggedAt)) {
    throw new Error("Invalid log time");
  }

  if (loggedAt > Date.now()) {
    throw new Error("Log time cannot be in the future");
  }
}
