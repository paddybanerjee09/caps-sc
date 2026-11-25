import { scaleExtras, scaleSnapshot } from "./calculations";
import type { CatalogFood, CatalogServing } from "../types/nutrition";

const DERIVED_PREFIX = "caps:unit:";

const MASS_OPTIONS = [
  { id: "g", label: "1 g", amount: 1 },
  { id: "100g", label: "100 g", amount: 100 },
  { id: "kg", label: "1 kg", amount: 1000 },
  { id: "oz", label: "1 oz", amount: 28.349523125 },
  { id: "lb", label: "1 lb", amount: 453.59237 },
] as const;

// Resolve historical favourites/reference records, but do not offer this unit.
const LEGACY_MILLIGRAM = { id: "mg", label: "1 mg", amount: 0.001 } as const;

const VOLUME_OPTIONS = [
  { id: "ml", label: "1 mL", amount: 1 },
  { id: "l", label: "1 L", amount: 1000 },
  { id: "tsp", label: "1 US tsp", amount: 4.92892159375 },
  { id: "tbsp", label: "1 US tbsp", amount: 14.78676478125 },
  { id: "cup", label: "1 US cup", amount: 236.5882365 },
  { id: "fl-oz", label: "1 US fl oz", amount: 29.5735295625 },
] as const;

function metricBasis(serving: CatalogServing) {
  if (!Number.isFinite(serving.amount) || serving.amount <= 0) {
    return null;
  }

  if (serving.unit === "g" || serving.unit === "ml") {
    return { amount: serving.amount, unit: serving.unit };
  }

  if (serving.unit === "tsp" || serving.unit === "tbsp") {
    const millilitres = serving.unit === "tsp" ? 4.92892159375 : 14.78676478125;
    return { amount: serving.amount * millilitres, unit: "ml" as const };
  }

  return null;
}

/** Convert the configured physical portion when both serving dimensions are known. */
export function convertServingQuantity(
  quantity: number,
  from: CatalogServing,
  to: CatalogServing,
) {
  const fromBasis = metricBasis(from);
  const toBasis = metricBasis(to);
  if (
    !Number.isFinite(quantity) || quantity <= 0 ||
    !fromBasis || !toBasis || fromBasis.unit !== toBasis.unit
  ) {
    return quantity;
  }

  return quantity * fromBasis.amount / toBasis.amount;
}

/** Hide retired/identical display choices; retain every original serving for history. */
export function servingUnitOptions(food: CatalogFood, preferredId = food.defaultServingId) {
  const choices = new Map<string, CatalogServing>();
  for (const serving of food.servings) {
    if (isRetiredUnit(serving)) continue;
    const key = JSON.stringify([
      serving.label.normalize("NFKC").replace(/\s+/g, "").toLowerCase(),
      serving.amount,
      serving.unit,
      Object.entries(serving.nutrients).sort(([left], [right]) => left.localeCompare(right)),
      serving.extras,
    ]);
    const existing = choices.get(key);
    if (!existing || serving.id === preferredId ||
      (existing.id !== preferredId && serving.id === food.defaultServingId)) {
      choices.set(key, serving);
    }
  }
  return [...choices.values()];
}

function isRetiredUnit(serving: CatalogServing) {
  return serving.id === `${DERIVED_PREFIX}mg` ||
    /^\s*\d+(?:[.,]\d+)?\s*(?:mg|milligrams?)\s*$/i.test(serving.label);
}

function isReferenceBasis(serving: CatalogServing) {
  return (serving.unit === "g" || serving.unit === "ml") &&
    (serving.amount === 1 || serving.amount === 100) &&
    /^\s*(?:1|100)\s*(?:g|grams?|ml|millilit(?:er|re)s?)\s*$/i.test(serving.label);
}

function isMeasurementPortion(serving: CatalogServing) {
  // A plain conversion is not evidence of a regular household portion.
  // Normalize common numeric typography without guessing translated food names.
  const label = serving.label.normalize("NFKC").replace(/\u2044/g, "/").trim();
  const quantity = "(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?)";
  const unit = "(?:mg|milligrams?|g|grams?|grammes?|kg|kilograms?|oz|ounces?|lb|lbs|pounds?|ml|millilit(?:er|re)s?|cl|centilit(?:er|re)s?|dl|decilit(?:er|re)s?|l|lit(?:er|re)s?|fl\\.?\\s*oz|fluid\\s+ounces?)\\.?";
  const measure = `(?:${quantity}\\s*)?(?:US\\s+)?${unit}`;
  return new RegExp(`^(?:per\\s+)?${measure}(?:\\s*\\(${measure}\\))?$`, "i").test(label);
}

/** Keep provider portions and add only conversions supported by a known dimension. */
export function withServingUnits(food: CatalogFood): CatalogFood {
  const originals = food.servings.filter((serving) => !serving.id.startsWith(DERIVED_PREFIX));
  const sourceServings = originals.length > 0 ? originals : food.servings;
  const preferred = food.servings.find((serving) => serving.id === food.defaultServingId);
  const ordered = preferred
    ? [preferred, ...sourceServings.filter((serving) => serving !== preferred)]
    : sourceServings;
  const existingServings = new Map(food.servings.map((serving) => [serving.id, serving]));
  const derived: CatalogServing[] = [];

  for (const unit of ["g", "ml"] as const) {
    const source = food.servings.find((serving) => serving.id === `${DERIVED_PREFIX}${unit}`)
      ?? ordered.find((serving) => metricBasis(serving)?.unit === unit);
    const basis = source ? metricBasis(source) : null;

    if (!source || !basis) {
      continue;
    }

    for (const option of unit === "g" ? [...MASS_OPTIONS, LEGACY_MILLIGRAM] : VOLUME_OPTIONS) {
      const existing = existingServings.get(`${DERIVED_PREFIX}${option.id}`);
      if (existing?.unit === unit && existing.amount === option.amount) {
        derived.push(existing);
        continue;
      }
      const multiplier = option.amount / basis.amount;
      derived.push({
        id: `${DERIVED_PREFIX}${option.id}`,
        label: option.label,
        amount: option.amount,
        unit,
        nutrients: scaleSnapshot(source.nutrients, multiplier),
        extras: scaleExtras(source.extras, multiplier),
      });
    }
  }

  const preferredOriginal = originals.find((serving) => serving.id === food.defaultServingId);
  const regularServing = preferredOriginal && !isRetiredUnit(preferredOriginal) && (food.ref.source === "custom" || !isReferenceBasis(preferredOriginal))
    ? preferredOriginal
    : originals.find((serving) => !isRetiredUnit(serving) &&
      (food.ref.source === "custom" || !isMeasurementPortion(serving)));
  const massFallback = derived.find((serving) => serving.id === `${DERIVED_PREFIX}100g`);
  const volumeFallback = derived.find((serving) => serving.id === `${DERIVED_PREFIX}ml`);
  const defaultServingId = regularServing?.id ?? massFallback?.id ?? volumeFallback?.id ?? food.defaultServingId;

  return {
    ...food,
    defaultServingId,
    servings: [...derived, ...originals],
  };
}
