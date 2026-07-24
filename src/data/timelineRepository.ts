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

export async function getTimelineEntriesForDay(
  db: SQLiteDatabase,
  dayStart: number,
  dayEnd: number,
) {
  const rows = await db.getAllAsync<TimelineEntryRow>(
    `SELECT *
     FROM timeline_entries
     WHERE start_at < $dayEnd
       AND (
         (end_at IS NULL AND start_at >= $dayStart)
         OR end_at > $dayStart
       )
     ORDER BY start_at ASC`,
    {
      $dayStart: dayStart,
      $dayEnd: dayEnd,
    },
  );

  return rows.map(convertTimelineEntryRow);
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
  };
}
