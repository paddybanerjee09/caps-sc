import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { migrateDatabase } from "../src/data/database.ts";
import {
  createCustomFood,
  createSavedMeal,
  deleteCustomFood,
  deleteSavedMeal,
  getFoodUsage,
  listCustomFoods,
  listFavourites,
  listSavedMeals,
  saveFavouriteSnapshot,
  setFavourite,
} from "../src/data/nutritionCatalogRepository.ts";
import { nutritionV5MigrationSql } from "../src/data/nutritionMigration.ts";
import {
  createMealLog,
  deleteMealLog,
  getMealLogsForDay,
  updateMealLog,
} from "../src/data/nutritionRepository.ts";
import {
  calculateNutrientTotals,
  calorieCrossCheck,
  convertAmount,
  favouriteConfigKey,
  formatDerivedQuantity,
  localDayBounds,
  normalizeBarcode,
  sumExtraTotals,
} from "../src/nutrition/calculations.ts";
import {
  createCustomFoodForm,
  customFoodToForm,
  draftFromSavedMeal,
  draftFromStoredMeal,
  restoreWorkspace,
} from "../src/nutrition/drafts.ts";
import { convertServingQuantity, withServingUnits } from "../src/nutrition/servings.ts";
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

await migrateDatabase(adapter);
assert.equal(db.prepare("PRAGMA user_version").get().user_version, 10);
assert.ok(
  db
    .prepare("PRAGMA table_info(food_favourites)")
    .all()
    .some((column) => column.name === "snapshot_json"),
);
await migrateDatabase(adapter);

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
assert.equal((await getFoodUsage(adapter, 0)).size, 0);
assert.equal((await getFoodUsage(adapter, meal.loggedAt - 1)).has("custom:rice"), false);
assert.deepEqual((await getFoodUsage(adapter, meal.loggedAt)).get("custom:rice"), {
  count: 1,
  latestAt: meal.loggedAt,
});

const templateItem = { ...meal.items[0], brandName: "Example", quantity: 1.23456789 };
const templateDraft = draftFromSavedMeal({
  id: "template-1",
  title: "Template",
  items: [
    templateItem,
    {
      ...templateItem,
      food: { externalId: "42", source: "fatsecret" },
      storagePolicy: "reference",
    },
  ],
});
const [snapshotDraft, referenceDraft] = templateDraft.items;
assert.equal(snapshotDraft.quantityInput, "1.23456789");
assert.equal(snapshotDraft.resolved, true);
assert.deepEqual(snapshotDraft.nutrientsPerServing, templateItem.nutrientsPerServing);
assert.deepEqual(snapshotDraft.extrasPerServing, templateItem.extrasPerServing);
assert.equal(referenceDraft.quantityInput, snapshotDraft.quantityInput);
assert.equal(referenceDraft.resolved, false);
assert.equal(referenceDraft.description, null);
assert.equal(referenceDraft.brandName, null);
assert.deepEqual(referenceDraft.extrasPerServing, []);
assert.ok(Object.values(referenceDraft.nutrientsPerServing).every((value) => value === null));
assert.equal(referenceDraft.servingId, templateItem.servingId);
assert.equal(referenceDraft.servingAmount, templateItem.servingAmount);
assert.equal(referenceDraft.servingUnit, templateItem.servingUnit);
assert.equal(referenceDraft.servingDescription, templateItem.servingDescription);

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

function normalizeServings(serving) {
  return normalizeFatSecretFood({ food: { food_id: "42", servings: { serving } } });
}

const baseServing = { serving_id: "7" };
const preferredServing = { serving_id: "8", is_default: 1 };
assert.equal(normalizeServings([baseServing, preferredServing]).defaultServingId, "8");
assert.equal(
  normalizeServings([baseServing, { is_default: "1" }, preferredServing]).defaultServingId,
  "7",
);

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

// Provider household portions retain their known mass and can be logged per gram.
const measuredFood = normalizeServings([{
  serving_id: "120g-piece",
  serving_description: "1 piece (120 g)",
  measurement_description: "piece",
  metric_serving_amount: "120",
  metric_serving_unit: "g",
  calories: "240",
  protein: "12",
  carbohydrate: "24",
  fat: "8",
  sodium: "360",
}]);
assert.equal(measuredFood.servings[0].amount, 120);
assert.equal(measuredFood.servings[0].unit, "g");
const measuredOptions = withServingUnits(measuredFood);
const gram = measuredOptions.servings.find((serving) => serving.id === "caps:unit:g");
assert.equal(measuredOptions.defaultServingId, gram.id);
assert.equal(gram.amount, 1);
assert.equal(gram.nutrients.energyKcal, 2);
assert.equal(gram.nutrients.proteinG * 120, 12);
assert.equal(gram.extras.find((extra) => extra.id === "sodium").amount, 3);
assert.equal(measuredOptions.servings.find((serving) => serving.id === "caps:unit:oz").amount, 28.349523125);
assert.equal(measuredOptions.servings.find((serving) => serving.id === "caps:unit:lb").nutrients.energyKcal, 907.18474);
const ounce = measuredOptions.servings.find((serving) => serving.id === "caps:unit:oz");
assert.equal(convertServingQuantity(120, gram, ounce) * ounce.amount, 120);
assert.equal(convertServingQuantity(120, gram, measuredFood.servings[0]), 1);
const milligram = measuredOptions.servings.find((serving) => serving.id === "caps:unit:mg");
const kilogram = measuredOptions.servings.find((serving) => serving.id === "caps:unit:kg");
assert.equal(formatDerivedQuantity(convertServingQuantity(0.001, milligram, kilogram)), "0.000000001");
assert.equal(measuredOptions.servings.some((serving) => serving.unit === "ml"), false);
assert.equal(measuredOptions.servings.find((serving) => serving.id === "120g-piece").nutrients.energyKcal, 240);
assert.deepEqual(withServingUnits(measuredOptions), measuredOptions);
const partialOptions = withServingUnits({
  ...measuredOptions,
  servings: measuredOptions.servings.filter((serving) => serving.id !== "caps:unit:lb"),
});
assert.ok(partialOptions.servings.some((serving) => serving.id === "caps:unit:lb"));
assert.deepEqual(withServingUnits(partialOptions), partialOptions);
assert.deepEqual(withServingUnits(food), food); // No invented density for unmeasured cups.
const volumeFood = withServingUnits(normalizeServings([{
  serving_id: "cup",
  serving_description: "1 cup (240 mL)",
  metric_serving_amount: "240",
  metric_serving_unit: "ml",
  calories: "120",
}]));
assert.equal(volumeFood.defaultServingId, "caps:unit:ml");
assert.equal(volumeFood.servings.find((serving) => serving.id === "caps:unit:ml").nutrients.energyKcal, 0.5);
assert.equal(volumeFood.servings.find((serving) => serving.id === "caps:unit:cup").amount, 236.5882365);
assert.equal(volumeFood.servings.some((serving) => serving.unit === "g"), false);
assert.equal(convertServingQuantity(2, gram, volumeFood.servings[0]), 2);
assert.equal(convertServingQuantity(3, food.servings[0], gram), 3);
const unknownNutrients = withServingUnits({
  ...measuredFood,
  servings: [{ ...measuredFood.servings[0], nutrients: { energyKcal: 240, proteinG: null, carbohydratesG: null, fatG: null } }],
});
assert.equal(unknownNutrients.servings[0].nutrients.proteinG, null);
const liquidProduct = normalizeOpenFoodFactsProduct({ status: 1, product: {
  serving_size: "1 glass (250 ml)",
  serving_quantity: 250,
  serving_quantity_unit: "ml",
  nutriments: { "energy-kcal_100g": 40, sugars_100g: 10 },
} }, "0123456789012");
assert.equal(liquidProduct.servings[0].unit, "ml");
assert.equal(liquidProduct.servings[1].nutrients.energyKcal, 100);
assert.equal(withServingUnits(liquidProduct).defaultServingId, "caps:unit:ml");
const conflictingProduct = normalizeOpenFoodFactsProduct({ status: 1, product: {
  serving_size: "1 scoop (30 ml)",
  product_quantity_unit: "g",
  nutriments: { "energy-kcal_100g": 200 },
} }, "0123456789012");
assert.equal(conflictingProduct.servings[0].unit, "g");
assert.equal(conflictingProduct.servings.length, 1); // No mass-to-volume inference.

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

const mealCount = () =>
  db.prepare(`SELECT COUNT(*) AS count FROM timeline_entries WHERE kind = 'meal'`).get().count;
const { dayStart, dayEnd } = localDayBounds(new Date(meal.loggedAt));
const findLunch = async () =>
  (await getMealLogsForDay(adapter, dayStart.getTime(), dayEnd.getTime())).find(
    (candidate) => candidate.timelineEntryId === firstId,
  );

const editDraft = draftFromStoredMeal(await findLunch());
assert.equal(editDraft.mode, "edit");
assert.equal(editDraft.timelineEntryId, firstId);
assert.equal(editDraft.title, "Lunch");
assert.equal(editDraft.loggedAt, meal.loggedAt);
assert.equal(editDraft.items.length, 1);
assert.equal(editDraft.items[0].quantityInput, "1");
assert.equal(editDraft.items[0].servingId, "base");
assert.equal(editDraft.items[0].servingDescription, "100 g");

const editedLoggedAt = Math.max(dayStart.getTime(), meal.loggedAt - 60_000);
await updateMealLog(adapter, firstId, {
  ...meal,
  items: [
    { ...meal.items[0], quantity: 2 },
    { ...meal.items[0], description: "Beans", food: { externalId: "beans", source: "custom" } },
  ],
  loggedAt: editedLoggedAt,
  title: "Late lunch",
});
assert.equal(mealCount(), 2);
const editedLunch = await findLunch();
assert.equal(editedLunch.title, "Late lunch");
assert.equal(editedLunch.loggedAt, editedLoggedAt);
assert.deepEqual(
  editedLunch.items.map((item) => [item.description, item.quantity]),
  [
    ["Rice", 2],
    ["Beans", 1],
  ],
);

const discardedDraft = draftFromStoredMeal(editedLunch);
// Small converted portions must not be rounded when reopening a diary or template.
const fractionalQuantity = 1 / 453.59237;
assert.equal(draftFromStoredMeal({
  ...editedLunch,
  items: [{ ...editedLunch.items[0], quantity: fractionalQuantity }],
}).items[0].quantityInput, String(fractionalQuantity));
assert.equal(draftFromSavedMeal({
  id: "fractional-template",
  title: "One gram in pounds",
  items: [{ ...meal.items[0], quantity: fractionalQuantity }],
}).items[0].quantityInput, String(fractionalQuantity));
discardedDraft.title = "Never saved";
discardedDraft.items = [];
assert.deepEqual(draftFromStoredMeal(await findLunch()), draftFromStoredMeal(editedLunch));
assert.equal(mealCount(), 2);

await deleteMealLog(adapter, firstId);
assert.equal(await findLunch(), undefined);
assert.equal(mealCount(), 1);
assert.equal(
  db.prepare(`SELECT COUNT(*) AS count FROM meal_items WHERE meal_timeline_entry_id = ?`).get(firstId)
    .count,
  0,
);
assert.equal(db.prepare(`SELECT title FROM timeline_entries WHERE id = 7`).get().title, "Breakfast");
await assert.rejects(deleteMealLog(adapter, firstId));

const firstForm = createCustomFoodForm();
const secondForm = createCustomFoodForm();
assert.notEqual(firstForm.operationId, secondForm.operationId);
assert.equal(secondForm.customFoodId, null);
assert.equal(secondForm.name, "");
const customInput = {
  barcode: null,
  brand: null,
  carbohydratesG: 10,
  energyKcal: 100,
  extras: [],
  fatG: 2,
  name: "Wrap",
  proteinG: 5,
  servingAmount: 1,
  servingUnit: "serving",
};
const wrapId = await createCustomFood(adapter, firstForm.operationId, customInput);
assert.equal(await createCustomFood(adapter, firstForm.operationId, customInput), wrapId);
const saladId = await createCustomFood(adapter, secondForm.operationId, {
  ...customInput,
  name: "Salad",
});
assert.notEqual(saladId, wrapId);
const editForm = customFoodToForm({
  ...customInput,
  extras: [],
  id: wrapId,
});
assert.equal(editForm.customFoodId, wrapId);
assert.equal(editForm.name, "Wrap");
assert.notEqual(editForm.operationId, firstForm.operationId);
const freshCreate = createCustomFoodForm();
assert.equal(freshCreate.customFoodId, null);
assert.equal(freshCreate.name, "");
assert.notEqual(freshCreate.operationId, firstForm.operationId);
assert.notEqual(freshCreate.operationId, editForm.operationId);
assert.deepEqual(
  (await listCustomFoods(adapter)).map((custom) => [custom.id, custom.name]),
  [
    [saladId, "Salad"],
    [wrapId, "Wrap"],
  ],
);

const wrapRef = { externalId: wrapId, source: "custom" };
await setFavourite(adapter, {
  amount: 1,
  configKey: favouriteConfigKey(wrapRef, "base", 1),
  food: wrapRef,
  servingId: "base",
  snapshot: null,
});
await deleteCustomFood(adapter, wrapId);
assert.deepEqual(
  (await listCustomFoods(adapter)).map((custom) => custom.id),
  [saladId],
);
assert.equal(
  (await listFavourites(adapter)).some((favourite) => favourite.food.externalId === wrapId),
  false,
);
await assert.rejects(deleteCustomFood(adapter, wrapId));

const productKey = favouriteConfigKey(product.ref, "100g", 2);
await setFavourite(adapter, {
  amount: 2,
  configKey: productKey,
  food: product.ref,
  servingId: "100g",
  snapshot: product,
});
await setFavourite(adapter, {
  amount: 1,
  configKey: favouriteConfigKey(food.ref, "7", 1),
  food: food.ref,
  servingId: "7",
  snapshot: food,
});
db.prepare(
  `INSERT INTO food_favourites (
    id, source, external_id, serving_id, amount, config_key, created_at
  ) VALUES ('legacy', 'openfoodfacts', '0123456789012', '100g', 1, 'legacy-key', 1)`,
).run();
let favouriteRows = await listFavourites(adapter);
const productFavourite = favouriteRows.find((favourite) => favourite.configKey === productKey);
assert.equal(productFavourite.snapshot.name, "Beans");
assert.deepEqual(productFavourite.snapshot.ref, product.ref);
assert.equal(productFavourite.snapshot.servings[0].id, "100g");
assert.equal(
  favouriteRows.find((favourite) => favourite.food.source === "fatsecret").snapshot.name,
  "Milk",
);
assert.equal(
  favouriteRows.find((favourite) => favourite.food.source === "fatsecret").snapshot.ref.externalId,
  "42",
);
assert.equal(favouriteRows.find((favourite) => favourite.id === "legacy").snapshot, null);
await saveFavouriteSnapshot(adapter, "legacy", product);
await saveFavouriteSnapshot(adapter, "legacy", { ...product, name: "Overwritten" });
favouriteRows = await listFavourites(adapter);
assert.equal(favouriteRows.find((favourite) => favourite.id === "legacy").snapshot.name, "Beans");

// Reference-only storage retains derived unit identity and quantity across reloads.
const referenceItem = {
  brandName: null,
  description: "Measured piece",
  extrasPerServing: gram.extras,
  food: measuredFood.ref,
  nutrientsPerServing: gram.nutrients,
  quantity: 60,
  servingAmount: gram.amount,
  servingDescription: gram.label,
  servingId: gram.id,
  servingUnit: gram.unit,
  storagePolicy: "reference",
};
const referenceLogId = await createMealLog(adapter, {
  ...meal,
  operationId: "op-derived-unit-log",
  items: [referenceItem],
});
const persistedReference = db.prepare(
  `SELECT * FROM meal_items WHERE meal_timeline_entry_id = ?`,
).get(referenceLogId);
assert.equal(persistedReference.serving_id, "caps:unit:g");
assert.equal(persistedReference.quantity, 60);
assert.equal(persistedReference.energy_kcal_per_serving, null);
const rehydratedServing = withServingUnits(measuredFood).servings.find(
  (serving) => serving.id === persistedReference.serving_id,
);
assert.equal(rehydratedServing.nutrients.energyKcal * persistedReference.quantity, 120);
const referenceTemplateId = await createSavedMeal(adapter, "op-derived-unit-template", "Measured meal", [referenceItem]);
const reloadedTemplate = (await listSavedMeals(adapter)).find((saved) => saved.id === referenceTemplateId);
assert.equal(reloadedTemplate.items[0].servingId, gram.id);
assert.equal(reloadedTemplate.items[0].quantity, 60);
await deleteSavedMeal(adapter, referenceTemplateId);
await deleteMealLog(adapter, referenceLogId);

// Unsave removes only the reusable composition; its diary event survives intact.
const savedMealId = await createSavedMeal(adapter, "op-save-toggle-first", "Toggle meal", meal.items);
const savedDiaryId = await createMealLog(adapter, {
  ...meal,
  operationId: "op-save-toggle-diary",
  savedMealId,
});
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM saved_meal_items WHERE saved_meal_id = ?`).get(savedMealId).count, 1);
await deleteSavedMeal(adapter, savedMealId);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM saved_meals WHERE id = ?`).get(savedMealId).count, 0);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM saved_meal_items WHERE saved_meal_id = ?`).get(savedMealId).count, 0);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM meal_logs WHERE timeline_entry_id = ?`).get(savedDiaryId).count, 1);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM meal_items WHERE meal_timeline_entry_id = ?`).get(savedDiaryId).count, 1);
const savedAgainId = await createSavedMeal(adapter, "op-save-toggle-second", "Toggle meal", meal.items);
assert.notEqual(savedAgainId, savedMealId);
assert.ok((await listSavedMeals(adapter)).some((saved) => saved.id === savedAgainId));
await deleteSavedMeal(adapter, savedAgainId);
await deleteMealLog(adapter, savedDiaryId);

// Crash recovery can replay a receipt after Unsave deleted its original result.
const failingTemplateAdapter = {
  ...adapter,
  async runAsync(sql, params = []) {
    if (/INSERT INTO saved_meals\s*\(/.test(sql)) {
      throw new Error("Injected template insert failure");
    }
    return adapter.runAsync(sql, params);
  },
};
await assert.rejects(
  createSavedMeal(failingTemplateAdapter, "op-save-toggle-first", "Toggle meal", meal.items),
  /Injected template insert failure/,
);
assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM saved_meals WHERE operation_id = ?`)
  .get("op-save-toggle-first").count, 0);
const replayedSavedId = await createSavedMeal(adapter, "op-save-toggle-first", "Toggle meal", meal.items);
assert.notEqual(replayedSavedId, savedMealId);
assert.ok((await listSavedMeals(adapter)).some((saved) => saved.id === replayedSavedId));
assert.equal(await createSavedMeal(adapter, "op-save-toggle-first", "Toggle meal", meal.items), replayedSavedId);
await deleteSavedMeal(adapter, replayedSavedId);

console.log("nutrition verification passed");
