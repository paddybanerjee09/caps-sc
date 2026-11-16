import type { UnitSystem } from "../state/AppStateContext";

const centimetersPerInch = 2.54;

export function centimetersToImperial(heightCm: number) {
  const totalInches = Math.round(heightCm / centimetersPerInch);

  return {
    feet: Math.floor(totalInches / 12),
    inches: totalInches % 12,
  };
}

export function inchesToHeightCm(totalInches: number) {
  return Math.round(totalInches * centimetersPerInch * 10) / 10;
}

export function formatHeight(heightCm: number | null, unit: UnitSystem) {
  if (heightCm === null) {
    return "Not selected";
  }

  if (unit === "metric") {
    return `${Math.round(heightCm)} cm`;
  }

  const { feet, inches } = centimetersToImperial(heightCm);
  return `${feet}'${inches}"`;
}
