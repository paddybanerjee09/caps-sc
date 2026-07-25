import type { UnitSystem } from "../state/AppStateContext";

const poundsPerKilogram = 2.20462;

export function convertWeightToKilograms(
  weight: number,
  unit: UnitSystem,
) {
  return unit === "metric" ? weight : weight / poundsPerKilogram;
}

export function formatWeight(weightKg: number | null, unit: UnitSystem) {
  if (weightKg === null) {
    return "Not selected";
  }

  return unit === "metric"
    ? `${weightKg.toFixed(1)}kg`
    : `${(weightKg * poundsPerKilogram).toFixed(1)}lbs`;
}
