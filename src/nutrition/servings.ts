import { scaleExtras, scaleSnapshot } from "./calculations";
import type { CatalogFood, CatalogServing } from "../types/nutrition";

const DERIVED_PREFIX = "caps:unit:";

const MASS_OPTIONS = [
  { id: "g", label: "1 g", amount: 1 },
  { id: "mg", label: "1 mg", amount: 0.001 },
  { id: "kg", label: "1 kg", amount: 1000 },
  { id: "oz", label: "1 oz", amount: 28.349523125 },
  { id: "lb", label: "1 lb", amount: 453.59237 },
] as const;

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

    for (const option of unit === "g" ? MASS_OPTIONS : VOLUME_OPTIONS) {
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

  const preferredUnit = preferred ? metricBasis(preferred)?.unit : null;
  const defaultServingId = preferredUnit
    ? `${DERIVED_PREFIX}${preferredUnit}`
    : derived[0]?.id ?? food.defaultServingId;

  return {
    ...food,
    defaultServingId,
    servings: [...derived, ...originals],
  };
}
