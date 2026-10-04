import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { nutritionV5MigrationSql } from "../src/data/nutritionMigration.ts";
import { createMealLog } from "../src/data/nutritionRepository.ts";
import {
  calculateNutrientTotals,
  calorieCrossCheck,
  convertAmount,
  favouriteConfigKey,
  normalizeBarcode,
  sumExtraTotals,
} from "../src/nutrition/calculations.ts";
import { restoreWorkspace } from "../src/nutrition/drafts.ts";
import {
  FATSECRET_DETAILS_METHOD,
  normalizeFatSecretFood,
} from "../src/services/fatsecretNormalize.ts";
import { normalizeOpenFoodFactsProduct } from "../src/services/openFoodFactsNormalize.ts";

const v4Schema = `
CREATE TABLE timeline_entries (
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
CREATE TABLE weight_logs (
  timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
  weight_kg REAL NOT NULL CHECK (weight_kg > 0),
  FOREIGN KEY (timeline_entry_id) REFERENCES timeline_entries (id) ON DELETE CASCADE
);
CREATE TABLE sleep_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_minute INTEGER NOT NULL,
  end_minute INTEGER NOT NULL,
  effective_from_wake_date TEXT NOT NULL,
  effective_until_wake_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE meal_logs (
  timeline_entry_id INTEGER PRIMARY KEY NOT NULL,
  FOREIGN KEY (timeline_entry_id) REFERENCES timeline_entries (id) ON DELETE CASCADE
);
CREATE TABLE meal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_timeline_entry_id INTEGER NOT NULL,
  fdc_id INTEGER NOT NULL CHECK (fdc_id > 0),
  food_description TEXT NOT NULL,
  brand_name TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  serving_amount REAL NOT NULL CHECK (serving_amount > 0),
  serving_unit TEXT NOT NULL CHECK (serving_unit IN ('g', 'ml')),
  serving_description TEXT NOT NULL,
  energy_kcal_per_serving REAL,
  protein_g_per_serving REAL,
  carbohydrates_g_per_serving REAL,
  fat_g_per_serving REAL,
  FOREIGN KEY (meal_timeline_entry_id) REFERENCES meal_logs (timeline_entry_id) ON DELETE CASCADE
);
`;

const db = new DatabaseSync(":memory:");
db.exec(v4Schema);
db.prepare(
  `INSERT INTO timeline_entries (
    id, kind, title, start_at, end_at, status, notes, created_at, updated_at
  ) VALUES (7, 'meal', 'Breakfast', 1000, NULL, 'completed', NULL, 1, 1)`,
).run();
db.prepare(`INSERT INTO meal_logs (timeline_entry_id) VALUES (7)`).run();
db.prepare(
  `INSERT INTO meal_items (
    id, meal_timeline_entry_id, fdc_id, food_description, brand_name, quantity,
    serving_amount, serving_unit, serving_description, energy_kcal_per_serving,
    protein_g_per_serving, carbohydrates_g_per_serving, fat_g_per_serving
  ) VALUES (4, 7, 123, 'Oats', 'Quaker', 2, 40, 'g', '40 g', 150, 5, 27, 3)`,
).run();
db.prepare(
  `INSERT INTO timeline_entries (
    id, kind, title, start_at, end_at, status, notes, created_at, updated_at
  ) VALUES (8, 'weight', 'Weight', 1100, NULL, 'completed', NULL, 1, 1)`,
).run();
db.prepare(`INSERT INTO weight_logs (timeline_entry_id, weight_kg) VALUES (8, 70)`).run();
db.prepare(
  `INSERT INTO sleep_schedules (
    start_minute, end_minute, effective_from_wake_date, effective_until_wake_date,
    created_at, updated_at
  ) VALUES (1380, 420, '2026-01-01', NULL, 1, 1)`,
).run();

db.exec("PRAGMA foreign_keys = OFF");
db.exec(nutritionV5MigrationSql);
db.exec("PRAGMA foreign_keys = ON");

const item = db.prepare(`SELECT * FROM meal_items WHERE id = 4`).get();
assert.equal(item.source, "usda");
assert.equal(item.external_id, "123");
assert.equal(item.food_description, "Oats");
assert.equal(item.energy_kcal_per_serving, 150);
assert.equal(item.storage_policy, "snapshot");
assert.equal(item.meal_timeline_entry_id, 7);
assert.equal(db.prepare(`SELECT weight_kg FROM weight_logs`).get().weight_kg, 70);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM sleep_schedules`).get().count, 1);
assert.equal(
  db.prepare(`SELECT title FROM timeline_entries WHERE id = 7`).get().title,
  "Breakfast",
);

const adapter = {
  async execAsync(sql) {
    db.exec(sql);
  },
  async getFirstAsync(sql, params = []) {
    return db.prepare(sql).get(...params) ?? null;
  },
  async getAllAsync(sql, params = []) {
    return db.prepare(sql).all(...params);
  },
  async runAsync(sql, params = []) {
    const result = db.prepare(sql).run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  },
  async withTransactionAsync(task) {
    db.exec("BEGIN");
    try {
      await task();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },
};

const meal = {
  items: [
    {
      brandName: null,
      description: "Rice",
      extrasPerServing: [{ amount: 1, id: "sodium", unit: "mg" }],
      food: { externalId: "rice", source: "custom" },
      nutrientsPerServing: {
        carbohydratesG: 28,
        energyKcal: 130,
        fatG: 0,
        proteinG: 3,
      },
      quantity: 1,
      servingAmount: 100,
      servingDescription: "100 g",
      servingId: "base",
      servingUnit: "g",
      storagePolicy: "snapshot",
    },
  ],
  loggedAt: Date.now() - 1000,
  operationId: "op-meal-1",
  savedMealId: null,
  title: "Lunch",
};

const firstId = await createMealLog(adapter, meal);
const secondId = await createMealLog(adapter, meal);
assert.equal(firstId, secondId);
assert.equal(
  db.prepare(`SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'meal'`).get().count,
  2,
);

const totals = calculateNutrientTotals([
  {
    nutrientsPerServing: {
      carbohydratesG: 10,
      energyKcal: null,
      fatG: 0,
      proteinG: 2,
    },
    quantity: 2,
  },
  {
    nutrientsPerServing: {
      carbohydratesG: null,
      energyKcal: 50,
      fatG: 1,
      proteinG: 1,
    },
    quantity: 1,
  },
]);
assert.equal(totals.energyKcal, 50);
assert.equal(totals.incomplete.energyKcal, true);
assert.equal(totals.proteinG, 5);
assert.equal(totals.fatG, 1);
assert.equal(totals.carbohydratesG, 20);
assert.equal(totals.incomplete.carbohydratesG, true);

const empty = calculateNutrientTotals([]);
assert.equal(empty.energyKcal, 0);
assert.equal(empty.incomplete.energyKcal, false);

const extras = sumExtraTotals([
  { extrasPerServing: [{ amount: 10, id: "sodium", unit: "mg" }], quantity: 2 },
  { extrasPerServing: [], quantity: 1 },
]);
const sodium = extras.find((total) => total.id === "sodium");
assert.equal(sodium.amount, 20);
assert.equal(sodium.partial, true);
assert.equal(extras.find((total) => total.id === "iron").amount, null);

assert.equal(convertAmount(0.5, "g", "mg"), 500);
assert.equal(convertAmount(1, "g", "ml"), null);
assert.equal(convertAmount(10, "%", "mg"), null);
assert.equal(calorieCrossCheck(100, 10, 10, 2), null);
assert.ok(calorieCrossCheck(100, 0, 0, 0));
assert.equal(normalizeBarcode("0123456789012"), "0123456789012");
assert.equal(normalizeBarcode("123"), null);
assert.equal(
  favouriteConfigKey({ externalId: "1", source: "fatsecret" }, "9", 1),
  favouriteConfigKey({ externalId: "1", source: "fatsecret" }, "9", 1.0),
);

const food = normalizeFatSecretFood({
  food: {
    food_id: "42",
    food_name: "Milk",
    servings: {
      serving: {
        calories: "150",
        carbohydrate: "12",
        fat: "8",
        protein: "8",
        serving_description: "1 cup",
        serving_id: "7",
        vitamin_a: "80",
      },
    },
  },
});
assert.equal(FATSECRET_DETAILS_METHOD, "food.get.v5");
assert.equal(food.storagePolicy, "reference");
assert.equal(food.servings[0].extras.find((extra) => extra.id === "vitaminA").unit, "µg");
assert.equal(food.servings[0].extras.find((extra) => extra.id === "vitaminA").amount, 80);

const product = normalizeOpenFoodFactsProduct(
  {
    product: {
      brands: "Example",
      code: "0123456789012",
      nutriments: {
        "energy-kcal_100g": 200,
        fat_100g: 1,
        proteins_100g: 5,
        sodium_100g: 0.4,
      },
      product_name: "Beans",
    },
    status: 1,
  },
  "0123456789012",
);
assert.equal(product.ref.externalId, "0123456789012");
assert.equal(product.servings[0].extras.find((extra) => extra.id === "sodium").amount, 400);
assert.equal(product.servings[0].extras.find((extra) => extra.id === "sodium").unit, "mg");

const restored = restoreWorkspace(
  JSON.stringify({
    activeDraftKey: null,
    customForm: {
      barcode: "",
      brand: "",
      calories: "",
      carbohydrates: "",
      customFoodId: null,
      extras: {},
      fat: "",
      name: "",
      operationId: "custom-op",
      protein: "",
      servingAmount: "",
      servingUnit: "g",
    },
    diaryDayMs: Date.parse("2026-04-01T12:00:00"),
    drafts: {
      "edit:99": {
        dayKey: "2026-04-01",
        items: [],
        key: "edit:99",
        loggedAt: Date.parse("2026-04-01T12:00:00"),
        mode: "edit",
        operationId: null,
        pendingTemplateOperationId: null,
        savedMealId: null,
        savedSignature: null,
        timelineEntryId: 99,
        title: "Gone",
        titleTouched: true,
      },
      "new:2026-04-02": {
        dayKey: "2026-04-02",
        items: [],
        key: "new:2026-04-02",
        loggedAt: Date.parse("2026-04-02T12:00:00"),
        mode: "create",
        operationId: "keep-op",
        pendingTemplateOperationId: null,
        savedMealId: null,
        savedSignature: null,
        timelineEntryId: null,
        title: "Later",
        titleTouched: true,
      },
    },
    expandedMealId: null,
    facts: null,
    homeDayMs: Date.parse("2026-04-01T12:00:00"),
    notice: null,
    picker: {
      query: "oats",
      scrollOffsets: { all: 12, custom: 0, favourites: 0 },
      sort: "recent",
      tab: "all",
    },
    scanner: { manualEntryOpen: false, typedBarcode: "" },
    stack: [
      { draftKey: "edit:99", screen: "mealLog" },
      { draftKey: "new:2026-04-02", screen: "mealLog" },
    ],
    version: 1,
  }),
  new Set([7]),
  new Map(),
);
assert.equal(restored.notice, "That meal is no longer available.");
assert.equal(restored.drafts["edit:99"], undefined);
assert.equal(restored.drafts["new:2026-04-02"].title, "Later");
assert.equal(restored.stack.length, 1);
assert.equal(restored.stack[0].draftKey, "new:2026-04-02");
assert.equal(restored.picker.query, "oats");

console.log("nutrition verification passed");
