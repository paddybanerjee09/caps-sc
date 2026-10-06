import {
  canonicalAmount,
  createId,
  editMealDraftKey,
  emptyNutrientSnapshot,
  formatLocalDateKey,
  isFoodUnit,
  newMealDraftKey,
  savedMealDraftKey,
  startOfLocalDay,
} from "./calculations";
import { NUTRIENT_REGISTRY } from "./nutrients";
import type {
  CatalogFood,
  ExtraNutrientValue,
  FoodRef,
  FoodSource,
  FoodUnit,
  NewMealItem,
  NutrientSnapshot,
  StoragePolicy,
  StoredMealLog,
} from "../types/nutrition";

export type DraftMealItem = {
  clientId: string;
  food: FoodRef;
  servingId: string;
  description: string | null;
  brandName: string | null;
  quantityInput: string;
  servingAmount: number | null;
  servingUnit: FoodUnit | null;
  servingDescription: string | null;
  nutrientsPerServing: NutrientSnapshot;
  extrasPerServing: ExtraNutrientValue[];
  storagePolicy: StoragePolicy;
  resolved: boolean;
};

export type MealDraft = {
  key: string;
  mode: "create" | "edit" | "savedTemplate";
  timelineEntryId: number | null;
  operationId: string | null;
  dayKey: string;
  title: string;
  titleTouched: boolean;
  loggedAt: number;
  items: DraftMealItem[];
  savedMealId: string | null;
  savedSignature: string | null;
  pendingTemplateOperationId: string | null;
};

export type NutritionRoute =
  | { screen: "mealLog"; draftKey: string }
  | { screen: "savedMeals" }
  | { screen: "mealItem" }
  | { screen: "barcode" }
  | { screen: "customFood" }
  | { screen: "facts" };

export type PickerTab = "all" | "favourites" | "custom";
export type UsageSort = "default" | "frequent" | "recent";

export type PickerState = {
  query: string;
  tab: PickerTab;
  sort: UsageSort;
  scrollOffsets: Record<PickerTab, number>;
};

export type CustomFoodForm = {
  customFoodId: string | null;
  operationId: string;
  name: string;
  brand: string;
  barcode: string;
  servingAmount: string;
  servingUnit: FoodUnit;
  calories: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  extras: Record<string, string>;
};

export type FactsSession = {
  food: FoodRef;
  draftItemId: string | null;
  amountInput: string;
  calorieInput: string;
  inputMode: "amount" | "calories";
  servingId: string | null;
  snapshot: CatalogFood | null;
};

export type ScannerState = {
  manualEntryOpen: boolean;
  typedBarcode: string;
};

export type WorkspaceModel = {
  diaryDayMs: number;
  expandedMealId: number | null;
  homeDayMs: number;
  stack: NutritionRoute[];
  drafts: Record<string, MealDraft>;
  activeDraftKey: string | null;
  picker: PickerState;
  customForm: CustomFoodForm;
  facts: FactsSession | null;
  scanner: ScannerState;
  notice: string | null;
};

const FOOD_SOURCES = new Set<FoodSource>([
  "fatsecret",
  "openfoodfacts",
  "custom",
  "usda",
]);

export function createEmptyWorkspace(now = Date.now()): WorkspaceModel {
  return {
    diaryDayMs: startOfLocalDay(new Date(now)).getTime(),
    expandedMealId: null,
    homeDayMs: startOfLocalDay(new Date(now)).getTime(),
    stack: [],
    drafts: {},
    activeDraftKey: null,
    picker: {
      query: "",
      tab: "all",
      sort: "default",
      scrollOffsets: { all: 0, favourites: 0, custom: 0 },
    },
    customForm: createCustomFoodForm(),
    facts: null,
    scanner: { manualEntryOpen: false, typedBarcode: "" },
    notice: null,
  };
}

export function createCustomFoodForm(): CustomFoodForm {
  return {
    customFoodId: null,
    operationId: createId(),
    name: "",
    brand: "",
    barcode: "",
    servingAmount: "",
    servingUnit: "g",
    calories: "",
    protein: "",
    carbohydrates: "",
    fat: "",
    extras: {},
  };
}

export function customFoodToForm(food: {
  barcode: string | null;
  brand: string | null;
  carbohydratesG: number;
  energyKcal: number;
  extras: ExtraNutrientValue[];
  fatG: number;
  id: string;
  name: string;
  proteinG: number;
  servingAmount: number;
  servingUnit: FoodUnit;
}): CustomFoodForm {
  return {
    barcode: food.barcode ?? "",
    brand: food.brand ?? "",
    calories: String(food.energyKcal),
    carbohydrates: String(food.carbohydratesG),
    customFoodId: food.id,
    extras: Object.fromEntries(
      food.extras.flatMap((extra) =>
        extra.amount === null ? [] : [[extra.id, String(extra.amount)]],
      ),
    ),
    fat: String(food.fatG),
    name: food.name,
    operationId: createId(),
    protein: String(food.proteinG),
    servingAmount: String(food.servingAmount),
    servingUnit: food.servingUnit,
  };
}

export function initialLoggedAt(day: Date) {
  const now = new Date();
  const stamp = new Date(day);
  stamp.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return stamp.getTime();
}

export function createMealDraft(input: {
  key: string;
  mode: "create" | "edit" | "savedTemplate";
  day: Date;
  operationId: string | null;
  timelineEntryId?: number | null;
  loggedAt?: number;
  title?: string;
}): MealDraft {
  return {
    key: input.key,
    mode: input.mode,
    timelineEntryId: input.timelineEntryId ?? null,
    operationId: input.operationId,
    dayKey: formatLocalDateKey(input.day),
    title: input.title ?? "",
    titleTouched: false,
    loggedAt: input.loggedAt ?? initialLoggedAt(input.day),
    items: [],
    savedMealId: null,
    savedSignature: null,
    pendingTemplateOperationId: null,
  };
}

export function draftFromStoredMeal(meal: StoredMealLog): MealDraft {
  const day = new Date(meal.loggedAt);
  const draft = createMealDraft({
    key: editMealDraftKey(meal.timelineEntryId),
    mode: "edit",
    day,
    operationId: meal.operationId,
    timelineEntryId: meal.timelineEntryId,
    loggedAt: meal.loggedAt,
    title: meal.title,
  });
  draft.titleTouched = true;
  draft.savedMealId = meal.savedMealId;
  draft.items = meal.items.map(storedItemToDraft);
  draft.savedSignature = meal.savedMealId ? compositionSignature(draft) : null;
  return draft;
}

export function draftFromSavedMeal(meal: {
  id: string;
  items: readonly NewMealItem[];
  title: string;
}): MealDraft {
  const day = new Date();
  const draft: MealDraft = {
    key: savedMealDraftKey(meal.id),
    mode: "savedTemplate",
    timelineEntryId: null,
    operationId: null,
    dayKey: formatLocalDateKey(day),
    title: meal.title,
    titleTouched: true,
    loggedAt: initialLoggedAt(day),
    items: meal.items.map(savedTemplateItemToDraft),
    savedMealId: meal.id,
    savedSignature: null,
    pendingTemplateOperationId: null,
  };
  draft.savedSignature = compositionSignature(draft);
  return draft;
}

function savedTemplateItemToDraft(item: NewMealItem): DraftMealItem {
  return {
    brandName: item.storagePolicy === "reference" ? null : item.brandName,
    clientId: createId(),
    description: item.storagePolicy === "reference" ? null : item.description,
    extrasPerServing: item.storagePolicy === "reference" ? [] : item.extrasPerServing,
    food: item.food,
    nutrientsPerServing:
      item.storagePolicy === "reference"
        ? {
            carbohydratesG: null,
            energyKcal: null,
            fatG: null,
            proteinG: null,
          }
        : item.nutrientsPerServing,
    quantityInput: String(item.quantity),
    resolved: item.storagePolicy === "snapshot",
    servingAmount: item.servingAmount,
    servingDescription: item.servingDescription,
    servingId: item.servingId,
    servingUnit: item.servingUnit,
    storagePolicy: item.storagePolicy,
  };
}

export function storedItemToDraft(
  item: StoredMealLog["items"][number],
): DraftMealItem {
  const resolved = item.storagePolicy === "snapshot";

  return {
    clientId: `stored:${item.id}`,
    food: item.food,
    servingId: item.servingId,
    description: resolved ? item.description : null,
    brandName: resolved ? item.brandName : null,
    quantityInput: formatQuantityInput(item.quantity),
    servingAmount: resolved ? item.servingAmount : null,
    servingUnit: resolved ? item.servingUnit : null,
    servingDescription: resolved ? item.servingDescription : null,
    nutrientsPerServing: resolved
      ? { ...item.nutrientsPerServing }
      : emptyNutrientSnapshot(),
    extrasPerServing: resolved ? item.extrasPerServing.map((extra) => ({ ...extra })) : [],
    storagePolicy: item.storagePolicy,
    resolved,
  };
}

export function formatQuantityInput(quantity: number) {
  return Number.isInteger(quantity)
    ? quantity.toFixed(0)
    : String(Number(quantity.toFixed(3)));
}

export function compositionSignature(draft: Pick<MealDraft, "title" | "items">) {
  return JSON.stringify({
    title: draft.title.trim(),
    items: draft.items.map((item) => ({
      source: item.food.source,
      externalId: item.food.externalId,
      servingId: item.servingId,
      quantity: quantityToken(item.quantityInput),
    })),
  });
}

function quantityToken(input: string) {
  const value = Number(input);

  if (!Number.isFinite(value)) {
    return input.trim();
  }

  return canonicalAmount(value);
}

export function serializeWorkspace(model: WorkspaceModel) {
  return JSON.stringify({
    version: 1,
    ...model,
    drafts: Object.fromEntries(
      Object.entries(model.drafts).map(([key, draft]) => [
        key,
        {
          ...draft,
          items: draft.items.map(persistDraftItem),
        },
      ]),
    ),
    facts: model.facts
      ? {
          ...model.facts,
          snapshot:
            model.facts.snapshot?.storagePolicy === "snapshot"
              ? model.facts.snapshot
              : null,
        }
      : null,
  });
}

function persistDraftItem(item: DraftMealItem): DraftMealItem {
  if (item.storagePolicy !== "reference") {
    return item;
  }

  return {
    ...item,
    description: null,
    brandName: null,
    servingAmount: null,
    servingUnit: null,
    servingDescription: null,
    nutrientsPerServing: emptyNutrientSnapshot(),
    extrasPerServing: [],
    resolved: false,
  };
}

export function restoreWorkspace(
  payload: string | null,
  existingMealIds: ReadonlySet<number>,
  committedOperations: ReadonlyMap<string, string>,
  now = Date.now(),
): WorkspaceModel {
  const parsed = parseWorkspace(payload, now);

  if (!parsed) {
    return createEmptyWorkspace(now);
  }

  let notice = parsed.notice;
  const drafts: Record<string, MealDraft> = {};

  for (const [key, draft] of Object.entries(parsed.drafts)) {
    if (draft.mode === "create" && draft.operationId) {
      const committedId = committedOperations.get(draft.operationId);

      if (committedId) {
        if (parsed.stack.some((route) => route.screen === "mealLog" && route.draftKey === key)) {
          notice = notice ?? "That meal was already logged.";
        }
        continue;
      }
    }

    if (draft.mode === "edit") {
      if (
        draft.timelineEntryId === null ||
        !existingMealIds.has(draft.timelineEntryId)
      ) {
        notice = "That meal is no longer available.";
        continue;
      }
    }

    drafts[key] = draft;
  }

  const customForm = { ...parsed.customForm };

  if (!customForm.customFoodId && customForm.operationId) {
    const committedId = committedOperations.get(customForm.operationId);

    if (committedId) {
      customForm.customFoodId = committedId;
    }
  }

  const stack = parsed.stack.filter((route) => {
    if (route.screen !== "mealLog") {
      return true;
    }

    return Boolean(drafts[route.draftKey]);
  });

  const mealLog = stack.find((route) => route.screen === "mealLog");
  const facts =
    stack.some((route) => route.screen === "facts") && parsed.facts
      ? parsed.facts
      : null;
  const trimmedStack = facts
    ? stack
    : stack.filter((route) => route.screen !== "facts");

  return {
    ...parsed,
    drafts,
    customForm,
    facts,
    stack: trimmedStack,
    activeDraftKey:
      mealLog && mealLog.screen === "mealLog" ? mealLog.draftKey : null,
    notice,
  };
}

function parseWorkspace(payload: string | null, now: number): WorkspaceModel | null {
  if (!payload) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(payload);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (record.version !== 1) {
      return null;
    }

    const fallback = createEmptyWorkspace(now);
    const drafts = parseDrafts(record.drafts);
    const stack = parseStack(record.stack).filter((route) => {
      if (route.screen !== "mealLog") {
        return true;
      }

      return Boolean(drafts[route.draftKey]);
    });

    return {
      diaryDayMs: finiteNumber(record.diaryDayMs) ?? fallback.diaryDayMs,
      expandedMealId:
        typeof record.expandedMealId === "number" &&
        Number.isInteger(record.expandedMealId)
          ? record.expandedMealId
          : null,
      homeDayMs: finiteNumber(record.homeDayMs) ?? fallback.homeDayMs,
      stack,
      drafts,
      activeDraftKey: null,
      picker: parsePicker(record.picker, fallback.picker),
      customForm: parseCustomForm(record.customForm, fallback.customForm),
      facts: parseFacts(record.facts),
      scanner: parseScanner(record.scanner),
      notice: typeof record.notice === "string" ? record.notice : null,
    };
  } catch {
    return null;
  }
}

function parseDrafts(value: unknown) {
  const drafts: Record<string, MealDraft> = {};

  if (typeof value !== "object" || value === null) {
    return drafts;
  }

  for (const [key, entry] of Object.entries(value)) {
    const draft = parseDraft(key, entry);

    if (draft) {
      drafts[key] = draft;
    }
  }

  return drafts;
}

function parseDraft(key: string, value: unknown): MealDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mode =
    record.mode === "edit"
      ? "edit"
      : record.mode === "create"
        ? "create"
        : record.mode === "savedTemplate"
          ? "savedTemplate"
          : null;

  if (!mode || record.key !== key) {
    return null;
  }

  if (mode === "create" && key !== record.key) {
    return null;
  }

  const expectedPrefix =
    mode === "create" ? "new:" : mode === "edit" ? "edit:" : "saved:";

  if (!key.startsWith(expectedPrefix)) {
    return null;
  }

  if (mode === "savedTemplate" && key.slice(6).length === 0) {
    return null;
  }

  if (mode === "create" && key !== newMealDraftKey(new Date(`${key.slice(4)}T12:00:00`))) {
    const dayKey = key.slice(4);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      return null;
    }
  }

  const loggedAt = finiteNumber(record.loggedAt);

  if (loggedAt === null) {
    return null;
  }

  const items = Array.isArray(record.items)
    ? record.items
        .map(parseDraftItem)
        .filter((item): item is DraftMealItem => item !== null)
    : [];

  return {
    key,
    mode,
    timelineEntryId:
      typeof record.timelineEntryId === "number" &&
      Number.isInteger(record.timelineEntryId)
        ? record.timelineEntryId
        : null,
    operationId: typeof record.operationId === "string" ? record.operationId : null,
    dayKey: typeof record.dayKey === "string" ? record.dayKey : key.slice(4),
    title: typeof record.title === "string" ? record.title : "",
    titleTouched: record.titleTouched === true,
    loggedAt,
    items,
    savedMealId: typeof record.savedMealId === "string" ? record.savedMealId : null,
    savedSignature:
      typeof record.savedSignature === "string" ? record.savedSignature : null,
    pendingTemplateOperationId:
      typeof record.pendingTemplateOperationId === "string"
        ? record.pendingTemplateOperationId
        : null,
  };
}

function parseDraftItem(value: unknown): DraftMealItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const food = parseFoodRef(record.food);

  if (!food || typeof record.clientId !== "string" || typeof record.servingId !== "string") {
    return null;
  }

  if (typeof record.quantityInput !== "string") {
    return null;
  }

  const storagePolicy: StoragePolicy =
    record.storagePolicy === "reference" ? "reference" : "snapshot";

  return {
    clientId: record.clientId,
    food,
    servingId: record.servingId,
    description: typeof record.description === "string" ? record.description : null,
    brandName: typeof record.brandName === "string" ? record.brandName : null,
    quantityInput: record.quantityInput,
    servingAmount: finiteNumber(record.servingAmount),
    servingUnit:
      typeof record.servingUnit === "string" && isFoodUnit(record.servingUnit)
        ? record.servingUnit
        : null,
    servingDescription:
      typeof record.servingDescription === "string" ? record.servingDescription : null,
    nutrientsPerServing: parseSnapshot(record.nutrientsPerServing),
    extrasPerServing: parseExtras(record.extrasPerServing),
    storagePolicy,
    resolved: storagePolicy === "snapshot" && record.resolved !== false,
  };
}

function parseFoodRef(value: unknown): FoodRef | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.source !== "string" ||
    !FOOD_SOURCES.has(record.source as FoodSource) ||
    typeof record.externalId !== "string" ||
    record.externalId.length === 0
  ) {
    return null;
  }

  return {
    source: record.source as FoodSource,
    externalId: record.externalId,
  };
}

function parseSnapshot(value: unknown): NutrientSnapshot {
  if (typeof value !== "object" || value === null) {
    return emptyNutrientSnapshot();
  }

  const record = value as Record<string, unknown>;

  return {
    energyKcal: nonNegative(record.energyKcal),
    proteinG: nonNegative(record.proteinG),
    carbohydratesG: nonNegative(record.carbohydratesG),
    fatG: nonNegative(record.fatG),
  };
}

function parseExtras(value: unknown): ExtraNutrientValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;

      if (typeof record.id !== "string" || typeof record.unit !== "string") {
        return null;
      }

      return {
        id: record.id,
        unit: record.unit,
        amount: nonNegative(record.amount),
      };
    })
    .filter((entry): entry is ExtraNutrientValue => entry !== null);
}

function parseStack(value: unknown): NutritionRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;

      switch (record.screen) {
        case "mealLog":
          return typeof record.draftKey === "string"
            ? { screen: "mealLog" as const, draftKey: record.draftKey }
            : null;
        case "savedMeals":
        case "mealItem":
        case "barcode":
        case "customFood":
        case "facts":
          return { screen: record.screen };
        default:
          return null;
      }
    })
    .filter((route): route is NutritionRoute => route !== null);
}

function parsePicker(value: unknown, fallback: PickerState): PickerState {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const tab =
    record.tab === "favourites" || record.tab === "custom" || record.tab === "all"
      ? record.tab
      : fallback.tab;
  const sort =
    record.sort === "frequent" || record.sort === "recent" || record.sort === "default"
      ? record.sort
      : fallback.sort;
  const offsets =
    typeof record.scrollOffsets === "object" && record.scrollOffsets !== null
      ? (record.scrollOffsets as Record<string, unknown>)
      : {};

  return {
    query: typeof record.query === "string" ? record.query : "",
    tab,
    sort,
    scrollOffsets: {
      all: finiteNumber(offsets.all) ?? 0,
      favourites: finiteNumber(offsets.favourites) ?? 0,
      custom: finiteNumber(offsets.custom) ?? 0,
    },
  };
}

function parseCustomForm(value: unknown, fallback: CustomFoodForm): CustomFoodForm {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const extras =
    typeof record.extras === "object" && record.extras !== null
      ? Object.fromEntries(
          Object.entries(record.extras).filter(
            (entry): entry is [string, string] =>
              NUTRIENT_REGISTRY.some((definition) => definition.id === entry[0]) &&
              typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    customFoodId:
      typeof record.customFoodId === "string" ? record.customFoodId : null,
    operationId:
      typeof record.operationId === "string" && record.operationId.length > 0
        ? record.operationId
        : fallback.operationId,
    name: typeof record.name === "string" ? record.name : "",
    brand: typeof record.brand === "string" ? record.brand : "",
    barcode: typeof record.barcode === "string" ? record.barcode : "",
    servingAmount:
      typeof record.servingAmount === "string" ? record.servingAmount : "",
    servingUnit:
      typeof record.servingUnit === "string" && isFoodUnit(record.servingUnit)
        ? record.servingUnit
        : "g",
    calories: typeof record.calories === "string" ? record.calories : "",
    protein: typeof record.protein === "string" ? record.protein : "",
    carbohydrates:
      typeof record.carbohydrates === "string" ? record.carbohydrates : "",
    fat: typeof record.fat === "string" ? record.fat : "",
    extras,
  };
}

function parseFacts(value: unknown): FactsSession | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const food = parseFoodRef(record.food);

  if (!food || typeof record.amountInput !== "string") {
    return null;
  }

  return {
    food,
    draftItemId:
      typeof record.draftItemId === "string" ? record.draftItemId : null,
    amountInput: record.amountInput,
    calorieInput: typeof record.calorieInput === "string" ? record.calorieInput : "",
    inputMode: record.inputMode === "calories" ? "calories" : "amount",
    servingId: typeof record.servingId === "string" ? record.servingId : null,
    snapshot: parseCatalogFood(record.snapshot),
  };
}

export function parseCatalogFood(value: unknown): CatalogFood | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const ref = parseFoodRef(record.ref);

  if (!ref || typeof record.name !== "string" || !Array.isArray(record.servings)) {
    return null;
  }

  if (record.storagePolicy === "reference") {
    return null;
  }

  const servings = record.servings
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const serving = entry as Record<string, unknown>;

      if (
        typeof serving.id !== "string" ||
        typeof serving.label !== "string" ||
        typeof serving.unit !== "string" ||
        !isFoodUnit(serving.unit) ||
        finiteNumber(serving.amount) === null
      ) {
        return null;
      }

      return {
        id: serving.id,
        label: serving.label,
        amount: finiteNumber(serving.amount) ?? 0,
        unit: serving.unit,
        nutrients: parseSnapshot(serving.nutrients),
        extras: parseExtras(serving.extras),
      };
    })
    .filter((serving): serving is CatalogFood["servings"][number] => serving !== null);

  if (servings.length === 0) {
    return null;
  }

  return {
    ref,
    name: record.name,
    brandName: typeof record.brandName === "string" ? record.brandName : null,
    storagePolicy: "snapshot",
    attribution:
      typeof record.attribution === "string" ? record.attribution : null,
    servings,
    defaultServingId:
      typeof record.defaultServingId === "string"
        ? record.defaultServingId
        : servings[0].id,
  };
}

function parseScanner(value: unknown): ScannerState {
  if (typeof value !== "object" || value === null) {
    return { manualEntryOpen: false, typedBarcode: "" };
  }

  const record = value as Record<string, unknown>;

  return {
    manualEntryOpen: record.manualEntryOpen === true,
    typedBarcode: typeof record.typedBarcode === "string" ? record.typedBarcode : "",
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegative(value: unknown) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 ? number : null;
}
