import { createId, calculateNutrientTotals, isFoodUnit, parseExtraNutrients, serializeExtraNutrients } from "../nutrition/calculations";
import { parseCatalogFood } from "../nutrition/drafts";
import type {
  CatalogFood,
  ExtraNutrientValue,
  FoodRef,
  FoodSource,
  FoodUnit,
  NewMealItem,
  NutrientSnapshot,
  StoragePolicy,
} from "../types/nutrition";
import type { SQLiteDatabase } from "expo-sqlite";

export type CustomFoodInput = {
  name: string;
  brand: string | null;
  barcode: string | null;
  servingAmount: number;
  servingUnit: FoodUnit;
  energyKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  extras: ExtraNutrientValue[];
};

export type CustomFoodRecord = CustomFoodInput & {
  id: string;
  operationId: string;
  createdAt: number;
  updatedAt: number;
};

export type FoodFavourite = {
  id: string;
  food: FoodRef;
  servingId: string;
  amount: number;
  configKey: string;
  createdAt: number;
  snapshot: CatalogFood | null;
};

export type SavedMealSummary = {
  id: string;
  title: string;
  createdAt: number;
  loggedCount: number;
  items: NewMealItem[];
};

export type KnownFoodRow = {
  food: FoodRef;
  storagePolicy: StoragePolicy;
  description: string | null;
  brandName: string | null;
  servingId: string;
  servingAmount: number | null;
  servingUnit: FoodUnit | null;
  servingDescription: string | null;
  nutrients: NutrientSnapshot | null;
  extras: ExtraNutrientValue[];
};

type CustomFoodRow = {
  id: string;
  operation_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_amount: number;
  serving_unit: string;
  energy_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  extra_nutrients_json: string | null;
  created_at: number;
  updated_at: number;
};

const FOOD_SOURCES = new Set<FoodSource>([
  "fatsecret",
  "openfoodfacts",
  "custom",
  "usda",
]);

export async function getCommittedOperations(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ operation_id: string; result_id: string }>(
    `SELECT operation_id, result_id
     FROM nutrition_operations
     WHERE status = 'committed'
       AND result_id IS NOT NULL`,
  );

  return new Map(rows.map((row) => [row.operation_id, row.result_id]));
}

export async function readWorkspacePayload(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ payload: string }>(
    `SELECT payload FROM nutrition_workspace WHERE id = 1`,
  );

  return row?.payload ?? null;
}

export async function writeWorkspacePayload(db: SQLiteDatabase, payload: string) {
  await db.runAsync(
    `INSERT INTO nutrition_workspace (id, payload, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [payload, Date.now()],
  );
}

export async function createCustomFood(
  db: SQLiteDatabase,
  operationId: string,
  input: CustomFoodInput,
) {
  const validated = validateCustomFood(input);

  await db.runAsync(
    `INSERT OR IGNORE INTO nutrition_operations (
       operation_id, kind, status, result_id, created_at
     ) VALUES (?, 'custom_food_create', 'pending', NULL, ?)`,
    [operationId, Date.now()],
  );

  let foodId: string | null = null;

  try {
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{
        status: string;
        result_id: string | null;
      }>(
        `SELECT status, result_id FROM nutrition_operations WHERE operation_id = ?`,
        [operationId],
      );

      if (existing?.status === "committed" && existing.result_id) {
        foodId = existing.result_id;
        return;
      }

      foodId = createId();
      const now = Date.now();

      await db.runAsync(
        `INSERT INTO custom_foods (
          id, operation_id, name, brand, barcode, serving_amount, serving_unit,
          energy_kcal, protein_g, carbohydrates_g, fat_g, extra_nutrients_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          foodId,
          operationId,
          validated.name,
          validated.brand,
          validated.barcode,
          validated.servingAmount,
          validated.servingUnit,
          validated.energyKcal,
          validated.proteinG,
          validated.carbohydratesG,
          validated.fatG,
          serializeExtraNutrients(validated.extras),
          now,
          now,
        ],
      );

      await db.runAsync(
        `UPDATE nutrition_operations
         SET status = 'committed', result_id = ?
         WHERE operation_id = ?`,
        [foodId, operationId],
      );
    });
  } catch (error) {
    const existing = await db.getFirstAsync<{ result_id: string | null }>(
      `SELECT result_id FROM nutrition_operations
       WHERE operation_id = ? AND status = 'committed'`,
      [operationId],
    );

    if (existing?.result_id) {
      return existing.result_id;
    }

    throw error;
  }

  if (!foodId) {
    throw new Error("Custom food could not be saved");
  }

  return foodId;
}

export async function updateCustomFood(
  db: SQLiteDatabase,
  id: string,
  input: CustomFoodInput,
) {
  const validated = validateCustomFood(input);
  const result = await db.runAsync(
    `UPDATE custom_foods
     SET name = ?, brand = ?, barcode = ?, serving_amount = ?, serving_unit = ?,
         energy_kcal = ?, protein_g = ?, carbohydrates_g = ?, fat_g = ?,
         extra_nutrients_json = ?, updated_at = ?
     WHERE id = ?`,
    [
      validated.name,
      validated.brand,
      validated.barcode,
      validated.servingAmount,
      validated.servingUnit,
      validated.energyKcal,
      validated.proteinG,
      validated.carbohydratesG,
      validated.fatG,
      serializeExtraNutrients(validated.extras),
      Date.now(),
      id,
    ],
  );

  if (result.changes !== 1) {
    throw new Error("Custom food not found");
  }
}

export async function deleteCustomFood(db: SQLiteDatabase, id: string) {
  let deleted = 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM food_favourites WHERE source = 'custom' AND external_id = ?`,
      [id],
    );
    const result = await db.runAsync(`DELETE FROM custom_foods WHERE id = ?`, [id]);
    deleted = result.changes;
  });

  if (deleted !== 1) {
    throw new Error("Custom food not found");
  }
}

export async function getCustomFood(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<CustomFoodRow>(
    `SELECT * FROM custom_foods WHERE id = ?`,
    [id],
  );

  return row ? convertCustomFood(row) : null;
}

export async function listCustomFoods(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<CustomFoodRow>(
    `SELECT * FROM custom_foods ORDER BY name COLLATE NOCASE ASC, id ASC`,
  );

  return rows.map(convertCustomFood);
}

export async function listFavourites(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{
    id: string;
    source: string;
    external_id: string;
    serving_id: string;
    amount: number;
    config_key: string;
    created_at: number;
    snapshot_json: string | null;
  }>(
    `SELECT * FROM food_favourites ORDER BY created_at DESC, id ASC`,
  );

  return rows.flatMap((row) => {
    if (!isFoodSource(row.source)) {
      return [];
    }

    const food = { source: row.source, externalId: row.external_id };

    return [
      {
        id: row.id,
        food,
        servingId: row.serving_id,
        amount: row.amount,
        configKey: row.config_key,
        createdAt: row.created_at,
        snapshot: parseFavouriteSnapshot(row.snapshot_json, food),
      } satisfies FoodFavourite,
    ];
  });
}

export async function setFavourite(
  db: SQLiteDatabase,
  favourite: Omit<FoodFavourite, "id" | "createdAt">,
) {
  await db.runAsync(
    `INSERT OR IGNORE INTO food_favourites (
      id, source, external_id, serving_id, amount, config_key, created_at,
      snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId(),
      favourite.food.source,
      favourite.food.externalId,
      favourite.servingId,
      favourite.amount,
      favourite.configKey,
      Date.now(),
      serializeFavouriteSnapshot(favourite.snapshot),
    ],
  );
}

export async function saveFavouriteSnapshot(
  db: SQLiteDatabase,
  id: string,
  snapshot: CatalogFood,
) {
  const json = serializeFavouriteSnapshot(snapshot);

  if (!json) {
    return;
  }

  await db.runAsync(
    `UPDATE food_favourites
     SET snapshot_json = ?
     WHERE id = ? AND snapshot_json IS NULL`,
    [json, id],
  );
}

export async function removeFavourite(db: SQLiteDatabase, configKey: string) {
  await db.runAsync(`DELETE FROM food_favourites WHERE config_key = ?`, [
    configKey,
  ]);
}

export async function createSavedMeal(
  db: SQLiteDatabase,
  operationId: string,
  title: string,
  items: NewMealItem[],
) {
  const trimmed = title.trim();

  if (!trimmed || items.length === 0) {
    throw new Error("A saved meal needs a title and at least one food");
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO nutrition_operations (
       operation_id, kind, status, result_id, created_at
     ) VALUES (?, 'saved_meal_create', 'pending', NULL, ?)`,
    [operationId, Date.now()],
  );

  let savedMealId: string | null = null;

  try {
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{
        status: string;
        result_id: string | null;
      }>(
        `SELECT status, result_id FROM nutrition_operations WHERE operation_id = ?`,
        [operationId],
      );

      if (existing?.status === "committed" && existing.result_id) {
        savedMealId = existing.result_id;
        return;
      }

      savedMealId = createId();
      const now = Date.now();

      await db.runAsync(
        `INSERT INTO saved_meals (
          id, operation_id, title, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)`,
        [savedMealId, operationId, trimmed, now, now],
      );

      for (const [index, item] of items.entries()) {
        await insertSavedMealItem(db, savedMealId, index, item);
      }

      await db.runAsync(
        `UPDATE nutrition_operations
         SET status = 'committed', result_id = ?
         WHERE operation_id = ?`,
        [savedMealId, operationId],
      );
    });
  } catch (error) {
    const existing = await db.getFirstAsync<{ result_id: string | null }>(
      `SELECT result_id FROM nutrition_operations
       WHERE operation_id = ? AND status = 'committed'`,
      [operationId],
    );

    if (existing?.result_id) {
      return existing.result_id;
    }

    throw error;
  }

  if (!savedMealId) {
    throw new Error("Saved meal could not be created");
  }

  return savedMealId;
}

export async function updateSavedMeal(
  db: SQLiteDatabase,
  savedMealId: string,
  title: string,
  items: NewMealItem[],
) {
  const trimmed = title.trim();

  if (!trimmed || items.length === 0) {
    throw new Error("A saved meal needs a title and at least one food");
  }

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM saved_meals WHERE id = ?`,
      [savedMealId],
    );

    if (!existing) {
      throw new Error("Saved meal not found");
    }

    await db.runAsync(
      `UPDATE saved_meals SET title = ?, updated_at = ? WHERE id = ?`,
      [trimmed, Date.now(), savedMealId],
    );
    await db.runAsync(`DELETE FROM saved_meal_items WHERE saved_meal_id = ?`, [
      savedMealId,
    ]);

    for (const [index, item] of items.entries()) {
      await insertSavedMealItem(db, savedMealId, index, item);
    }
  });
}

export async function deleteSavedMeal(db: SQLiteDatabase, savedMealId: string) {
  await db.runAsync(`DELETE FROM saved_meals WHERE id = ?`, [savedMealId]);
}

export async function listSavedMeals(db: SQLiteDatabase, now = Date.now()) {
  const meals = await db.getAllAsync<{
    id: string;
    title: string;
    created_at: number;
    logged_count: number;
  }>(
    `SELECT
       saved_meals.id,
       saved_meals.title,
       saved_meals.created_at,
       (
         SELECT COUNT(*)
         FROM meal_logs
         INNER JOIN timeline_entries
           ON timeline_entries.id = meal_logs.timeline_entry_id
         WHERE meal_logs.saved_meal_id = saved_meals.id
           AND timeline_entries.start_at <= ?
       ) AS logged_count
     FROM saved_meals`,
    [now],
  );

  const itemRows = await db.getAllAsync<SavedItemRow>(
    `SELECT * FROM saved_meal_items ORDER BY saved_meal_id ASC, position ASC, id ASC`,
  );
  const itemsByMeal = new Map<string, NewMealItem[]>();

  for (const row of itemRows) {
    const item = convertSavedItem(row);
    const items = itemsByMeal.get(row.saved_meal_id) ?? [];
    items.push(item);
    itemsByMeal.set(row.saved_meal_id, items);
  }

  return meals.map(
    (meal): SavedMealSummary => ({
      id: meal.id,
      title: meal.title,
      createdAt: meal.created_at,
      loggedCount: meal.logged_count,
      items: itemsByMeal.get(meal.id) ?? [],
    }),
  );
}

export async function getFoodUsage(db: SQLiteDatabase, now = Date.now()) {
  const rows = await db.getAllAsync<{
    source: string;
    external_id: string;
    usage_count: number;
    latest_at: number;
  }>(
    `SELECT
       meal_items.source AS source,
       meal_items.external_id AS external_id,
       COUNT(*) AS usage_count,
       MAX(timeline_entries.start_at) AS latest_at
     FROM meal_items
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = meal_items.meal_timeline_entry_id
     INNER JOIN timeline_entries
       ON timeline_entries.id = meal_logs.timeline_entry_id
     WHERE timeline_entries.kind = 'meal'
       AND timeline_entries.start_at <= ?
     GROUP BY meal_items.source, meal_items.external_id`,
    [now],
  );

  const usage = new Map<string, { count: number; latestAt: number }>();

  for (const row of rows) {
    usage.set(`${row.source}:${row.external_id}`, {
      count: row.usage_count,
      latestAt: row.latest_at,
    });
  }

  return usage;
}

export async function hasCompletedFoodUsage(db: SQLiteDatabase, now = Date.now()) {
  const row = await db.getFirstAsync<{ present: number }>(
    `SELECT 1 AS present
     FROM meal_items
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = meal_items.meal_timeline_entry_id
     INNER JOIN timeline_entries
       ON timeline_entries.id = meal_logs.timeline_entry_id
     WHERE timeline_entries.kind = 'meal'
       AND timeline_entries.start_at <= ?
     LIMIT 1`,
    [now],
  );

  return row !== null;
}

export async function listKnownFoods(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{
    source: string;
    external_id: string;
    storage_policy: StoragePolicy;
    food_description: string | null;
    brand_name: string | null;
    serving_id: string;
    serving_amount: number | null;
    serving_unit: string | null;
    serving_description: string | null;
    energy_kcal_per_serving: number | null;
    protein_g_per_serving: number | null;
    carbohydrates_g_per_serving: number | null;
    fat_g_per_serving: number | null;
    extra_nutrients_json: string | null;
  }>(
    `SELECT source, external_id, storage_policy, food_description, brand_name,
            serving_id, serving_amount, serving_unit, serving_description,
            energy_kcal_per_serving, protein_g_per_serving,
            carbohydrates_g_per_serving, fat_g_per_serving, extra_nutrients_json
     FROM (
       SELECT
         meal_items.*,
         ROW_NUMBER() OVER (
           PARTITION BY meal_items.source, meal_items.external_id
           ORDER BY timeline_entries.start_at DESC, meal_items.id DESC
         ) AS rn
       FROM meal_items
       INNER JOIN meal_logs
         ON meal_logs.timeline_entry_id = meal_items.meal_timeline_entry_id
       INNER JOIN timeline_entries
         ON timeline_entries.id = meal_logs.timeline_entry_id
       WHERE timeline_entries.kind = 'meal'
     )
     WHERE rn = 1`,
  );

  return rows.flatMap((row) => {
    if (!isFoodSource(row.source)) {
      return [];
    }

    const reference = row.storage_policy === "reference";

    return [
      {
        food: { source: row.source, externalId: row.external_id },
        storagePolicy: row.storage_policy,
        description: reference ? null : row.food_description,
        brandName: reference ? null : row.brand_name,
        servingId: row.serving_id,
        servingAmount: reference ? null : row.serving_amount,
        servingUnit:
          !reference && row.serving_unit && isFoodUnit(row.serving_unit)
            ? row.serving_unit
            : null,
        servingDescription: reference ? null : row.serving_description,
        nutrients: reference
          ? null
          : {
              energyKcal: row.energy_kcal_per_serving,
              proteinG: row.protein_g_per_serving,
              carbohydratesG: row.carbohydrates_g_per_serving,
              fatG: row.fat_g_per_serving,
            },
        extras: reference ? [] : parseExtraNutrients(row.extra_nutrients_json),
      } satisfies KnownFoodRow,
    ];
  });
}

export function totalsForItems(items: readonly NewMealItem[]) {
  return calculateNutrientTotals(
    items.map((item) => ({
      quantity: item.quantity,
      nutrientsPerServing: item.nutrientsPerServing,
    })),
  );
}

type SavedItemRow = {
  saved_meal_id: string;
  source: string;
  external_id: string;
  serving_id: string;
  food_description: string | null;
  brand_name: string | null;
  quantity: number;
  serving_amount: number | null;
  serving_unit: string | null;
  serving_description: string | null;
  storage_policy: StoragePolicy;
  energy_kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbohydrates_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  extra_nutrients_json: string | null;
};

async function insertSavedMealItem(
  db: SQLiteDatabase,
  savedMealId: string,
  position: number,
  item: NewMealItem,
) {
  const reference = item.storagePolicy === "reference";

  await db.runAsync(
    `INSERT INTO saved_meal_items (
      saved_meal_id, position, source, external_id, serving_id,
      food_description, brand_name, quantity, serving_amount, serving_unit,
      serving_description, storage_policy, energy_kcal_per_serving,
      protein_g_per_serving, carbohydrates_g_per_serving, fat_g_per_serving,
      extra_nutrients_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      savedMealId,
      position,
      item.food.source,
      item.food.externalId,
      item.servingId,
      reference ? null : item.description,
      reference ? null : item.brandName,
      item.quantity,
      reference ? null : item.servingAmount,
      reference ? null : item.servingUnit,
      reference ? null : item.servingDescription,
      item.storagePolicy,
      reference ? null : item.nutrientsPerServing.energyKcal,
      reference ? null : item.nutrientsPerServing.proteinG,
      reference ? null : item.nutrientsPerServing.carbohydratesG,
      reference ? null : item.nutrientsPerServing.fatG,
      reference ? null : serializeExtraNutrients(item.extrasPerServing),
    ],
  );
}

function convertSavedItem(row: SavedItemRow): NewMealItem {
  if (!isFoodSource(row.source)) {
    throw new Error("Invalid saved meal item");
  }

  const reference = row.storage_policy === "reference";

  return {
    food: { source: row.source, externalId: row.external_id },
    servingId: row.serving_id,
    description: reference ? null : row.food_description,
    brandName: reference ? null : row.brand_name,
    quantity: row.quantity,
    servingAmount: reference ? null : row.serving_amount,
    servingUnit:
      !reference && row.serving_unit && isFoodUnit(row.serving_unit)
        ? row.serving_unit
        : null,
    servingDescription: reference ? null : row.serving_description,
    nutrientsPerServing: reference
      ? {
          energyKcal: null,
          proteinG: null,
          carbohydratesG: null,
          fatG: null,
        }
      : {
          energyKcal: row.energy_kcal_per_serving,
          proteinG: row.protein_g_per_serving,
          carbohydratesG: row.carbohydrates_g_per_serving,
          fatG: row.fat_g_per_serving,
        },
    extrasPerServing: reference ? [] : parseExtraNutrients(row.extra_nutrients_json),
    storagePolicy: row.storage_policy,
  };
}

function convertCustomFood(row: CustomFoodRow): CustomFoodRecord {
  if (!isFoodUnit(row.serving_unit)) {
    throw new Error("Invalid custom food");
  }

  return {
    id: row.id,
    operationId: row.operation_id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    servingAmount: row.serving_amount,
    servingUnit: row.serving_unit,
    energyKcal: row.energy_kcal,
    proteinG: row.protein_g,
    carbohydratesG: row.carbohydrates_g,
    fatG: row.fat_g,
    extras: parseExtraNutrients(row.extra_nutrients_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateCustomFood(input: CustomFoodInput): CustomFoodInput {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Food name is required");
  }

  if (!Number.isFinite(input.servingAmount) || input.servingAmount <= 0) {
    throw new Error("Serving amount must be greater than zero");
  }

  if (!isFoodUnit(input.servingUnit)) {
    throw new Error("Invalid serving unit");
  }

  for (const value of [
    input.energyKcal,
    input.proteinG,
    input.carbohydratesG,
    input.fatG,
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Invalid nutrient value");
    }
  }

  return {
    ...input,
    name,
    brand: input.brand?.trim() || null,
    barcode: input.barcode?.trim() || null,
  };
}

function serializeFavouriteSnapshot(snapshot: CatalogFood | null) {
  if (!snapshot || snapshot.servings.length === 0) {
    return null;
  }

  return JSON.stringify({
    ...snapshot,
    storagePolicy: "snapshot",
  });
}

function parseFavouriteSnapshot(json: string | null, food: FoodRef) {
  if (!json) {
    return null;
  }

  try {
    const snapshot = parseCatalogFood(JSON.parse(json));

    return snapshot &&
      snapshot.ref.source === food.source &&
      snapshot.ref.externalId === food.externalId
      ? snapshot
      : null;
  } catch {
    return null;
  }
}

function isFoodSource(value: string): value is FoodSource {
  return FOOD_SOURCES.has(value as FoodSource);
}
