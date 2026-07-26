import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 3;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );

  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS timeline_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        start_at INTEGER NOT NULL,
        end_at INTEGER,
        status TEXT NOT NULL DEFAULT 'planned',
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS timeline_entries_start_at
      ON timeline_entries (start_at);
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weight_logs (
        timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
        weight_kg REAL NOT NULL CHECK (weight_kg > 0),
        FOREIGN KEY (timeline_entry_id)
          REFERENCES timeline_entries (id)
          ON DELETE CASCADE
      );
    `);
  }

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sleep_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
        end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1439),
        effective_from_wake_date TEXT NOT NULL,
        effective_until_wake_date TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (start_minute != end_minute),
        CHECK (
          effective_until_wake_date IS NULL
          OR effective_until_wake_date > effective_from_wake_date
        )
      );

      CREATE INDEX IF NOT EXISTS sleep_schedules_wake_dates
      ON sleep_schedules (
        effective_from_wake_date,
        effective_until_wake_date
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
