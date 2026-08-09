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

describe("conditioning database migrations", () => {
  test("builds a fresh schema through version 7", async () => {
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
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 7");
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
    expect(versionSevenSql).not.toMatch(/DROP TABLE|CREATE TABLE/i);
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 7");
  });

  test("upgrades version 6 without recreating the preference or conditioning tables", async () => {
    const harness = createMigrationHarness(6);
    await migrateDatabase(harness.db);

    const migrationSql = [
      ...harness.rootSql.slice(1),
      ...harness.transactionSql,
    ].join(" ");
    expect(migrationSql).not.toContain("athlete_preferences");
    expect(migrationSql).not.toMatch(/DROP TABLE|CREATE TABLE/i);
    expect(migrationSql.match(/ADD COLUMN distance_work_duration_seconds/g)).toHaveLength(
      2,
    );
    expect(harness.rootSql.at(-1)).toBe("PRAGMA user_version = 7");
  });

  test("leaves a version 7 schema unchanged after enabling connection pragmas", async () => {
    const harness = createMigrationHarness(7);
    await migrateDatabase(harness.db);

    expect(harness.rootSql).toHaveLength(1);
    expect(harness.rootSql[0]).toContain("PRAGMA journal_mode = WAL");
    expect(harness.transactionSql).toEqual([]);
  });
});
