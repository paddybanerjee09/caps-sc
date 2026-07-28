export type NutrientSnapshot = {
  energyKcal: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
};

export type NutrientTotals = {
  energyKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  incomplete: Record<keyof NutrientSnapshot, boolean>;
};

export type UsdaDataType =
  | "Branded"
  | "Foundation"
  | "Survey (FNDDS)"
  | "SR Legacy";

export type NormalizedFoodSearchResult = {
  fdcId: number;
  description: string;
  brandName: string | null;
  dataType: UsdaDataType;
  nutrientsPer100Units: NutrientSnapshot;
};

export type NormalizedFoodDetails = NormalizedFoodSearchResult & {
  servingAmount: number;
  servingUnit: "g" | "ml";
  servingDescription: string;
  nutrientsPerServing: NutrientSnapshot;
};

export type DraftMealItem = NormalizedFoodDetails & {
  quantityInput: string;
};

export type NewMealItem = {
  fdcId: number;
  description: string;
  brandName: string | null;
  quantity: number;
  servingAmount: number;
  servingUnit: "g" | "ml";
  servingDescription: string;
  nutrientsPerServing: NutrientSnapshot;
};

export type StoredMealItem = NewMealItem & {
  id: number;
  mealTimelineEntryId: number;
};

export type NewMealLog = {
  title: string;
  loggedAt: number;
  items: NewMealItem[];
};

export type StoredMealLog = {
  timelineEntryId: number;
  title: string;
  loggedAt: number;
  createdAt: number;
  updatedAt: number;
  items: StoredMealItem[];
  totals: NutrientTotals;
};

export type DailyNutrientTotals = NutrientTotals;
