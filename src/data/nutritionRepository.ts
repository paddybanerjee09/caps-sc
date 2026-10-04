import type { SQLiteDatabase } from "expo-sqlite";

import {
  calculateNutrientTotals,
  emptyNutrientSnapshot,
  isFoodUnit,
  parseExtraNutrients,
  serializeExtraNutrients,
} from "../nutrition/calculations";
import type {
  FoodSource,
  NewMealItem,
  NewMealLog,
  NutrientSnapshot,
  StoragePolicy,
  StoredMealItem,
  StoredMealLog,
} from "../types/nutrition";

type MealRow = {
  timeline_entry_id: number;
  title: string;
  logged_at: number;
  created_at: number;
  updated_at: number;
  operation_id: string | null;
  saved_meal_id: string | null;
  item_id: number | null;
  source: FoodSource | null;
  external_id: string | null;
  serving_id: string | null;
  food_description: string | null;
  brand_name: string | null;
  quantity: number | null;
  serving_amount: number | null;
  serving_unit: string | null;
  serving_description: string | null;
  storage_policy: StoragePolicy | null;
  energy_kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbohydrates_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  extra_nutrients_json: string | null;
};

type CountRow = { count: number };

type OperationRow = {
  status: string;
  result_id: string | null;
};

const FOOD_SOURCES = new Set<FoodSource>([
  "fatsecret",
  "openfoodfacts",
  "custom",
  "usda",
]);

export async function getMealLogsForDay(
  db: SQLiteDatabase,
  dayStart: number,
  dayEnd: number,
): Promise<StoredMealLog[]> {
  validateDayBounds(dayStart, dayEnd);

  const rows = await db.getAllAsync<MealRow>(
    `SELECT
       timeline_entries.id AS timeline_entry_id,
       timeline_entries.title,
       timeline_entries.start_at AS logged_at,
       timeline_entries.created_at,
       timeline_entries.updated_at,
       meal_logs.operation_id,
       meal_logs.saved_meal_id,
       meal_items.id AS item_id,
       meal_items.source,
       meal_items.external_id,
       meal_items.serving_id,
       meal_items.food_description,
       meal_items.brand_name,
       meal_items.quantity,
       meal_items.serving_amount,
       meal_items.serving_unit,
       meal_items.serving_description,
       meal_items.storage_policy,
       meal_items.energy_kcal_per_serving,
       meal_items.protein_g_per_serving,
       meal_items.carbohydrates_g_per_serving,
       meal_items.fat_g_per_serving,
       meal_items.extra_nutrients_json
     FROM timeline_entries
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = timeline_entries.id
     LEFT JOIN meal_items
       ON meal_items.meal_timeline_entry_id = meal_logs.timeline_entry_id
     WHERE timeline_entries.kind = 'meal'
       AND timeline_entries.start_at >= ?
       AND timeline_entries.start_at < ?
     ORDER BY
       timeline_entries.start_at ASC,
       timeline_entries.id ASC,
       meal_items.id ASC`,
    [dayStart, dayEnd],
  );

  const mealsById = new Map<number, StoredMealLog>();

  for (const row of rows) {
    let meal = mealsById.get(row.timeline_entry_id);

    if (!meal) {
      meal = {
        timelineEntryId: row.timeline_entry_id,
        title: row.title,
        loggedAt: row.logged_at,
        status: getMealStatus(row.logged_at),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        operationId: row.operation_id,
        savedMealId: row.saved_meal_id,
        items: [],
        totals: calculateNutrientTotals([]),
      };
      mealsById.set(row.timeline_entry_id, meal);
    }

    const item = convertMealItemRow(row);

    if (item) {
      meal.items.push(item);
    }
  }

  return Array.from(mealsById.values()).map((meal) => ({
    ...meal,
    totals: calculateNutrientTotals(meal.items),
  }));
}

export async function getMealCountForDay(
  db: SQLiteDatabase,
  dayStart: number,
  dayEnd: number,
) {
  validateDayBounds(dayStart, dayEnd);

  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) AS count
     FROM timeline_entries
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = timeline_entries.id
     WHERE timeline_entries.kind = 'meal'
       AND timeline_entries.start_at >= ?
       AND timeline_entries.start_at < ?`,
    [dayStart, dayEnd],
  );

  return row?.count ?? 0;
}

export async function getExistingMealIds(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT timeline_entries.id AS id
     FROM timeline_entries
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = timeline_entries.id
     WHERE timeline_entries.kind = 'meal'`,
  );

  return new Set(rows.map((row) => row.id));
}

export async function mealExists(db: SQLiteDatabase, timelineEntryId: number) {
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT timeline_entries.id AS id
     FROM timeline_entries
     INNER JOIN meal_logs
       ON meal_logs.timeline_entry_id = timeline_entries.id
     WHERE timeline_entries.id = ?
       AND timeline_entries.kind = 'meal'`,
    [timelineEntryId],
  );

  return row !== null;
}

export async function createMealLog(db: SQLiteDatabase, meal: NewMealLog) {
  if (!meal.operationId) {
    throw new Error("Missing meal operation");
  }

  const validatedMeal = validateMealLog(meal);

  await db.runAsync(
    `INSERT OR IGNORE INTO nutrition_operations (
       operation_id,
       kind,
       status,
       result_id,
       created_at
     ) VALUES (?, 'meal_create', 'pending', NULL, ?)`,
    [meal.operationId, Date.now()],
  );

  let timelineEntryId: number | null = null;

  try {
    await db.withTransactionAsync(async () => {
      const existing = await readOperation(db, meal.operationId!);

      if (existing?.status === "committed" && existing.result_id) {
        timelineEntryId = Number(existing.result_id);
        return;
      }

      const now = Date.now();
      const timelineResult = await db.runAsync(
        `INSERT INTO timeline_entries (
          kind,
          title,
          start_at,
          end_at,
          status,
          notes,
          created_at,
          updated_at
        ) VALUES ('meal', ?, ?, NULL, ?, NULL, ?, ?)`,
        [
          validatedMeal.title,
          validatedMeal.loggedAt,
          validatedMeal.status,
          now,
          now,
        ],
      );

      timelineEntryId = timelineResult.lastInsertRowId;

      await db.runAsync(
        `INSERT INTO meal_logs (
          timeline_entry_id,
          operation_id,
          saved_meal_id
        ) VALUES (?, ?, ?)`,
        [timelineEntryId, meal.operationId, validatedMeal.savedMealId],
      );

      for (const item of validatedMeal.items) {
        await insertMealItem(db, timelineEntryId, item);
      }

      await db.runAsync(
        `UPDATE nutrition_operations
         SET status = 'committed', result_id = ?
         WHERE operation_id = ?`,
        [String(timelineEntryId), meal.operationId],
      );
    });
  } catch (error) {
    const existing = await readOperation(db, meal.operationId);

    if (existing?.status === "committed" && existing.result_id) {
      return Number(existing.result_id);
    }

    throw error;
  }

  if (timelineEntryId === null) {
    throw new Error("Meal could not be created");
  }

  return timelineEntryId;
}

export async function updateMealLog(
  db: SQLiteDatabase,
  timelineEntryId: number,
  meal: NewMealLog,
) {
  if (!Number.isInteger(timelineEntryId) || timelineEntryId <= 0) {
    throw new Error("Invalid meal log");
  }

  const validatedMeal = validateMealLog(meal);

  await db.withTransactionAsync(async () => {
    const existingMeal = await db.getFirstAsync<{ id: number }>(
      `SELECT timeline_entries.id AS id
       FROM timeline_entries
       INNER JOIN meal_logs
         ON meal_logs.timeline_entry_id = timeline_entries.id
       WHERE timeline_entries.id = ?
         AND timeline_entries.kind = 'meal'`,
      [timelineEntryId],
    );

    if (!existingMeal) {
      throw new Error("Meal log not found");
    }

    await db.runAsync(
      `UPDATE timeline_entries
       SET title = ?, start_at = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        validatedMeal.title,
        validatedMeal.loggedAt,
        validatedMeal.status,
        Date.now(),
        timelineEntryId,
      ],
    );

    await db.runAsync(
      `UPDATE meal_logs
       SET saved_meal_id = ?
       WHERE timeline_entry_id = ?`,
      [validatedMeal.savedMealId, timelineEntryId],
    );

    await db.runAsync(
      `DELETE FROM meal_items
       WHERE meal_timeline_entry_id = ?`,
      [timelineEntryId],
    );

    for (const item of validatedMeal.items) {
      await insertMealItem(db, timelineEntryId, item);
    }
  });
}

export async function deleteMealLog(db: SQLiteDatabase, timelineEntryId: number) {
  if (!Number.isInteger(timelineEntryId) || timelineEntryId <= 0) {
    throw new Error("Invalid meal log");
  }

  const result = await db.runAsync(
    `DELETE FROM timeline_entries
     WHERE id = ?
       AND kind = 'meal'
       AND EXISTS (
         SELECT 1
         FROM meal_logs
         WHERE meal_logs.timeline_entry_id = timeline_entries.id
       )`,
    [timelineEntryId],
  );

  if (result.changes !== 1) {
    throw new Error("Meal log not found");
  }
}

async function insertMealItem(
  db: SQLiteDatabase,
  timelineEntryId: number,
  item: NewMealItem,
) {
  const reference = item.storagePolicy === "reference";

  await db.runAsync(
    `INSERT INTO meal_items (
      meal_timeline_entry_id,
      source,
      external_id,
      serving_id,
      food_description,
      brand_name,
      quantity,
      serving_amount,
      serving_unit,
      serving_description,
      storage_policy,
      energy_kcal_per_serving,
      protein_g_per_serving,
      carbohydrates_g_per_serving,
      fat_g_per_serving,
      extra_nutrients_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timelineEntryId,
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

function validateMealLog(meal: NewMealLog) {
  const title = meal.title.trim();

  if (!title) {
    throw new Error("Meal title is required");
  }

  if (!Number.isFinite(meal.loggedAt)) {
    throw new Error("Invalid meal time");
  }

  if (!Array.isArray(meal.items) || meal.items.length === 0) {
    throw new Error("Add at least one food");
  }

  return {
    title,
    loggedAt: meal.loggedAt,
    status: getMealStatus(meal.loggedAt),
    savedMealId: meal.savedMealId,
    items: meal.items.map(validateMealItem),
  };
}

function validateMealItem(item: NewMealItem): NewMealItem {
  if (!FOOD_SOURCES.has(item.food.source) || item.food.externalId.trim().length === 0) {
    throw new Error("Invalid food");
  }

  if (item.servingId.trim().length === 0) {
    throw new Error("Invalid serving");
  }

  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error("Food quantity must be greater than zero");
  }

  if (item.storagePolicy === "reference") {
    return {
      ...item,
      food: {
        source: item.food.source,
        externalId: item.food.externalId.trim(),
      },
      servingId: item.servingId.trim(),
      description: null,
      brandName: null,
      servingAmount: null,
      servingUnit: null,
      servingDescription: null,
      nutrientsPerServing: emptyNutrientSnapshot(),
      extrasPerServing: [],
      storagePolicy: "reference",
    };
  }

  const description = item.description?.trim() ?? "";
  const servingDescription = item.servingDescription?.trim() ?? "";

  if (!description || !servingDescription) {
    throw new Error("Food description is required");
  }

  if (
    item.servingAmount === null ||
    !Number.isFinite(item.servingAmount) ||
    item.servingAmount <= 0 ||
    item.servingUnit === null ||
    !isFoodUnit(item.servingUnit)
  ) {
    throw new Error("Invalid serving amount");
  }

  const nutrients = validateSnapshot(item.nutrientsPerServing);

  if (
    nutrients.energyKcal === null &&
    nutrients.proteinG === null &&
    nutrients.carbohydratesG === null &&
    nutrients.fatG === null
  ) {
    throw new Error("Food has no usable nutrition data");
  }

  return {
    ...item,
    food: {
      source: item.food.source,
      externalId: item.food.externalId.trim(),
    },
    servingId: item.servingId.trim(),
    description,
    brandName: item.brandName?.trim() || null,
    servingDescription,
    nutrientsPerServing: nutrients,
    extrasPerServing: item.extrasPerServing.filter(
      (extra) => extra.amount !== null && extra.amount >= 0,
    ),
    storagePolicy: "snapshot",
  };
}

function validateSnapshot(nutrients: NutrientSnapshot): NutrientSnapshot {
  const snapshot = emptyNutrientSnapshot();

  for (const key of ["energyKcal", "proteinG", "carbohydratesG", "fatG"] as const) {
    const value = nutrients[key];

    if (value === null) {
      continue;
    }

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Invalid nutrient value");
    }

    snapshot[key] = value;
  }

  return snapshot;
}

async function readOperation(db: SQLiteDatabase, operationId: string | null) {
  if (!operationId) {
    return null;
  }

  return db.getFirstAsync<OperationRow>(
    `SELECT status, result_id
     FROM nutrition_operations
     WHERE operation_id = ?`,
    [operationId],
  );
}

function getMealStatus(loggedAt: number): "planned" | "completed" {
  return loggedAt > Date.now() ? "planned" : "completed";
}

function validateDayBounds(dayStart: number, dayEnd: number) {
  if (
    !Number.isFinite(dayStart) ||
    !Number.isFinite(dayEnd) ||
    dayEnd <= dayStart
  ) {
    throw new Error("Invalid day");
  }
}

function convertMealItemRow(row: MealRow): StoredMealItem | null {
  if (
    row.item_id === null ||
    row.source === null ||
    !FOOD_SOURCES.has(row.source) ||
    row.external_id === null ||
    row.serving_id === null ||
    row.quantity === null ||
    row.storage_policy === null
  ) {
    return null;
  }

  const reference = row.storage_policy === "reference";
  const servingUnit =
    row.serving_unit !== null && isFoodUnit(row.serving_unit)
      ? row.serving_unit
      : null;

  return {
    id: row.item_id,
    mealTimelineEntryId: row.timeline_entry_id,
    food: { source: row.source, externalId: row.external_id },
    servingId: row.serving_id,
    description: reference ? null : row.food_description,
    brandName: reference ? null : row.brand_name,
    quantity: row.quantity,
    servingAmount: reference ? null : row.serving_amount,
    servingUnit: reference ? null : servingUnit,
    servingDescription: reference ? null : row.serving_description,
    nutrientsPerServing: reference
      ? emptyNutrientSnapshot()
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
