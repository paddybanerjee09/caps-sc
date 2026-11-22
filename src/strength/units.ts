import type { UnitSystem } from "../state/AppStateContext";
import {
  convertKilogramsToWeight,
  convertWeightToKilograms,
} from "../utils/weight";
import type { LoadMode } from "./types";

const metricPresetsKg = [20, 40, 60, 80, 100, 140];
const imperialPresetsLb = [45, 95, 135, 185, 225, 315];

export function loadStep(unit: UnitSystem, coarse: boolean) {
  if (unit === "metric") {
    return coarse ? 10 : 2.5;
  }
  return coarse ? 10 : 5;
}

export function loadPresetsKg(unit: UnitSystem) {
  if (unit === "metric") {
    return metricPresetsKg;
  }
  return imperialPresetsLb.map((pounds) =>
    convertWeightToKilograms(pounds, "imperial"),
  );
}

export function formatLoadAmount(loadKg: number, unit: UnitSystem) {
  const amount = convertKilogramsToWeight(loadKg, unit);
  const rounded = Math.round(amount * 10) / 10;
  const text = rounded.toFixed(1);
  return unit === "metric" ? `${text} kg` : `${text} lb`;
}

export function formatSetLoad(
  mode: LoadMode,
  loadKg: number | null,
  assistanceKg: number | null,
  unit: UnitSystem,
) {
  if (mode === "bodyweight") {
    if (loadKg == null || loadKg === 0) {
      return "BW";
    }
    return `BW+${formatLoadAmount(loadKg, unit)}`;
  }
  if (mode === "assisted") {
    if (assistanceKg == null || assistanceKg <= 0) {
      return "Assist";
    }
    return `Assist ${formatLoadAmount(assistanceKg, unit)}`;
  }
  if (loadKg == null || loadKg <= 0) {
    return "--";
  }
  return formatLoadAmount(loadKg, unit);
}

export function adjustLoadKg(
  currentKg: number | null,
  direction: -1 | 1,
  coarse: boolean,
  unit: UnitSystem,
) {
  const step = loadStep(unit, coarse);
  const current =
    currentKg == null ? 0 : convertKilogramsToWeight(currentKg, unit);
  const next = Math.round((current + direction * step) * 1000) / 1000;
  if (next <= 0) {
    return null;
  }
  return convertWeightToKilograms(next, unit);
}

export function formatRestSeconds(restSeconds: number | null) {
  if (restSeconds == null) {
    return "--";
  }
  if (restSeconds === 0) {
    return "0s";
  }
  const minutes = Math.floor(restSeconds / 60);
  const remain = restSeconds % 60;
  if (minutes === 0) {
    return `${remain}s`;
  }
  if (remain === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remain}s`;
}

export function formatRpe(rpe: number | null) {
  if (rpe == null) {
    return "--";
  }
  return String(rpe);
}
