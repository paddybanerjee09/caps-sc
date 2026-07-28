import type { SQLiteDatabase } from "expo-sqlite";

import type {
  NewMealItem,
  NewMealLog,
  NutrientSnapshot,
  NutrientTotals,
  StoredMealItem,
  StoredMealLog,
} from "../types/nutrition";

type MealRow = {
  timeline_entry_id: number;
  title: string;
  logged_at: number;
  created_at: number;
  updated_at: number;
  item_id: number | null;
  fdc_id: number | null;
  food_description: string | null;
  brand_name: string | null;
  quantity: number | null;
  serving_amount: number | null;
  serving_unit: "g" | "ml" | null;
  serving_description: string | null;
  energy_kcal_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbohydrates_g_per_serving: number | null;
  fat_g_per_serving: number | null;
};

type CountRow = {
  count: number;
};

type ValidatedMealLog = {
  title: string;
  loggedAt: number;
  items: NewMealItem[];
};

const NUTRIENT_KEYS = [
  "energyKcal",
  "proteinG",
  "carbohydratesG",
  "fatG",
] as const satisfies readonly (keyof NutrientSnapshot)[];

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
       meal_items.id AS item_id,
       meal_items.fdc_id,
       meal_items.food_description,
       meal_items.brand_name,
       meal_items.quantity,
       meal_items.serving_amount,
       meal_items.serving_unit,
       meal_items.serving_description,
       meal_items.energy_kcal_per_serving,
       meal_items.protein_g_per_serving,
       meal_items.carbohydrates_g_per_serving,
       meal_items.fat_g_per_serving
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        items: [],
        totals: emptyNutrientTotals(),
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

export async function createMealLog(db: SQLiteDatabase, meal: NewMealLog) {
  const validatedMeal = validateMealLog(meal);
  const now = Date.now();
  let timelineEntryId: number | null = null;

  await db.withTransactionAsync(async () => {
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
      ) VALUES ('meal', ?, ?, NULL, 'completed', NULL, ?, ?)`,
      [validatedMeal.title, validatedMeal.loggedAt, now, now],
    );

    timelineEntryId = timelineResult.lastInsertRowId;

    await db.runAsync(
      `INSERT INTO meal_logs (timeline_entry_id)
       VALUES (?)`,
      [timelineEntryId],
    );

    for (const item of validatedMeal.items) {
      await insertMealItem(db, timelineEntryId, item);
    }
  });

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
      `SELECT timeline_entries.id
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
       SET title = ?, start_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        validatedMeal.title,
        validatedMeal.loggedAt,
        Date.now(),
        timelineEntryId,
      ],
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

export function calculateNutrientTotals(
  items: readonly Pick<NewMealItem, "quantity" | "nutrientsPerServing">[],
): NutrientTotals {
  const totals = emptyNutrientTotals();

  for (const item of items) {
    const quantityIsValid = Number.isFinite(item.quantity) && item.quantity > 0;

    for (const nutrientKey of NUTRIENT_KEYS) {
      const nutrient = item.nutrientsPerServing[nutrientKey];

      if (
        !quantityIsValid ||
        nutrient === null ||
        !Number.isFinite(nutrient) ||
        nutrient < 0
      ) {
        totals.incomplete[nutrientKey] = true;
        continue;
      }

      totals[nutrientKey] += nutrient * item.quantity;
    }
  }

  return totals;
}

async function insertMealItem(
  db: SQLiteDatabase,
  timelineEntryId: number,
  item: NewMealItem,
) {
  await db.runAsync(
    `INSERT INTO meal_items (
      meal_timeline_entry_id,
      fdc_id,
      food_description,
      brand_name,
      quantity,
      serving_amount,
      serving_unit,
      serving_description,
      energy_kcal_per_serving,
      protein_g_per_serving,
      carbohydrates_g_per_serving,
      fat_g_per_serving
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      timelineEntryId,
      item.fdcId,
      item.description,
      item.brandName,
      item.quantity,
      item.servingAmount,
      item.servingUnit,
      item.servingDescription,
      item.nutrientsPerServing.energyKcal,
      item.nutrientsPerServing.proteinG,
      item.nutrientsPerServing.carbohydratesG,
      item.nutrientsPerServing.fatG,
    ],
  );
}

function validateMealLog(meal: NewMealLog): ValidatedMealLog {
  const title = meal.title.trim();

  if (!title) {
    throw new Error("Meal title is required");
  }

  validateTodayLogTime(meal.loggedAt);

  if (!Array.isArray(meal.items) || meal.items.length === 0) {
    throw new Error("Add at least one food");
  }

  return {
    title,
    loggedAt: meal.loggedAt,
    items: meal.items.map(validateMealItem),
  };
}

function validateMealItem(item: NewMealItem): NewMealItem {
  const description = item.description.trim();
  const servingDescription = item.servingDescription.trim();

  if (!Number.isInteger(item.fdcId) || item.fdcId <= 0) {
    throw new Error("Invalid food");
  }

  if (!description) {
    throw new Error("Food description is required");
  }

  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new Error("Food quantity must be greater than zero");
  }

  if (!Number.isFinite(item.servingAmount) || item.servingAmount <= 0) {
    throw new Error("Invalid serving amount");
  }

  if (item.servingUnit !== "g" && item.servingUnit !== "ml") {
    throw new Error("Invalid serving unit");
  }

  if (!servingDescription) {
    throw new Error("Serving description is required");
  }

  let availableNutrientCount = 0;

  for (const nutrientKey of NUTRIENT_KEYS) {
    const nutrient = item.nutrientsPerServing[nutrientKey];

    if (nutrient === null) {
      continue;
    }

    if (!Number.isFinite(nutrient) || nutrient < 0) {
      throw new Error("Invalid nutrient value");
    }

    availableNutrientCount += 1;
  }

  if (availableNutrientCount === 0) {
    throw new Error("Food has no usable nutrition data");
  }

  return {
    ...item,
    description,
    brandName: item.brandName?.trim() || null,
    servingDescription,
  };
}

function validateTodayLogTime(loggedAt: number) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  if (
    !Number.isFinite(loggedAt) ||
    loggedAt < dayStart.getTime() ||
    loggedAt >= dayEnd.getTime()
  ) {
    throw new Error("Meal must be logged for today");
  }

  if (loggedAt > now.getTime()) {
    throw new Error("Meal time cannot be in the future");
  }
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
    row.fdc_id === null ||
    row.food_description === null ||
    row.quantity === null ||
    row.serving_amount === null ||
    row.serving_unit === null ||
    row.serving_description === null
  ) {
    return null;
  }

  return {
    id: row.item_id,
    mealTimelineEntryId: row.timeline_entry_id,
    fdcId: row.fdc_id,
    description: row.food_description,
    brandName: row.brand_name,
    quantity: row.quantity,
    servingAmount: row.serving_amount,
    servingUnit: row.serving_unit,
    servingDescription: row.serving_description,
    nutrientsPerServing: {
      energyKcal: row.energy_kcal_per_serving,
      proteinG: row.protein_g_per_serving,
      carbohydratesG: row.carbohydrates_g_per_serving,
      fatG: row.fat_g_per_serving,
    },
  };
}

function emptyNutrientTotals(): NutrientTotals {
  return {
    energyKcal: 0,
    proteinG: 0,
    carbohydratesG: 0,
    fatG: 0,
    incomplete: {
      energyKcal: false,
      proteinG: false,
      carbohydratesG: false,
      fatG: false,
    },
  };
}
