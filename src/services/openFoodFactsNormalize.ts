import { normalizeBarcode, convertAmount } from "../nutrition/calculations";
import type {
  CatalogFood,
  CatalogServing,
  ExtraNutrientValue,
  NutrientSnapshot,
} from "../types/nutrition";
import { ProviderError } from "./providerError";

const OFF_EXTRAS: { key: string; id: string; fromUnit: string; unit: string }[] = [
  { key: "sodium", id: "sodium", fromUnit: "g", unit: "mg" },
  { key: "potassium", id: "potassium", fromUnit: "g", unit: "mg" },
  { key: "calcium", id: "calcium", fromUnit: "g", unit: "mg" },
  { key: "iron", id: "iron", fromUnit: "g", unit: "mg" },
  { key: "vitamin-a", id: "vitaminA", fromUnit: "g", unit: "µg" },
  { key: "vitamin-c", id: "vitaminC", fromUnit: "g", unit: "mg" },
  { key: "vitamin-d", id: "vitaminD", fromUnit: "g", unit: "µg" },
  { key: "fiber", id: "fiber", fromUnit: "g", unit: "g" },
  { key: "sugars", id: "sugar", fromUnit: "g", unit: "g" },
  { key: "added-sugars", id: "addedSugars", fromUnit: "g", unit: "g" },
  { key: "cholesterol", id: "cholesterol", fromUnit: "g", unit: "mg" },
  { key: "saturated-fat", id: "saturatedFat", fromUnit: "g", unit: "g" },
  { key: "polyunsaturated-fat", id: "polyunsaturatedFat", fromUnit: "g", unit: "g" },
  { key: "monounsaturated-fat", id: "monounsaturatedFat", fromUnit: "g", unit: "g" },
  { key: "trans-fat", id: "transFat", fromUnit: "g", unit: "g" },
];

export function normalizeOpenFoodFactsProduct(
  payload: unknown,
  requestedBarcode: string,
): CatalogFood {
  const barcode = normalizeBarcode(requestedBarcode);

  if (!barcode) {
    throw new ProviderError("invalid-code", "Invalid barcode");
  }

  const record = asRecord(payload);

  if (!record || Number(record.status) === 0 || !asRecord(record.product)) {
    throw new ProviderError("not-found", "Product not found");
  }

  const product = asRecord(record.product)!;
  const code = text(product.code) ?? barcode;
  const nutriments = asRecord(product.nutriments) ?? {};
  const per100 = servingFromBasis(nutriments, "100g", "100 g", 100, "g");
  const perServing = servingFromProduct(product, nutriments);
  const servings = [per100, perServing].filter(
    (serving): serving is CatalogServing => serving !== null,
  );

  if (servings.length === 0) {
    servings.push({
      id: "unknown",
      label: "1 serving",
      amount: 1,
      unit: "serving",
      nutrients: emptyMacros(),
      extras: [],
    });
  }

  return {
    ref: { source: "openfoodfacts", externalId: code },
    name: text(product.product_name) ?? text(product.product_name_en) ?? "Unnamed product",
    brandName: text(product.brands)?.split(",")[0]?.trim() || null,
    storagePolicy: "snapshot",
    attribution: "Open Food Facts",
    servings,
    defaultServingId: perServing?.id ?? servings[0].id,
  };
}

function servingFromProduct(
  product: Record<string, unknown>,
  nutriments: Record<string, unknown>,
): CatalogServing | null {
  const nutrients = readMacros(nutriments, "serving");
  const extras = readExtras(nutriments, "serving");
  const hasData = hasAnyNutrient(nutrients, extras);

  if (!hasData) {
    return null;
  }

  const label = text(product.serving_size) ?? "1 serving";

  return {
    id: "serving",
    label,
    amount: 1,
    unit: "serving",
    nutrients,
    extras,
  };
}

function servingFromBasis(
  nutriments: Record<string, unknown>,
  suffix: "100g",
  label: string,
  amount: number,
  unit: "g",
): CatalogServing | null {
  const nutrients = readMacros(nutriments, suffix);
  const extras = readExtras(nutriments, suffix);

  if (!hasAnyNutrient(nutrients, extras)) {
    return null;
  }

  return {
    id: suffix,
    label,
    amount,
    unit,
    nutrients,
    extras,
  };
}

function readMacros(
  nutriments: Record<string, unknown>,
  suffix: "100g" | "serving",
): NutrientSnapshot {
  const energyKcal = nonNegative(nutriments[`energy-kcal_${suffix}`]);
  const energyKj = nonNegative(nutriments[`energy-kj_${suffix}`]);
  const converted =
    energyKcal !== null
      ? energyKcal
      : energyKj === null
        ? null
        : convertAmount(energyKj, "kj", "kcal");

  return {
    energyKcal: converted,
    proteinG: nonNegative(nutriments[`proteins_${suffix}`]),
    carbohydratesG: nonNegative(nutriments[`carbohydrates_${suffix}`]),
    fatG: nonNegative(nutriments[`fat_${suffix}`]),
  };
}

function readExtras(
  nutriments: Record<string, unknown>,
  suffix: "100g" | "serving",
): ExtraNutrientValue[] {
  const extras: ExtraNutrientValue[] = [];

  for (const field of OFF_EXTRAS) {
    const raw = nonNegative(nutriments[`${field.key}_${suffix}`]);

    if (raw === null) {
      continue;
    }

    const amount = convertAmount(raw, field.fromUnit, field.unit);

    if (amount === null) {
      continue;
    }

    extras.push({ id: field.id, amount, unit: field.unit });
  }

  return extras;
}

function hasAnyNutrient(nutrients: NutrientSnapshot, extras: ExtraNutrientValue[]) {
  return (
    Object.values(nutrients).some((value) => value !== null) || extras.length > 0
  );
}

function emptyMacros(): NutrientSnapshot {
  return {
    energyKcal: null,
    proteinG: null,
    carbohydratesG: null,
    fatG: null,
  };
}

function asRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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
