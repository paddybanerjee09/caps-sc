import type { SQLiteDatabase } from "expo-sqlite";

// Keep the test-only Node API out of the application's React Native type globals.
type SQLInputValue = string | number | bigint | null | Uint8Array;
type Bindings = (SQLInputValue | Record<string, SQLInputValue>)[];
type TestConnection = {
  exec: (sql: string) => void;
  close: () => void;
  prepare: (sql: string) => {
    run: (...params: Bindings) => { changes: number | bigint; lastInsertRowid: number | bigint };
    get: (...params: Bindings) => Record<string, unknown> | undefined;
    all: (...params: Bindings) => Record<string, unknown>[];
  };
};
const { DatabaseSync } = jest.requireActual<{ DatabaseSync: new (path: string) => TestConnection }>("node:sqlite");

// Execute the production SQL against SQLite, without a device or extra package.
// Node 22.13+ supplies node:sqlite (also Expo SDK 57's minimum Node version).
export function createSqliteHarness() {
  const connection = new DatabaseSync(":memory:");
  const writes: string[] = [];
  let failPattern: RegExp | null = null;
  const transaction = {
    execAsync: async (sql: string) => { connection.exec(sql); },
    runAsync: async (sql: string, params: SQLInputValue[] = []) => {
      writes.push(sql);
      if (failPattern?.test(sql)) throw new Error("Injected storage failure");
      const result = connection.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async (sql: string, params: SQLInputValue[] = []) => connection.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params?: SQLInputValue[] | Record<string, SQLInputValue>) => {
      const statement = connection.prepare(sql);
      return Array.isArray(params) ? statement.all(...params) : params ? statement.all(params) : statement.all();
    },
  };
  const db = {
    ...transaction,
    runAsync: async () => { throw new Error("Write escaped exclusive transaction"); },
    withTransactionAsync: async (callback: () => Promise<void>) => {
      connection.exec("BEGIN");
      try { await callback(); connection.exec("COMMIT"); }
      catch (error) { connection.exec("ROLLBACK"); throw error; }
    },
    withExclusiveTransactionAsync: async (callback: (tx: SQLiteDatabase) => Promise<void>) => {
      connection.exec("BEGIN EXCLUSIVE");
      try { await callback(transaction as unknown as SQLiteDatabase); connection.exec("COMMIT"); }
      catch (error) { connection.exec("ROLLBACK"); throw error; }
    },
  } as unknown as SQLiteDatabase;
  return { db, connection, writes, failOn: (pattern: RegExp | null) => { failPattern = pattern; }, close: () => connection.close() };
}
