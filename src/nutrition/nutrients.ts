export type NutrientGroup = "micro" | "other";

export type NutrientDefinition = {
  id: string;
  name: string;
  unit: string;
  group: NutrientGroup;
  precision: number;
};

/**
 * Display registry for nutrients other than energy and the three main macros.
 * FatSecret food.get.v5 reports these in the units listed here. Vitamin and
 * mineral fields on the deprecated v1 endpoint are percentages and are not
 * mapped onto this registry.
 */
export const NUTRIENT_REGISTRY = [
  { id: "sodium", name: "Sodium", unit: "mg", group: "micro", precision: 0 },
  {
    id: "potassium",
    name: "Potassium",
    unit: "mg",
    group: "micro",
    precision: 0,
  },
  { id: "calcium", name: "Calcium", unit: "mg", group: "micro", precision: 0 },
  { id: "iron", name: "Iron", unit: "mg", group: "micro", precision: 2 },
  {
    id: "vitaminA",
    name: "Vitamin A",
    unit: "µg",
    group: "micro",
    precision: 0,
  },
  {
    id: "vitaminC",
    name: "Vitamin C",
    unit: "mg",
    group: "micro",
    precision: 1,
  },
  {
    id: "vitaminD",
    name: "Vitamin D",
    unit: "µg",
    group: "micro",
    precision: 1,
  },
  { id: "fiber", name: "Fibre", unit: "g", group: "other", precision: 1 },
  { id: "sugar", name: "Sugar", unit: "g", group: "other", precision: 1 },
  {
    id: "addedSugars",
    name: "Added sugars",
    unit: "g",
    group: "other",
    precision: 1,
  },
  {
    id: "cholesterol",
    name: "Cholesterol",
    unit: "mg",
    group: "other",
    precision: 0,
  },
  {
    id: "saturatedFat",
    name: "Saturated fat",
    unit: "g",
    group: "other",
    precision: 1,
  },
  {
    id: "polyunsaturatedFat",
    name: "Polyunsaturated fat",
    unit: "g",
    group: "other",
    precision: 1,
  },
  {
    id: "monounsaturatedFat",
    name: "Monounsaturated fat",
    unit: "g",
    group: "other",
    precision: 1,
  },
  {
    id: "transFat",
    name: "Trans fat",
    unit: "g",
    group: "other",
    precision: 1,
  },
] as const satisfies readonly NutrientDefinition[];

export type NutrientId = (typeof NUTRIENT_REGISTRY)[number]["id"];

const NUTRIENT_BY_ID = new Map(
  NUTRIENT_REGISTRY.map((definition) => [definition.id, definition]),
);

export function getNutrientDefinition(id: string) {
  return NUTRIENT_BY_ID.get(id as NutrientId) ?? null;
}

export function micronutrientDefinitions() {
  return NUTRIENT_REGISTRY.filter((definition) => definition.group === "micro");
}

export function otherNutrientDefinitions() {
  return NUTRIENT_REGISTRY.filter((definition) => definition.group === "other");
}
