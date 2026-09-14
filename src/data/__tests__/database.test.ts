import type { SQLiteDatabase } from "expo-sqlite";

import { migrateDatabase } from "../database";

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function createMigrationHarness(userVersion: number) {
  const rootSql: string[] = [];
  const transactionSql: string[] = [];
  const db = {
    execAsync: jest.fn(async (sql: string) => {
      rootSql.push(normalizeSql(sql));
    }),
    getFirstAsync: jest.fn(async () => ({ user_version: userVersion })),
    withTransactionAsync: jest.fn(
      async (callback: () => Promise<void>) => callback(),
    ),
    withExclusiveTransactionAsync: jest.fn(
      async (callback: (transaction: SQLiteDatabase) => Promise<void>) => {
        const transaction = {
          execAsync: jest.fn(async (sql: string) => {
            transactionSql.push(normalizeSql(sql));
          }),
        } as unknown as SQLiteDatabase;
        await callback(transaction);
      },
    ),
  } as unknown as SQLiteDatabase;

  return { db, rootSql, transactionSql };
}

describe("database migrations", () => {
  test("builds a fresh schema through version 10", async () => {
    const harness = createMigrationHarness(0);
    await migrateDatabase(harness.db);

    const allSql = [...harness.rootSql, ...harness.transactionSql].join(" ");
    expect(allSql).toContain("CREATE TABLE IF NOT EXISTS conditioning_logs");
    expect(allSql).toContain(
      "CREATE TABLE IF NOT EXISTS conditioning_session_templates",
    );
    expect(allSql).toContain("CREATE TABLE IF NOT EXISTS athlete_preferences");
    expect(allSql).toContain(
      "ADD COLUMN distance_work_duration_seconds INTEGER DEFAULT NULL",
    );
    expect(allSql).toContain(
      "ADD COLUMN distance_duration_omitted INTEGER DEFAULT NULL",
    );
    expect(allSql).toContain("CREATE TABLE strength_session_templates");
    expect(allSql).toContain("CREATE TABLE strength_template_exercises");
    expect(allSql).toContain("CREATE TABLE strength_logs");
    expect(allSql).toContain("CREATE TABLE strength_log_exercises");
    expect(allSql).toContain("CREATE TABLE strength_adaptation_scores");
    expect(allSql).toContain("CREATE TABLE strength_exercise_adaptation_scores");
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("upgrades version 5 additively through preferences and interval timing", async () => {
    const harness = createMigrationHarness(5);
    await migrateDatabase(harness.db);

    const rootMigrationSql = harness.rootSql.slice(1).join(" ");
    const versionSevenSql = harness.transactionSql.join(" ");
    expect(rootMigrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS athlete_preferences",
    );
    expect(rootMigrationSql).toContain(
      "VALUES (1, 'metric')",
    );
    expect(versionSevenSql).toContain(
      "ALTER TABLE conditioning_session_templates ADD COLUMN distance_work_duration_seconds",
    );
    expect(versionSevenSql).toContain(
      "ALTER TABLE conditioning_logs ADD COLUMN distance_work_duration_seconds",
    );
    expect(versionSevenSql).not.toMatch(/DROP TABLE/i);
    expect(versionSevenSql).toContain(
      "ADD COLUMN distance_duration_omitted INTEGER DEFAULT NULL",
    );
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("upgrades version 6 without recreating the preference or conditioning tables", async () => {
    const harness = createMigrationHarness(6);
    await migrateDatabase(harness.db);

    const migrationSql = [
      ...harness.rootSql.slice(1),
      ...harness.transactionSql,
    ].join(" ");
    expect(migrationSql).not.toContain("athlete_preferences");
    expect(migrationSql).not.toMatch(/DROP TABLE/i);
    expect(migrationSql.match(/ADD COLUMN distance_work_duration_seconds/g)).toHaveLength(
      2,
    );
    expect(migrationSql.match(/ADD COLUMN distance_duration_omitted/g)).toHaveLength(
      2,
    );
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("upgrades version 7 with the distance-duration omission marker", async () => {
    const harness = createMigrationHarness(7);
    await migrateDatabase(harness.db);

    expect(harness.transactionSql.join(" ")).toContain(
      "ADD COLUMN distance_duration_omitted INTEGER DEFAULT NULL",
    );
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("upgrades version 8 with hill sprint elevation", async () => {
    const harness = createMigrationHarness(8);
    await migrateDatabase(harness.db);

    expect(harness.transactionSql.join(" ")).toContain(
      "ADD COLUMN interval_elevation_gain_meters REAL DEFAULT NULL",
    );
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("upgrades version 9 transactionally with required foreign-key behavior", async () => {
    const harness = createMigrationHarness(9);
    await migrateDatabase(harness.db);

    expect(harness.rootSql).toHaveLength(2);
    expect(harness.rootSql[0]).toContain("PRAGMA journal_mode = WAL");
    expect(harness.transactionSql).toHaveLength(1);
    const sql = harness.transactionSql[0];
    expect(sql).toContain("REFERENCES strength_session_templates(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES timeline_entries(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES strength_session_templates(id) ON DELETE SET NULL");
    expect(sql).toContain("FOREIGN KEY (timeline_entry_id, position) REFERENCES strength_log_exercises(timeline_entry_id, position) ON DELETE CASCADE");
    expect(sql).not.toMatch(/DROP TABLE|ALTER TABLE/i);
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 10");
  });

  test("leaves version 10 unchanged after enabling connection pragmas", async () => {
    const harness = createMigrationHarness(10);
    await migrateDatabase(harness.db);
    expect(harness.rootSql).toHaveLength(1);
    expect(harness.transactionSql).toEqual([]);
  });
});
