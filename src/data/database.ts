import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 1;

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

  if (currentVersion === 0) {
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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
