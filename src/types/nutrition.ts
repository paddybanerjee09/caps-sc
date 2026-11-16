export type NutrientSnapshot = {
  energyKcal: number | null;
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
};

export type NutrientTotals = NutrientSnapshot & {
  incomplete: Record<keyof NutrientSnapshot, boolean>;
};

export type FoodSource = "fatsecret" | "openfoodfacts" | "custom" | "usda";

export type StoragePolicy = "snapshot" | "reference";

export type FoodUnit = "g" | "ml" | "tsp" | "tbsp" | "serving";

export type FoodRef = {
  source: FoodSource;
  externalId: string;
};

export type ExtraNutrientValue = {
  id: string;
  amount: number | null;
  unit: string;
};

export type NutrientTargets = {
  energyKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
};

export type NewMealItem = {
  food: FoodRef;
  servingId: string;
  description: string | null;
  brandName: string | null;
  quantity: number;
  servingAmount: number | null;
  servingUnit: FoodUnit | null;
  servingDescription: string | null;
  nutrientsPerServing: NutrientSnapshot;
  extrasPerServing: ExtraNutrientValue[];
  storagePolicy: StoragePolicy;
};

export type StoredMealItem = NewMealItem & {
  id: number;
  mealTimelineEntryId: number;
};

export type NewMealLog = {
  operationId: string | null;
  title: string;
  loggedAt: number;
  savedMealId: string | null;
  items: NewMealItem[];
};

export type StoredMealLog = {
  timelineEntryId: number;
  title: string;
  loggedAt: number;
  status: "planned" | "completed";
  createdAt: number;
  updatedAt: number;
  operationId: string | null;
  savedMealId: string | null;
  items: StoredMealItem[];
  totals: NutrientTotals;
};

export type CatalogServing = {
  id: string;
  label: string;
  amount: number;
  unit: FoodUnit;
  nutrients: NutrientSnapshot;
  extras: ExtraNutrientValue[];
};

export type CatalogFood = {
  ref: FoodRef;
  name: string;
  brandName: string | null;
  storagePolicy: StoragePolicy;
  attribution: string | null;
  servings: CatalogServing[];
  defaultServingId: string;
};

export type FoodSearchHit = {
  ref: FoodRef;
  name: string;
  brandName: string | null;
  previewLabel: string | null;
  preview: NutrientSnapshot | null;
};
