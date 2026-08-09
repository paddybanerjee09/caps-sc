export const MAX_ELAPSED_DURATION_SECONDS = 24 * 60 * 60;
export const METERS_PER_KILOMETER = 1000;
export const METERS_PER_MILE = 1609.344;

export type ConditioningDistanceUnit = "metric" | "imperial";

export type ElapsedDurationParts = {
  hours: number;
  minutes: number;
  seconds: number;
};

export function formatElapsedDuration(valueSeconds: number | null) {
  if (
    valueSeconds === null ||
    !Number.isFinite(valueSeconds) ||
    valueSeconds < 0 ||
    valueSeconds > MAX_ELAPSED_DURATION_SECONDS
  ) {
    return "--:--:--";
  }

  const { hours, minutes, seconds } = secondsToElapsedDurationParts(valueSeconds);

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function secondsToElapsedDurationParts(
  valueSeconds: number | null,
): ElapsedDurationParts {
  const roundedSeconds =
    valueSeconds !== null &&
    Number.isFinite(valueSeconds) &&
    valueSeconds >= 0 &&
    valueSeconds <= MAX_ELAPSED_DURATION_SECONDS
      ? Math.round(valueSeconds)
      : 0;

  return {
    hours: Math.floor(roundedSeconds / 3600),
    minutes: Math.floor((roundedSeconds % 3600) / 60),
    seconds: roundedSeconds % 60,
  };
}

export function elapsedDurationPartsToSeconds(
  hoursInput: string,
  minutesInput: string,
  secondsInput: string,
  maximumSeconds = MAX_ELAPSED_DURATION_SECONDS,
) {
  if (
    !/^\d+$/.test(hoursInput) ||
    !/^\d+$/.test(minutesInput) ||
    !/^\d+$/.test(secondsInput) ||
    !Number.isFinite(maximumSeconds) ||
    maximumSeconds < 0
  ) {
    return null;
  }

  const hours = Number(hoursInput);
  const minutes = Number(minutesInput);
  const seconds = Number(secondsInput);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const effectiveMaximum = Math.min(
    Math.floor(maximumSeconds),
    MAX_ELAPSED_DURATION_SECONDS,
  );

  return totalSeconds <= effectiveMaximum ? totalSeconds : null;
}

export function convertDistanceToMeters(
  distance: number,
  unit: ConditioningDistanceUnit,
) {
  return distance * (unit === "metric" ? METERS_PER_KILOMETER : METERS_PER_MILE);
}

export function convertMetersToDistance(
  distanceMeters: number,
  unit: ConditioningDistanceUnit,
) {
  return distanceMeters / (unit === "metric" ? METERS_PER_KILOMETER : METERS_PER_MILE);
}

export function formatDistanceInput(
  distanceMeters: number | null,
  unit: ConditioningDistanceUnit,
) {
  if (
    distanceMeters === null ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0
  ) {
    return "";
  }

  return convertMetersToDistance(distanceMeters, unit)
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

export function getDistanceUnitLabel(unit: ConditioningDistanceUnit) {
  return unit === "metric" ? "km" : "mi";
}

export function calculatePaceSeconds(
  durationSeconds: number,
  distanceMeters: number,
  unit: ConditioningDistanceUnit,
) {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(distanceMeters) ||
    distanceMeters <= 0
  ) {
    return null;
  }

  const distance = convertMetersToDistance(distanceMeters, unit);
  const paceSeconds = durationSeconds / distance;

  return Number.isFinite(paceSeconds) && paceSeconds > 0
    ? Math.round(paceSeconds)
    : null;
}

export function formatPace(
  durationSeconds: number,
  distanceMeters: number,
  unit: ConditioningDistanceUnit,
) {
  const unitLabel = getDistanceUnitLabel(unit);
  const paceSeconds = calculatePaceSeconds(durationSeconds, distanceMeters, unit);

  if (paceSeconds === null) {
    return `\u2014 min/${unitLabel}`;
  }

  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")} min/${unitLabel}`;
}
