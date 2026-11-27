import type { SQLiteDatabase } from "expo-sqlite";

import { conditioningMigrationSql } from "./conditioningMigration";
import { recoveryMigrationSql } from "./recoveryMigration";
import {
  nutritionV5RebuildSql,
  nutritionV5SequenceSql,
  nutritionV5TablesSql,
  nutritionV6FavouriteSnapshotSql,
} from "./nutritionMigration";
import { skillMigrationSql } from "./skillMigration";
import { applySkillRepsMigration } from "./skillRepsMigration";
import { strengthMigrationSql, strengthStimulusColumns } from "./strengthMigration";
import { ensureStrengthCatalog } from "./strengthRepository";
import { trainingIndexMigrationSql } from "./trainingIndexMigration";

const DATABASE_VERSION = 13;

const strengthSessionColumns = [
  ["strength_sessions", "scheduled_local_date", "TEXT"],
  ["strength_template_exercises", "target_json", "TEXT"],
  ["strength_session_exercises", "target_json", "TEXT"],
  ["strength_template_sets", "rir", "INTEGER CHECK (rir BETWEEN 0 AND 10)"],
  ["strength_session_sets", "rir", "INTEGER CHECK (rir BETWEEN 0 AND 10)"],
] as const;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionResult = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );

  const currentVersion = versionResult?.user_version ?? 0;
  const workspaceReady = await tableExists(db, "nutrition_workspace");
  const strengthReady = await tableExists(db, "strength_sessions");
  const skillReady = await tableExists(db, "skill_sessions");
  const recoveryReady = await tableExists(db, "daily_questionnaires");
  const skillRepsReady = skillReady && await columnExists(db, "skill_template_activities", "sets") && await columnExists(db, "skill_session_activities", "sets");
  const strengthModesReady = strengthReady && (await Promise.all(
    strengthSessionColumns.map(([table, column]) => columnExists(db, table, column)),
  )).every(Boolean);
  const trainingIndicesReady = strengthReady && (await Promise.all([
    ...strengthStimulusColumns.map(([table, column]) => columnExists(db, table, column)),
    ...["training_day_confirmations", "training_session_loads", "recovery_sleep_targets", "training_output_tests"].map(table => tableExists(db, table)),
  ])).every(Boolean);

  if (
    currentVersion >= DATABASE_VERSION &&
    workspaceReady &&
    strengthReady &&
    skillReady &&
    recoveryReady &&
    strengthModesReady &&
    skillRepsReady &&
    trainingIndicesReady
  ) {
    await ensureStrengthCatalog(db);
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

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
        FOREIGN KEY (timeline_entry_id)
          REFERENCES timeline_entries (id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_timeline_entry_id INTEGER NOT NULL,
        fdc_id INTEGER NOT NULL CHECK (fdc_id > 0),
        food_description TEXT NOT NULL
          CHECK (length(trim(food_description)) > 0),
        brand_name TEXT,
        quantity REAL NOT NULL CHECK (quantity > 0),
        serving_amount REAL NOT NULL CHECK (serving_amount > 0),
        serving_unit TEXT NOT NULL
          CHECK (serving_unit IN ('g', 'ml')),
        serving_description TEXT NOT NULL
          CHECK (length(trim(serving_description)) > 0),
        energy_kcal_per_serving REAL
          CHECK (
            energy_kcal_per_serving IS NULL
            OR energy_kcal_per_serving >= 0
          ),
        protein_g_per_serving REAL
          CHECK (
            protein_g_per_serving IS NULL
            OR protein_g_per_serving >= 0
          ),
        carbohydrates_g_per_serving REAL
          CHECK (
            carbohydrates_g_per_serving IS NULL
            OR carbohydrates_g_per_serving >= 0
          ),
        fat_g_per_serving REAL
          CHECK (
            fat_g_per_serving IS NULL
            OR fat_g_per_serving >= 0
          ),
        FOREIGN KEY (meal_timeline_entry_id)
          REFERENCES meal_logs (timeline_entry_id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS meal_items_meal_timeline_entry_id
      ON meal_items (meal_timeline_entry_id);
    `);
  }

  if (currentVersion < 5 || !workspaceReady) {
    await applyNutritionV5(db);
  }

  if (
    (currentVersion < 6 || !workspaceReady) &&
    !(await columnExists(db, "food_favourites", "snapshot_json"))
  ) {
    await db.execAsync(nutritionV6FavouriteSnapshotSql);
  }

  if (currentVersion < 7) {
    await db.execAsync(conditioningMigrationSql);
  }

  if (currentVersion < 8 || !strengthReady) {
    await db.execAsync(strengthMigrationSql);
    await ensureStrengthCatalog(db);
  }

  if (currentVersion < 9 || !skillReady) {
    await db.execAsync(skillMigrationSql);
  }

  if (currentVersion < 10 || !recoveryReady) {
    await db.execAsync(recoveryMigrationSql);
  }

  if (currentVersion < 11 || !skillRepsReady) {
    await applySkillRepsMigration(db);
  }

  if (currentVersion < 12 || !strengthModesReady) {
    await db.withTransactionAsync(async () => {
      for (const [table, column, definition] of strengthSessionColumns) {
        if (!(await columnExists(db, table, column))) {
          await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
      }
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS strength_sessions_calendar_date
          ON strength_sessions (COALESCE(scheduled_local_date, local_end_date));
      `);
    });
  }

  if (currentVersion < 13 || !trainingIndicesReady) {
    await db.withTransactionAsync(async () => {
      for (const [table, column, definition] of strengthStimulusColumns) {
        if (!(await columnExists(db, table, column))) {
          await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
      }
      await db.execAsync(trainingIndexMigrationSql);
    });
  }

  if (currentVersion < DATABASE_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  }
}

async function applyNutritionV5(db: SQLiteDatabase) {
  if (!(await columnExists(db, "meal_items", "source"))) {
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.execAsync(nutritionV5RebuildSql);
    try {
      await db.execAsync(nutritionV5SequenceSql);
    } catch {
      // sqlite_sequence is only bookkeeping for the next autoincrement id.
    }
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }

  if (!(await columnExists(db, "meal_logs", "operation_id"))) {
    await db.execAsync("ALTER TABLE meal_logs ADD COLUMN operation_id TEXT;");
  }

  if (!(await columnExists(db, "meal_logs", "saved_meal_id"))) {
    await db.execAsync(
      "ALTER TABLE meal_logs ADD COLUMN saved_meal_id TEXT;",
    );
  }

  await db.execAsync(nutritionV5TablesSql);
}

async function tableExists(db: SQLiteDatabase, name: string) {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name],
  );
  return row != null;
}

async function columnExists(
  db: SQLiteDatabase,
  table: "food_favourites" | "meal_items" | "meal_logs" | "skill_template_activities" | "skill_session_activities" | (typeof strengthSessionColumns)[number][0] | (typeof strengthStimulusColumns)[number][0],
  column: string,
) {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return rows.some((row) => row.name === column);
}
