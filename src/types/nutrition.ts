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

export type ServingUnit = "g" | "ml";

export type ServingOptionSource =
  | "branded"
  | "usda-portion"
  | "derived-mass"
  | "fallback"
  | "stored";

export type ServingOption = {
  id: string;
  label: string;
  amount: number;
  unit: ServingUnit;
  source: ServingOptionSource;
};

export type NutrientBasis = {
  amount: 100;
  unit: ServingUnit;
  nutrients: NutrientSnapshot;
};

export type FoodSearchPreview = {
  basisLabel: string;
  nutrients: NutrientSnapshot;
};

export type NutrientTargets = {
  energyKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
};

export type NormalizedFoodSearchResult = {
  fdcId: number;
  description: string;
  brandName: string | null;
  dataType: UsdaDataType;
  preview: FoodSearchPreview;
};

export type NormalizedFoodDetails = NormalizedFoodSearchResult & {
  nutrientBasis: NutrientBasis;
  servingOptions: ServingOption[];
  defaultServingOptionId: string;
};

export type NewMealItem = {
  fdcId: number;
  description: string;
  brandName: string | null;
  quantity: number;
  servingAmount: number;
  servingUnit: ServingUnit;
  servingDescription: string;
  nutrientsPerServing: NutrientSnapshot;
};

export type DraftMealItem = Omit<NewMealItem, "quantity"> & {
  quantityInput: string;
  nutrientBasis?: NutrientBasis;
  servingOptions?: ServingOption[];
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
