import type { UnitSystem } from "../state/AppStateContext";
import { parseDecimalInput } from "./numericInput";

const poundsPerKilogram = 2.20462;

export function convertWeightToKilograms(
  weight: number,
  unit: UnitSystem,
) {
  return unit === "metric" ? weight : weight / poundsPerKilogram;
}

export function convertKilogramsToWeight(
  weightKg: number,
  unit: UnitSystem,
) {
  return unit === "metric" ? weightKg : weightKg * poundsPerKilogram;
}

/** Preserve canonical precision when the rounded prefill is left unchanged. */
export function weightInputToKilograms(text: string, unit: UnitSystem, originalKg: number | null) {
  const value = parseDecimalInput(text);
  if (value === null || value <= 0) return null;
  if (originalKg !== null && value === Math.round(convertKilogramsToWeight(originalKg, unit) * 10) / 10) return originalKg;
  return convertWeightToKilograms(value, unit);
}

export function formatWeight(weightKg: number | null, unit: UnitSystem) {
  if (weightKg === null) {
    return "--";
  }

  return unit === "metric"
    ? `${weightKg.toFixed(1)}kg`
    : `${(weightKg * poundsPerKilogram).toFixed(1)}lbs`;
}
