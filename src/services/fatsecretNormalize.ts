import type {
  CatalogFood,
  CatalogServing,
  ExtraNutrientValue,
  FoodSearchHit,
  NutrientSnapshot,
} from "../types/nutrition";
import { emptyNutrientSnapshot } from "../nutrition/calculations";
import { ProviderError } from "./providerError";

export const FATSECRET_SEARCH_METHOD = "foods.search";
export const FATSECRET_DETAILS_METHOD = "food.get.v5";

const V5_EXTRAS: { field: string; id: string; unit: string }[] = [
  { field: "sodium", id: "sodium", unit: "mg" },
  { field: "potassium", id: "potassium", unit: "mg" },
  { field: "calcium", id: "calcium", unit: "mg" },
  { field: "iron", id: "iron", unit: "mg" },
  { field: "vitamin_a", id: "vitaminA", unit: "µg" },
  { field: "vitamin_c", id: "vitaminC", unit: "mg" },
  { field: "vitamin_d", id: "vitaminD", unit: "µg" },
  { field: "fiber", id: "fiber", unit: "g" },
  { field: "sugar", id: "sugar", unit: "g" },
  { field: "added_sugars", id: "addedSugars", unit: "g" },
  { field: "cholesterol", id: "cholesterol", unit: "mg" },
  { field: "saturated_fat", id: "saturatedFat", unit: "g" },
  { field: "polyunsaturated_fat", id: "polyunsaturatedFat", unit: "g" },
  { field: "monounsaturated_fat", id: "monounsaturatedFat", unit: "g" },
  { field: "trans_fat", id: "transFat", unit: "g" },
];

export function normalizeFatSecretSearch(payload: unknown): FoodSearchHit[] {
  const foods = asRecord(payload)?.foods;
  const foodRecord = asRecord(foods);
  assertNoFatSecretError(payload);
  const hits = asArray(foodRecord?.food).flatMap((entry) => {
    const food = asRecord(entry);

    if (!food) {
      return [];
    }

    const externalId = identifier(food.food_id);

    if (!externalId) {
      return [];
    }

    const name = text(food.food_name) ?? "Food";
    const preview = parsePreview(text(food.food_description));

    return [
      {
        ref: { source: "fatsecret" as const, externalId },
        name,
        brandName: text(food.brand_name),
        previewLabel: preview?.basisLabel ?? null,
        preview: preview?.nutrients ?? null,
      },
    ];
  });

  const seen = new Set<string>();

  return hits
    .filter((hit) => {
      if (seen.has(hit.ref.externalId)) {
        return false;
      }

      seen.add(hit.ref.externalId);
      return true;
    })
    .slice(0, 50);
}

export function normalizeFatSecretFood(payload: unknown): CatalogFood {
  assertNoFatSecretError(payload);
  const food = asRecord(asRecord(payload)?.food);

  if (!food) {
    throw new ProviderError("invalid-response", "Food details were incomplete");
  }

  const externalId = identifier(food.food_id);

  if (!externalId) {
    throw new ProviderError("invalid-response", "Food details were incomplete");
  }

  const servings = asArray(asRecord(food.servings)?.serving).flatMap((entry) => {
    const serving = normalizeServing(entry);
    return serving ? [serving] : [];
  });

  if (servings.length === 0) {
    throw new ProviderError("invalid-response", "This food has no servings");
  }

  const defaultServing =
    servings.find((serving) => serving.id === preferredDefaultId(food)) ??
    servings[0];

  return {
    ref: { source: "fatsecret", externalId },
    name: text(food.food_name) ?? "Food",
    brandName: text(food.brand_name),
    storagePolicy: "reference",
    attribution: "fatsecret",
    servings,
    defaultServingId: defaultServing.id,
  };
}

function preferredDefaultId(food: Record<string, unknown>) {
  const servings = asArray(asRecord(food.servings)?.serving);

  for (const entry of servings) {
    const serving = asRecord(entry);

    if (serving && String(serving.is_default) === "1") {
      return identifier(serving.serving_id);
    }
  }

  return null;
}

function normalizeServing(value: unknown): CatalogServing | null {
  const serving = asRecord(value);

  if (!serving) {
    return null;
  }

  const id = identifier(serving.serving_id);

  if (id === null) {
    return null;
  }

  const label = text(serving.serving_description) ?? "1 serving";
  const metricUnit = text(serving.metric_serving_unit)?.toLowerCase() ?? "";
  const metricAmount = nonNegative(serving.metric_serving_amount);
  const measurement = text(serving.measurement_description)?.toLowerCase() ?? "";
  const metricServing =
    (metricUnit === "g" || metricUnit === "ml") &&
    metricAmount !== null &&
    metricAmount > 0 &&
    (measurement === "g" || measurement === "ml" || measurement === metricUnit);
  const numberOfUnits = nonNegative(serving.number_of_units);

  return {
    id,
    label,
    amount: metricServing ? metricAmount : numberOfUnits && numberOfUnits > 0 ? numberOfUnits : 1,
    unit: metricServing ? metricUnit : "serving",
    nutrients: {
      energyKcal: nonNegative(serving.calories),
      proteinG: nonNegative(serving.protein),
      carbohydratesG: nonNegative(serving.carbohydrate),
      fatG: nonNegative(serving.fat),
    },
    extras: readV5Extras(serving),
  };
}

function readV5Extras(serving: Record<string, unknown>): ExtraNutrientValue[] {
  const extras: ExtraNutrientValue[] = [];

  for (const field of V5_EXTRAS) {
    if (!Object.prototype.hasOwnProperty.call(serving, field.field)) {
      continue;
    }

    const amount = nonNegative(serving[field.field]);

    if (amount === null) {
      continue;
    }

    extras.push({ id: field.id, amount, unit: field.unit });
  }

  return extras;
}

function parsePreview(description: string | null) {
  if (!description) {
    return null;
  }

  const match =
    /^Per\s+(.+?)\s+-\s+Calories:\s*([0-9.]+)kcal\s*\|\s*Fat:\s*([0-9.]+)g\s*\|\s*Carbs:\s*([0-9.]+)g\s*\|\s*Protein:\s*([0-9.]+)g/i.exec(
      description,
    );

  if (!match) {
    return null;
  }

  const nutrients: NutrientSnapshot = {
    ...emptyNutrientSnapshot(),
    energyKcal: Number(match[2]),
    fatG: Number(match[3]),
    carbohydratesG: Number(match[4]),
    proteinG: Number(match[5]),
  };

  return {
    basisLabel: `Per ${match[1]}`,
    nutrients,
  };
}

function assertNoFatSecretError(payload: unknown) {
  const error = asRecord(asRecord(payload)?.error);

  if (!error) {
    return;
  }

  const code = Number(error.code);

  if (code === 13 || code === 14) {
    throw new ProviderError("not-configured", "FatSecret rejected the request");
  }

  throw new ProviderError("invalid-response", "FatSecret returned an error");
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function identifier(value: unknown) {
  const raw = text(value);
  return raw && raw.length > 0 ? raw : null;
}

function nonNegative(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}
