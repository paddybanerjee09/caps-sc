import type {
  NormalizedFoodDetails,
  NormalizedFoodSearchResult,
  NutrientSnapshot,
  UsdaDataType,
} from "../types/nutrition";

const FOOD_DATA_CENTRAL_URL = "https://api.nal.usda.gov/fdc/v1";
const SEARCH_PAGE_SIZE = 20;
const SUPPORTED_DATA_TYPES: UsdaDataType[] = [
  "Branded",
  "Foundation",
  "Survey (FNDDS)",
  "SR Legacy",
];
const DETAIL_NUTRIENT_NUMBERS = "203,204,205,208,957,958";

type UnknownRecord = Record<string, unknown>;

type NutrientCandidate = {
  id: number | null;
  number: string | null;
  unit: string;
  amount: number;
};

type Serving = {
  amount: number;
  unit: "g" | "ml";
  description: string;
};

export type FoodDataCentralErrorCode =
  | "missing-key"
  | "rate-limit"
  | "http"
  | "network"
  | "invalid-response"
  | "unavailable-serving"
  | "unavailable-nutrients";

export class FoodDataCentralError extends Error {
  constructor(
    public readonly code: FoodDataCentralErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "FoodDataCentralError";
  }
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function getString(
  record: UnknownRecord,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getFiniteNumber(
  record: UnknownRecord,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getIdentifierString(
  record: UnknownRecord,
  ...keys: string[]
): string | null {
  const stringValue = getString(record, ...keys);

  if (stringValue) {
    return stringValue;
  }

  const numberValue = getFiniteNumber(record, ...keys);
  return numberValue === null ? null : String(numberValue);
}

function getPositiveNumber(
  record: UnknownRecord,
  ...keys: string[]
): number | null {
  const value = getFiniteNumber(record, ...keys);
  return value !== null && value > 0 ? value : null;
}

function getNonNegativeNumber(
  record: UnknownRecord,
  ...keys: string[]
): number | null {
  const value = getFiniteNumber(record, ...keys);
  return value !== null && value >= 0 ? value : null;
}

function parseDataType(value: unknown): UsdaDataType | null {
  return SUPPORTED_DATA_TYPES.find((dataType) => dataType === value) ?? null;
}

function parseBrandName(record: UnknownRecord): string | null {
  return getString(record, "brandName", "brandOwner");
}

function normalizeNutrientUnit(value: string | null): string {
  return value?.trim().toLowerCase().replace(/\s+/g, "") ?? "";
}

function parseNutrientCandidate(value: unknown): NutrientCandidate | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const nutrient = asRecord(record.nutrient);
  const amount = getNonNegativeNumber(record, "amount", "value");
  const unit = normalizeNutrientUnit(
    getString(record, "unitName", "unit") ??
      (nutrient ? getString(nutrient, "unitName", "unit") : null),
  );

  if (amount === null || unit.length === 0) {
    return null;
  }

  const nestedId = nutrient ? getFiniteNumber(nutrient, "id") : null;
  const directNutrientId = getFiniteNumber(record, "nutrientId");
  const abridgedId = nutrient ? null : getFiniteNumber(record, "id");
  const rawNumber =
    getIdentifierString(record, "nutrientNumber", "number") ??
    (nutrient
      ? getIdentifierString(nutrient, "number", "nutrientNumber")
      : null);

  return {
    id: nestedId ?? directNutrientId ?? abridgedId,
    number: rawNumber,
    unit,
    amount,
  };
}

function parseNutrientCandidates(record: UnknownRecord): NutrientCandidate[] {
  if (!Array.isArray(record.foodNutrients)) {
    return [];
  }

  return record.foodNutrients
    .map(parseNutrientCandidate)
    .filter((candidate): candidate is NutrientCandidate => candidate !== null);
}

function findNutrientAmount(
  candidates: NutrientCandidate[],
  id: number,
  nutrientNumber: string,
  expectedUnit: string,
): number | null {
  const normalizedUnit = normalizeNutrientUnit(expectedUnit);
  const candidatesInExpectedUnit = candidates.filter(
    (candidate) => candidate.unit === normalizedUnit,
  );
  const idMatch = candidatesInExpectedUnit.find(
    (candidate) => candidate.id === id,
  );

  if (idMatch) {
    return idMatch.amount;
  }

  return (
    candidatesInExpectedUnit.find(
      (candidate) => candidate.number === nutrientNumber,
    )?.amount ?? null
  );
}

function findEnergy(
  candidates: NutrientCandidate[],
  dataType: UsdaDataType,
): number | null {
  const foundationPriority = [
    { id: 2047, number: "957" },
    { id: 2048, number: "958" },
    { id: 1008, number: "208" },
  ];
  const standardPriority = [
    { id: 1008, number: "208" },
    { id: 2047, number: "957" },
    { id: 2048, number: "958" },
  ];
  const priority =
    dataType === "Foundation" ? foundationPriority : standardPriority;

  for (const nutrient of priority) {
    const amount = findNutrientAmount(
      candidates,
      nutrient.id,
      nutrient.number,
      "kcal",
    );

    if (amount !== null) {
      return amount;
    }
  }

  return null;
}

function parseNutrients(
  record: UnknownRecord,
  dataType: UsdaDataType,
): NutrientSnapshot {
  const candidates = parseNutrientCandidates(record);

  return {
    energyKcal: findEnergy(candidates, dataType),
    proteinG: findNutrientAmount(candidates, 1003, "203", "g"),
    carbohydratesG: findNutrientAmount(candidates, 1005, "205", "g"),
    fatG: findNutrientAmount(candidates, 1004, "204", "g"),
  };
}

function hasAnyNutrient(nutrients: NutrientSnapshot): boolean {
  return Object.values(nutrients).some((value) => value !== null);
}

function scaleNutrients(
  nutrients: NutrientSnapshot,
  multiplier: number,
): NutrientSnapshot {
  return {
    energyKcal:
      nutrients.energyKcal === null
        ? null
        : nutrients.energyKcal * multiplier,
    proteinG:
      nutrients.proteinG === null ? null : nutrients.proteinG * multiplier,
    carbohydratesG:
      nutrients.carbohydratesG === null
        ? null
        : nutrients.carbohydratesG * multiplier,
    fatG: nutrients.fatG === null ? null : nutrients.fatG * multiplier,
  };
}

function normalizeServingUnit(value: string | null): "g" | "ml" | null {
  const unit = value?.trim().toLowerCase().replace(/[.\s]/g, "");

  if (unit === "g" || unit === "gram" || unit === "grams" || unit === "grm") {
    return "g";
  }

  if (
    unit === "ml" ||
    unit === "milliliter" ||
    unit === "milliliters" ||
    unit === "millilitre" ||
    unit === "millilitres"
  ) {
    return "ml";
  }

  return null;
}

function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function appendPhysicalBasis(
  description: string | null,
  amount: number,
  unit: "g" | "ml",
): string {
  const basis = `${formatAmount(amount)} ${unit}`;
  return description ? `${description} (${basis})` : basis;
}

function getBrandedServing(record: UnknownRecord): Serving | null {
  const amount = getPositiveNumber(record, "servingSize");
  const unit = normalizeServingUnit(getString(record, "servingSizeUnit"));

  if (amount === null || unit === null) {
    return null;
  }

  return {
    amount,
    unit,
    description: appendPhysicalBasis(
      getString(record, "householdServingFullText"),
      amount,
      unit,
    ),
  };
}

function getPortionDescription(
  portion: UnknownRecord,
  gramWeight: number,
): string {
  const providedDescription = getString(portion, "portionDescription");

  if (providedDescription) {
    return appendPhysicalBasis(providedDescription, gramWeight, "g");
  }

  const amount = getPositiveNumber(portion, "amount");
  const measureUnit = asRecord(portion.measureUnit);
  const measureName = measureUnit
    ? getString(measureUnit, "name", "abbreviation")
    : null;
  const generatedDescription =
    amount !== null && measureName
      ? `${formatAmount(amount)} ${measureName}`
      : null;

  return appendPhysicalBasis(generatedDescription, gramWeight, "g");
}

function getNonBrandedServing(record: UnknownRecord): Serving {
  const portions = Array.isArray(record.foodPortions)
    ? record.foodPortions
        .map(asRecord)
        .filter((portion): portion is UnknownRecord => portion !== null)
        .sort((left, right) => {
          const leftSequence =
            getFiniteNumber(left, "sequenceNumber") ?? Number.MAX_SAFE_INTEGER;
          const rightSequence =
            getFiniteNumber(right, "sequenceNumber") ?? Number.MAX_SAFE_INTEGER;
          return leftSequence - rightSequence;
        })
    : [];

  for (const portion of portions) {
    const gramWeight = getPositiveNumber(portion, "gramWeight");

    if (gramWeight !== null) {
      return {
        amount: gramWeight,
        unit: "g",
        description: getPortionDescription(portion, gramWeight),
      };
    }
  }

  return {
    amount: 100,
    unit: "g",
    description: "100 g",
  };
}

function parseSearchFood(value: unknown): NormalizedFoodSearchResult | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const fdcId = getFiniteNumber(record, "fdcId");
  const description = getString(record, "description");
  const dataType = parseDataType(record.dataType ?? record.datatype);

  if (
    fdcId === null ||
    !Number.isInteger(fdcId) ||
    fdcId <= 0 ||
    !description ||
    !dataType
  ) {
    return null;
  }

  return {
    fdcId,
    description,
    brandName: parseBrandName(record),
    dataType,
    nutrientsPer100Units: parseNutrients(record, dataType),
  };
}

function parseFoodDetails(value: unknown): NormalizedFoodDetails {
  const record = asRecord(value);

  if (!record) {
    throw new FoodDataCentralError(
      "invalid-response",
      "USDA returned an unexpected food response.",
    );
  }

  const searchFood = parseSearchFood(record);

  if (!searchFood) {
    throw new FoodDataCentralError(
      "invalid-response",
      "USDA returned incomplete food information.",
    );
  }

  if (!hasAnyNutrient(searchFood.nutrientsPer100Units)) {
    throw new FoodDataCentralError(
      "unavailable-nutrients",
      "This food does not include calories or macronutrients.",
    );
  }

  const serving =
    searchFood.dataType === "Branded"
      ? getBrandedServing(record)
      : getNonBrandedServing(record);

  if (!serving) {
    throw new FoodDataCentralError(
      "unavailable-serving",
      "This food does not have a usable gram or millilitre serving.",
    );
  }

  return {
    ...searchFood,
    servingAmount: serving.amount,
    servingUnit: serving.unit,
    servingDescription: serving.description,
    nutrientsPerServing: scaleNutrients(
      searchFood.nutrientsPer100Units,
      serving.amount / 100,
    ),
  };
}

function getApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_USDA_FDC_API_KEY?.trim();

  if (!apiKey || apiKey === "replace_me") {
    throw new FoodDataCentralError(
      "missing-key",
      "USDA FoodData Central API key is not configured.",
    );
  }

  return apiKey;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function requestJson(
  url: string,
  options: RequestInit,
): Promise<unknown> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 429) {
        throw new FoodDataCentralError(
          "rate-limit",
          "USDA request limit reached. Try again later.",
          response.status,
        );
      }

      throw new FoodDataCentralError(
        "http",
        "USDA could not complete the request.",
        response.status,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      throw new FoodDataCentralError(
        "invalid-response",
        "USDA returned an unreadable response.",
      );
    }
  } catch (error) {
    if (error instanceof FoodDataCentralError || isAbortError(error)) {
      throw error;
    }

    throw new FoodDataCentralError(
      "network",
      "Could not connect to USDA. Check your internet connection.",
    );
  }
}

export async function searchFoods(
  query: string,
  signal?: AbortSignal,
): Promise<NormalizedFoodSearchResult[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const apiKey = getApiKey();
  const response = await requestJson(
    `${FOOD_DATA_CENTRAL_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: trimmedQuery,
        dataType: SUPPORTED_DATA_TYPES,
        pageSize: SEARCH_PAGE_SIZE,
        pageNumber: 1,
      }),
      signal,
    },
  );
  const responseRecord = asRecord(response);

  if (!responseRecord || !Array.isArray(responseRecord.foods)) {
    throw new FoodDataCentralError(
      "invalid-response",
      "USDA returned an unexpected search response.",
    );
  }

  return responseRecord.foods
    .map(parseSearchFood)
    .filter((food): food is NormalizedFoodSearchResult => food !== null);
}

export async function getFoodDetails(
  fdcId: number,
  signal?: AbortSignal,
): Promise<NormalizedFoodDetails> {
  if (!Number.isInteger(fdcId) || fdcId <= 0) {
    throw new FoodDataCentralError(
      "invalid-response",
      "The selected USDA food ID is invalid.",
    );
  }

  const apiKey = getApiKey();
  const query = [
    `api_key=${encodeURIComponent(apiKey)}`,
    "format=full",
    `nutrients=${DETAIL_NUTRIENT_NUMBERS}`,
  ].join("&");
  const response = await requestJson(
    `${FOOD_DATA_CENTRAL_URL}/food/${fdcId}?${query}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );

  return parseFoodDetails(response);
}
