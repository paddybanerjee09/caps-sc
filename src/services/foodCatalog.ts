import type { SQLiteDatabase } from "expo-sqlite";

import { getCustomFood } from "../data/nutritionCatalogRepository";
import type { CatalogFood, CatalogServing, FoodRef } from "../types/nutrition";
import { getFatSecretFood } from "./fatsecretApi";
import { lookupOpenFoodFactsBarcode } from "./openFoodFactsApi";
import { foodIdentityKey } from "../nutrition/calculations";

const sessionFoods = new Map<string, CatalogFood>();

export function rememberCatalogFood(food: CatalogFood) {
  if (food.servings.length > 0) {
    sessionFoods.set(foodIdentityKey(food.ref), food);
  }
}

export function peekCatalogFood(ref: FoodRef) {
  return sessionFoods.get(foodIdentityKey(ref)) ?? null;
}

export function catalogFoodFromCustom(food: {
  id: string;
  name: string;
  brand: string | null;
  servingAmount: number;
  servingUnit: CatalogServing["unit"];
  energyKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  extras: CatalogServing["extras"];
}): CatalogFood {
  return {
    ref: { source: "custom", externalId: food.id },
    name: food.name,
    brandName: food.brand,
    storagePolicy: "snapshot",
    attribution: null,
    defaultServingId: "base",
    servings: [
      {
        id: "base",
        label: servingLabel(food.servingAmount, food.servingUnit),
        amount: food.servingAmount,
        unit: food.servingUnit,
        nutrients: {
          energyKcal: food.energyKcal,
          proteinG: food.proteinG,
          carbohydratesG: food.carbohydratesG,
          fatG: food.fatG,
        },
        extras: food.extras,
      },
    ],
  };
}

export async function resolveCatalogFood(
  db: SQLiteDatabase,
  ref: FoodRef,
  signal?: AbortSignal,
) {
  const cached = peekCatalogFood(ref);

  if (cached) {
    return cached;
  }

  if (ref.source === "custom") {
    const custom = await getCustomFood(db, ref.externalId);

    if (!custom) {
      return null;
    }

    const food = catalogFoodFromCustom(custom);
    rememberCatalogFood(food);
    return food;
  }

  if (ref.source === "fatsecret") {
    const food = await getFatSecretFood(ref.externalId, signal);
    rememberCatalogFood(food);
    return food;
  }

  if (ref.source === "openfoodfacts") {
    return lookupOpenFoodFactsBarcode(ref.externalId, signal);
  }

  return null;
}

function servingLabel(amount: number, unit: string) {
  const text = Number(amount.toFixed(3)).toString();
  return unit === "serving" ? `${text} serving` : `${text} ${unit}`;
}
