import {
  getNutrientDefinition,
  NUTRIENT_REGISTRY,
  type NutrientId,
} from "./nutrients";
import type {
  ExtraNutrientValue,
  FoodRef,
  FoodUnit,
  NutrientSnapshot,
  NutrientTotals,
} from "../types/nutrition";

const MACRO_KEYS = [
  "energyKcal",
  "proteinG",
  "carbohydratesG",
  "fatG",
] as const satisfies readonly (keyof NutrientSnapshot)[];

const MASS_IN_GRAMS: Record<string, number> = {
  g: 1,
  mg: 0.001,
  ug: 0.000001,
  mcg: 0.000001,
  "µg": 0.000001,
};

export function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function emptyNutrientSnapshot(): NutrientSnapshot {
  return {
    energyKcal: null,
    proteinG: null,
    carbohydratesG: null,
    fatG: null,
  };
}

export function zeroNutrientTotals(): NutrientTotals {
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

export function scaleNullable(value: number | null, multiplier: number) {
  if (value === null || !Number.isFinite(value) || !Number.isFinite(multiplier)) {
    return null;
  }

  return value * multiplier;
}

export function scaleSnapshot(
  nutrients: NutrientSnapshot,
  multiplier: number,
): NutrientSnapshot {
  return {
    energyKcal: scaleNullable(nutrients.energyKcal, multiplier),
    proteinG: scaleNullable(nutrients.proteinG, multiplier),
    carbohydratesG: scaleNullable(nutrients.carbohydratesG, multiplier),
    fatG: scaleNullable(nutrients.fatG, multiplier),
  };
}

export function scaleExtras(
  extras: readonly ExtraNutrientValue[],
  multiplier: number,
): ExtraNutrientValue[] {
  return extras.map((extra) => ({
    ...extra,
    amount: scaleNullable(extra.amount, multiplier),
  }));
}

export type MacroContribution = {
  quantity: number;
  nutrientsPerServing: NutrientSnapshot;
};

export function calculateNutrientTotals(
  items: readonly MacroContribution[],
): NutrientTotals {
  if (items.length === 0) {
    return zeroNutrientTotals();
  }

  const totals = zeroNutrientTotals();
  const known = {
    energyKcal: false,
    proteinG: false,
    carbohydratesG: false,
    fatG: false,
  };

  for (const item of items) {
    const quantityIsValid = Number.isFinite(item.quantity) && item.quantity > 0;

    for (const nutrientKey of MACRO_KEYS) {
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

      totals[nutrientKey] = (totals[nutrientKey] ?? 0) + nutrient * item.quantity;
      known[nutrientKey] = true;
    }
  }

  for (const nutrientKey of MACRO_KEYS) {
    if (!known[nutrientKey]) {
      totals[nutrientKey] = null;
    }
  }

  return totals;
}

export type ExtraTotal = {
  id: NutrientId;
  name: string;
  unit: string;
  group: "micro" | "other";
  precision: number;
  amount: number | null;
  partial: boolean;
};

export function sumExtraTotals(
  items: readonly {
    quantity: number;
    extrasPerServing: readonly ExtraNutrientValue[];
  }[],
): ExtraTotal[] {
  return NUTRIENT_REGISTRY.map((definition) => {
    if (items.length === 0) {
      return {
        ...definition,
        amount: null,
        partial: false,
      };
    }

    let amount = 0;
    let known = false;
    let partial = false;

    for (const item of items) {
      const quantityIsValid = Number.isFinite(item.quantity) && item.quantity > 0;
      const match = item.extrasPerServing.find((extra) => extra.id === definition.id);

      if (
        !quantityIsValid ||
        !match ||
        match.amount === null ||
        !Number.isFinite(match.amount) ||
        match.amount < 0 ||
        match.unit !== definition.unit
      ) {
        partial = true;
        continue;
      }

      amount += match.amount * item.quantity;
      known = true;
    }

    return {
      ...definition,
      amount: known ? amount : null,
      partial: known && partial,
    };
  });
}

export function normalizeUnitToken(unit: string) {
  return unit.trim().toLowerCase().replace("µ", "u");
}

/**
 * Converts a numeric amount between compatible mass units, or kJ to kcal.
 * Volume, percentages, and unknown units return null.
 */
export function convertAmount(
  amount: number,
  fromUnit: string,
  toUnit: string,
) {
  if (!Number.isFinite(amount)) {
    return null;
  }

  const from = normalizeUnitToken(fromUnit);
  const to = normalizeUnitToken(toUnit);

  if (from === to) {
    return amount;
  }

  if (from === "kj" && to === "kcal") {
    return amount / 4.184;
  }

  const fromMass = MASS_IN_GRAMS[from];
  const toMass = MASS_IN_GRAMS[to];

  if (fromMass === undefined || toMass === undefined) {
    return null;
  }

  return (amount * fromMass) / toMass;
}

export function calorieCrossCheck(
  calories: number,
  protein: number,
  carbohydrates: number,
  fat: number,
) {
  const estimate = 4 * protein + 4 * carbohydrates + 9 * fat;
  const difference = Math.abs(estimate - calories);
  const threshold = Math.max(20, calories * 0.15);

  if (difference > threshold) {
    return { estimate };
  }

  return null;
}

export function normalizeBarcode(raw: string) {
  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  if (
    trimmed.length !== 8 &&
    trimmed.length !== 12 &&
    trimmed.length !== 13 &&
    trimmed.length !== 14
  ) {
    return null;
  }

  return trimmed;
}

export function canonicalAmount(amount: number) {
  return amount.toFixed(8).replace(/\.?0+$/, "");
}

export function favouriteConfigKey(
  food: FoodRef,
  servingId: string,
  amount: number,
) {
  return `${food.source}|${food.externalId}|${servingId}|${canonicalAmount(amount)}`;
}

export function foodIdentityKey(food: FoodRef) {
  return `${food.source}:${food.externalId}`;
}

export function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function newMealDraftKey(day: Date) {
  return `new:${formatLocalDateKey(day)}`;
}

export function editMealDraftKey(timelineEntryId: number) {
  return `edit:${timelineEntryId}`;
}

export function savedMealDraftKey(savedMealId: string) {
  return `saved:${savedMealId}`;
}

export function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function localDayBounds(date: Date) {
  const dayStart = startOfLocalDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

export function isFoodUnit(value: string): value is FoodUnit {
  return (
    value === "g" ||
    value === "ml" ||
    value === "tsp" ||
    value === "tbsp" ||
    value === "serving"
  );
}

export function formatDisplayNumber(value: number, maximumFractionDigits: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatAmount(value: number | null, precision: number, partial = false) {
  if (value === null || !Number.isFinite(value)) {
    return "\u2014";
  }

  const text = formatDisplayNumber(value, precision);
  return partial ? `${text}+` : text;
}

export function parseExtraNutrients(value: string | null): ExtraNutrientValue[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const extras: ExtraNutrientValue[] = [];

    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : "";
      const definition = getNutrientDefinition(id);
      const unit = typeof record.unit === "string" ? record.unit : "";
      const amount =
        typeof record.amount === "number" && Number.isFinite(record.amount)
          ? record.amount
          : null;

      if (!definition || unit !== definition.unit || amount === null || amount < 0) {
        continue;
      }

      extras.push({ id, amount, unit });
    }

    return extras;
  } catch {
    return [];
  }
}

export function serializeExtraNutrients(extras: readonly ExtraNutrientValue[]) {
  const stored = extras.filter(
    (extra) =>
      getNutrientDefinition(extra.id)?.unit === extra.unit &&
      extra.amount !== null &&
      Number.isFinite(extra.amount) &&
      extra.amount >= 0,
  );

  return stored.length === 0 ? null : JSON.stringify(stored);
}

export type UsageRank = {
  count: number;
  latestAt: number;
};

export function compareByUsage(
  left: { name: string; id: string; usage: UsageRank | null },
  right: { name: string; id: string; usage: UsageRank | null },
  mode: "alpha" | "recent" | "frequent",
) {
  if (mode === "frequent") {
    const countDelta = (right.usage?.count ?? 0) - (left.usage?.count ?? 0);

    if (countDelta !== 0) {
      return countDelta;
    }
  }

  if (mode === "recent") {
    const recentDelta = (right.usage?.latestAt ?? 0) - (left.usage?.latestAt ?? 0);

    if (recentDelta !== 0) {
      return recentDelta;
    }
  }

  const nameDelta = left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });

  if (nameDelta !== 0) {
    return nameDelta;
  }

  return left.id.localeCompare(right.id);
}

export function formatDerivedQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }

  return value.toFixed(8).replace(/\.?0+$/, "");
}

export function formatCalorieInput(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  return Number(value.toFixed(2)).toString();
}

export function servingTotalLabel(
  amountInput: string,
  servingAmount: number,
  servingUnit: FoodUnit,
  servingLabel: string,
) {
  const amount = Number(amountInput);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (
    (servingUnit === "g" || servingUnit === "ml") &&
    Number.isFinite(servingAmount) &&
    servingAmount > 0
  ) {
    const total = amount * servingAmount;
    return `${formatDerivedQuantity(amount)} \u00d7 ${formatDerivedQuantity(servingAmount)} ${servingUnit} = ${formatDerivedQuantity(total)} ${servingUnit}`;
  }

  return `${formatDerivedQuantity(amount)} \u00d7 ${servingLabel}`;
}
