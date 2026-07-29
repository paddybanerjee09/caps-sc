import type {
  NutrientBasis,
  NormalizedFoodDetails,
  NormalizedFoodSearchResult,
  NutrientSnapshot,
  ServingOption,
  ServingUnit,
  UsdaDataType,
} from "../types/nutrition";

const FOOD_DATA_CENTRAL_URL = "https://api.nal.usda.gov/fdc/v1";
const SEARCH_PAGE_SIZE = 20;
const OUNCE_IN_GRAMS = 28.3495;
const SERVING_AMOUNT_TOLERANCE = 0.001;
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

type SearchMeasure = {
  amount: number;
  label: string;
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
  function scaleValue(value: number | null): number | null {
    if (value === null) {
      return null;
    }

    const scaledValue = value * multiplier;
    return Number.isFinite(scaledValue) && scaledValue >= 0
      ? scaledValue
      : null;
  }

  return {
    energyKcal: scaleValue(nutrients.energyKcal),
    proteinG: scaleValue(nutrients.proteinG),
    carbohydratesG: scaleValue(nutrients.carbohydratesG),
    fatG: scaleValue(nutrients.fatG),
  };
}

function normalizeServingUnit(value: string | null): ServingUnit | null {
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
  unit: ServingUnit,
): string {
  const basis = `${formatAmount(amount)} ${unit}`;

  if (!description) {
    return basis;
  }

  const physicalValuePattern =
    /(\d+(?:\.\d+)?)\s*(milliliters?|millilitres?|grams?|ml|g)\b/gi;

  for (const match of description.matchAll(physicalValuePattern)) {
    const describedAmount = Number(match[1]);
    const describedUnit = normalizeServingUnit(match[2] ?? null);
    const tolerance = Math.max(0.01, amount * 0.000001);

    if (
      Number.isFinite(describedAmount) &&
      describedUnit === unit &&
      Math.abs(describedAmount - amount) <= tolerance
    ) {
      return description;
    }
  }

  return `${description} (${basis})`;
}

function getBrandedServingOption(
  record: UnknownRecord,
): ServingOption | null {
  const amount = getPositiveNumber(record, "servingSize");
  const unit = normalizeServingUnit(getString(record, "servingSizeUnit"));

  if (amount === null || unit === null) {
    return null;
  }

  return {
    id: "branded",
    amount,
    unit,
    label: appendPhysicalBasis(
      getString(record, "householdServingFullText"),
      amount,
      unit,
    ),
    source: "branded",
  };
}

function getMeaningfulText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "undetermined" ||
    normalized === "unknown" ||
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "not specified"
  ) {
    return null;
  }

  return value.trim();
}

function getMeasureName(record: UnknownRecord): string | null {
  const measureUnit = asRecord(record.measureUnit);
  const nestedName = measureUnit
    ? getMeaningfulText(getString(measureUnit, "name"))
    : null;
  const nestedAbbreviation = measureUnit
    ? getMeaningfulText(getString(measureUnit, "abbreviation"))
    : null;

  return (
    nestedName ??
    nestedAbbreviation ??
    getMeaningfulText(getString(record, "measureUnitName")) ??
    getMeaningfulText(getString(record, "measureUnitAbbreviation"))
  );
}

function joinMeasureDescription(
  amount: number | null,
  measureName: string | null,
  modifier: string | null,
): string | null {
  let description =
    amount !== null && measureName
      ? `${formatAmount(amount)} ${measureName}`
      : null;

  if (modifier) {
    if (!description) {
      description = modifier;
    } else if (
      !description.toLowerCase().includes(modifier.toLowerCase())
    ) {
      description = `${description} ${modifier}`;
    }
  }

  return description;
}

function getPortionDescription(
  portion: UnknownRecord,
  gramWeight: number,
): string {
  const providedDescription = getMeaningfulText(
    getString(portion, "portionDescription"),
  );

  if (providedDescription) {
    return appendPhysicalBasis(providedDescription, gramWeight, "g");
  }

  const amount = getPositiveNumber(portion, "amount");
  const measureName = getMeasureName(portion);
  const modifier = getMeaningfulText(getString(portion, "modifier"));
  const generatedDescription = joinMeasureDescription(
    amount,
    measureName,
    modifier,
  );

  return appendPhysicalBasis(generatedDescription, gramWeight, "g");
}

function getFoodPortionOptions(record: UnknownRecord): ServingOption[] {
  if (!Array.isArray(record.foodPortions)) {
    return [];
  }

  return record.foodPortions
    .map((value, sourceIndex) => ({
      portion: asRecord(value),
      sourceIndex,
    }))
    .filter(
      (
        value,
      ): value is {
        portion: UnknownRecord;
        sourceIndex: number;
      } => value.portion !== null,
    )
    .sort((left, right) => {
      const leftSequence =
        getFiniteNumber(left.portion, "sequenceNumber") ??
        Number.MAX_SAFE_INTEGER;
      const rightSequence =
        getFiniteNumber(right.portion, "sequenceNumber") ??
        Number.MAX_SAFE_INTEGER;

      return (
        leftSequence - rightSequence ||
        left.sourceIndex - right.sourceIndex
      );
    })
    .flatMap(({ portion, sourceIndex }) => {
      const gramWeight = getPositiveNumber(portion, "gramWeight");

      if (gramWeight === null) {
        return [];
      }

      const portionId = getFiniteNumber(portion, "id");
      const id =
        portionId !== null &&
        Number.isInteger(portionId) &&
        portionId > 0
          ? `portion:${portionId}`
          : `portion-index:${sourceIndex}`;

      return [
        {
          id,
          label: getPortionDescription(portion, gramWeight),
          amount: gramWeight,
          unit: "g",
          source: "usda-portion",
        } satisfies ServingOption,
      ];
    });
}

function getSearchMeasure(record: UnknownRecord): SearchMeasure | null {
  if (!Array.isArray(record.foodMeasures)) {
    return null;
  }

  const measures = record.foodMeasures
    .map((value, sourceIndex) => ({
      measure: asRecord(value),
      sourceIndex,
    }))
    .filter(
      (
        value,
      ): value is {
        measure: UnknownRecord;
        sourceIndex: number;
      } => value.measure !== null,
    )
    .sort((left, right) => {
      const leftRank =
        getFiniteNumber(left.measure, "rank") ?? Number.MAX_SAFE_INTEGER;
      const rightRank =
        getFiniteNumber(right.measure, "rank") ?? Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank || left.sourceIndex - right.sourceIndex;
    });

  for (const { measure } of measures) {
    const gramWeight = getPositiveNumber(measure, "gramWeight");

    if (gramWeight === null) {
      continue;
    }

    const disseminationText = getMeaningfulText(
      getString(measure, "disseminationText"),
    );
    const description =
      disseminationText ??
      joinMeasureDescription(
        getPositiveNumber(measure, "amount"),
        getMeasureName(measure),
        getMeaningfulText(getString(measure, "modifier")),
      );

    return {
      amount: gramWeight,
      label: appendPhysicalBasis(description, gramWeight, "g"),
    };
  }

  return null;
}

function amountsMatch(left: number, right: number): boolean {
  return Math.abs(left - right) <= SERVING_AMOUNT_TOLERANCE;
}

function normalizeOptionLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function deduplicateServingOptions(
  options: readonly ServingOption[],
): ServingOption[] {
  const deduplicated: ServingOption[] = [];

  for (const option of options) {
    if (
      !option.label.trim() ||
      !Number.isFinite(option.amount) ||
      option.amount <= 0
    ) {
      continue;
    }

    if (deduplicated.some((existing) => existing.id === option.id)) {
      continue;
    }

    const exactDuplicate = deduplicated.some(
      (existing) =>
        existing.unit === option.unit &&
        amountsMatch(existing.amount, option.amount) &&
        normalizeOptionLabel(existing.label) ===
          normalizeOptionLabel(option.label),
    );

    if (exactDuplicate) {
      continue;
    }

    const isGenerated =
      option.source === "derived-mass" || option.source === "fallback";
    const duplicatesVerifiedAmount =
      isGenerated &&
      deduplicated.some(
        (existing) =>
          (existing.source === "branded" ||
            existing.source === "usda-portion") &&
          existing.unit === option.unit &&
          amountsMatch(existing.amount, option.amount),
      );

    if (!duplicatesVerifiedAmount) {
      deduplicated.push(option);
    }
  }

  return deduplicated;
}

function getGeneratedServingOptions(
  unit: ServingUnit,
): ServingOption[] {
  if (unit === "ml") {
    return [
      {
        id: "volume:1ml",
        label: "1 ml",
        amount: 1,
        unit,
        source: "derived-mass",
      },
      {
        id: "volume:100ml",
        label: "100 ml",
        amount: 100,
        unit,
        source: "fallback",
      },
    ];
  }

  return [
    {
      id: "mass:1g",
      label: "1 g",
      amount: 1,
      unit,
      source: "derived-mass",
    },
    {
      id: "mass:100g",
      label: "100 g",
      amount: 100,
      unit,
      source: "fallback",
    },
    {
      id: "mass:1oz",
      label: "1 oz (28.35 g)",
      amount: OUNCE_IN_GRAMS,
      unit,
      source: "derived-mass",
    },
  ];
}

function getServingOptions(
  record: UnknownRecord,
  dataType: UsdaDataType,
  unit: ServingUnit,
): ServingOption[] {
  const verifiedOptions =
    dataType === "Branded"
      ? [getBrandedServingOption(record)].filter(
          (option): option is ServingOption => option !== null,
        )
      : getFoodPortionOptions(record);

  return deduplicateServingOptions([
    ...verifiedOptions,
    ...getGeneratedServingOptions(unit),
  ]);
}

function getDefaultServingOptionId(
  options: readonly ServingOption[],
  dataType: UsdaDataType,
  unit: ServingUnit,
): string {
  const declaredOption =
    dataType === "Branded"
      ? options.find((option) => option.source === "branded")
      : options.find((option) => option.source === "usda-portion");
  const fallbackId = unit === "g" ? "mass:100g" : "volume:100ml";
  const defaultOption =
    declaredOption ??
    options.find((option) => option.id === fallbackId) ??
    options[0];

  if (!defaultOption) {
    throw new FoodDataCentralError(
      "unavailable-serving",
      "This food does not have a usable gram or millilitre serving.",
    );
  }

  return defaultOption.id;
}

function createSearchPreview(
  record: UnknownRecord,
  dataType: UsdaDataType,
  nutrientsPer100Units: NutrientSnapshot,
): NormalizedFoodSearchResult["preview"] {
  if (dataType === "Branded") {
    const serving = getBrandedServingOption(record);

    if (serving) {
      return {
        basisLabel: serving.label,
        nutrients: scaleNutrients(
          nutrientsPer100Units,
          serving.amount / 100,
        ),
      };
    }

    const unit = normalizeServingUnit(
      getString(record, "servingSizeUnit"),
    );

    return {
      basisLabel: unit ? `per 100 ${unit}` : "per 100 units",
      nutrients: nutrientsPer100Units,
    };
  }

  const searchMeasure = getSearchMeasure(record);

  if (searchMeasure) {
    return {
      basisLabel: searchMeasure.label,
      nutrients: scaleNutrients(
        nutrientsPer100Units,
        searchMeasure.amount / 100,
      ),
    };
  }

  return {
    basisLabel: "per 100 g",
    nutrients: nutrientsPer100Units,
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
    preview: createSearchPreview(
      record,
      dataType,
      parseNutrients(record, dataType),
    ),
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

  const nutrientsPer100Units = parseNutrients(record, searchFood.dataType);

  if (!hasAnyNutrient(nutrientsPer100Units)) {
    throw new FoodDataCentralError(
      "unavailable-nutrients",
      "This food does not include calories or macronutrients.",
    );
  }

  const servingUnit =
    searchFood.dataType === "Branded"
      ? normalizeServingUnit(getString(record, "servingSizeUnit"))
      : "g";

  if (!servingUnit) {
    throw new FoodDataCentralError(
      "unavailable-serving",
      "This food does not have a usable gram or millilitre serving.",
    );
  }

  const nutrientBasis: NutrientBasis = {
    amount: 100,
    unit: servingUnit,
    nutrients: nutrientsPer100Units,
  };
  const servingOptions = getServingOptions(
    record,
    searchFood.dataType,
    servingUnit,
  );

  return {
    ...searchFood,
    nutrientBasis,
    servingOptions,
    defaultServingOptionId: getDefaultServingOptionId(
      servingOptions,
      searchFood.dataType,
      servingUnit,
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
