export const METERS_PER_MILE = 1609.344;
export const METERS_PER_YARD = 0.9144;
export const METERS_PER_FOOT = 0.3048;
export const KILOGRAMS_PER_POUND = 0.45359237;
export const UNAVAILABLE_METRIC = "—";

export type MeasurementSystem = "metric" | "imperial";

export function milesToMeters(miles: number) {
  return miles * METERS_PER_MILE;
}

export function metersToMiles(meters: number) {
  return meters / METERS_PER_MILE;
}

export function yardsToMeters(yards: number) {
  return yards * METERS_PER_YARD;
}

export function metersToYards(meters: number) {
  return meters / METERS_PER_YARD;
}

export function feetToMeters(feet: number) {
  return feet * METERS_PER_FOOT;
}

export function metersToFeet(meters: number) {
  return meters / METERS_PER_FOOT;
}

export function poundsToKilograms(pounds: number) {
  return pounds * KILOGRAMS_PER_POUND;
}

export function kilogramsToPounds(kilograms: number) {
  return kilograms / KILOGRAMS_PER_POUND;
}

export function parseFiniteNumber(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return "empty" as const;
  }

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    return "invalid" as const;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : ("invalid" as const);
}

export function parsePositiveNumber(text: string) {
  const value = parseFiniteNumber(text);
  if (typeof value !== "number" || value <= 0) {
    return null;
  }

  return value;
}

export function parseNonnegativeNumber(text: string) {
  const value = parseFiniteNumber(text);
  if (value === "empty") {
    return null;
  }

  if (typeof value !== "number" || value < 0) {
    return "invalid" as const;
  }

  return value;
}

export function parsePositiveInteger(text: string) {
  const value = parseFiniteNumber(text);
  if (typeof value !== "number" || value <= 0 || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

export function parseNonnegativeInteger(text: string) {
  const value = parseFiniteNumber(text);
  if (value === "empty") {
    return null;
  }

  if (typeof value !== "number" || value < 0 || !Number.isInteger(value)) {
    return "invalid" as const;
  }

  return value;
}

export function parseOptionalRpe(text: string) {
  const value = parseFiniteNumber(text);

  if (value === "empty") {
    return { ok: true as const, value: null };
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  ) {
    return { ok: false as const, value: null };
  }

  return { ok: true as const, value };
}

export function distanceToMeters(value: number, system: MeasurementSystem, kind: "route" | "short") {
  if (system === "metric") {
    return kind === "route" ? value * 1000 : value;
  }

  return kind === "route" ? milesToMeters(value) : yardsToMeters(value);
}

export function metersToDistance(meters: number, system: MeasurementSystem, kind: "route" | "short") {
  if (system === "metric") {
    return kind === "route" ? meters / 1000 : meters;
  }

  return kind === "route" ? metersToMiles(meters) : metersToYards(meters);
}

export function elevationToMeters(value: number, system: MeasurementSystem) {
  return system === "metric" ? value : feetToMeters(value);
}

export function metersToElevation(meters: number, system: MeasurementSystem) {
  return system === "metric" ? meters : metersToFeet(meters);
}

export function loadToKilograms(value: number, system: MeasurementSystem) {
  return system === "metric" ? value : poundsToKilograms(value);
}

export function kilogramsToLoad(kilograms: number, system: MeasurementSystem) {
  return system === "metric" ? kilograms : kilogramsToPounds(kilograms);
}

export function paceSecondsPerUnit(
  activeSeconds: number,
  distanceMeters: number,
  system: MeasurementSystem,
) {
  if (!(activeSeconds >= 0) || !(distanceMeters > 0)) {
    return null;
  }

  const distance = metersToDistance(distanceMeters, system, "route");
  return distance > 0 ? activeSeconds / distance : null;
}

export function speedPerHour(
  activeSeconds: number,
  distanceMeters: number,
  system: MeasurementSystem,
) {
  if (!(activeSeconds > 0) || !(distanceMeters > 0)) {
    return null;
  }

  return metersToDistance(distanceMeters, system, "route") / (activeSeconds / 3600);
}

export function formatPace(secondsPerUnit: number | null) {
  if (secondsPerUnit === null || !Number.isFinite(secondsPerUnit)) {
    return UNAVAILABLE_METRIC;
  }

  const rounded = Math.round(secondsPerUnit);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatQuantity(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) {
    return UNAVAILABLE_METRIC;
  }

  return value.toFixed(digits);
}
