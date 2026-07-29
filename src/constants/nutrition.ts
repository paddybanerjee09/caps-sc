import { appColorPalette } from "../theme/theme";
import type {
  NutrientSnapshot,
  NutrientTargets,
} from "../types/nutrition";

export const DAILY_NUTRIENT_TARGETS = {
  energyKcal: 2500,
  proteinG: 200,
  carbohydratesG: 200,
  fatG: 100,
} as const satisfies NutrientTargets;

export const NUTRITION_COLORS = {
  energyKcal: appColorPalette.green,
  proteinG: appColorPalette.red,
  carbohydratesG: appColorPalette.blue,
  fatG: appColorPalette.yellow,
} as const satisfies Record<keyof NutrientSnapshot, string>;
