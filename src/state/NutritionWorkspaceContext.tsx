import { useSQLiteContext } from "expo-sqlite";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Keyboard } from "react-native";

import {
  getCommittedOperations,
  readWorkspacePayload,
  writeWorkspacePayload,
} from "../data/nutritionCatalogRepository";
import { getExistingMealIds, getMealLogsForDay } from "../data/nutritionRepository";
import {
  createId,
  localDayBounds,
  startOfLocalDay,
  editMealDraftKey,
  newMealDraftKey,
} from "../nutrition/calculations";
import type { CustomFoodRecord } from "../data/nutritionCatalogRepository";
import {
  createCustomFoodForm,
  createEmptyWorkspace,
  createMealDraft,
  customFoodToForm,
  draftFromStoredMeal,
  initialLoggedAt,
  restoreWorkspace,
  serializeWorkspace,
  type CustomFoodForm,
  type FactsSession,
  type MealDraft,
  type NutritionRoute,
  type PickerState,
  type ScannerState,
  type WorkspaceModel,
} from "../nutrition/drafts";
import type { StoredMealLog } from "../types/nutrition";

export type StackEntry = {
  key: string;
  phase: "idle" | "enter" | "exit";
  replaceBelow?: boolean;
  route: NutritionRoute;
};

type NutritionWorkspaceValue = {
  activeDraft: MealDraft | null;
  clearNotice: () => void;
  closeToRoot: () => void;
  completeCustomFood: () => void;
  customForm: CustomFoodForm;
  dataRevision: number;
  diaryDate: Date;
  discardDraft: (key: string) => Promise<void>;
  dismissTransient: () => void;
  drafts: Record<string, MealDraft>;
  expandedMealId: number | null;
  facts: FactsSession | null;
  flush: () => Promise<void>;
  handleHardwareBack: () => boolean;
  homeDate: Date;
  keyboardVisible: boolean;
  markNutritionChanged: () => void;
  notice: string | null;
  openEditMeal: (meal: StoredMealLog) => void;
  openNewMeal: (day: Date) => void;
  picker: PickerState;
  pop: () => void;
  push: (route: NutritionRoute) => void;
  ready: boolean;
  removeDraft: (key: string) => void;
  registerBackHandler: (handler: () => boolean) => () => void;
  requestNutritionTab: () => void;
  returnToMealLog: () => void;
  scanner: ScannerState;
  setDiaryDate: (date: Date) => void;
  setExpandedMealId: (id: number | null) => void;
  setFacts: (facts: FactsSession | null) => void;
  setHomeDate: (date: Date) => void;
  setNotice: (notice: string | null) => void;
  setNutritionTabHandler: (handler: (() => void) | null) => void;
  settleStack: (entryKey: string) => void;
  stack: StackEntry[];
  startCustomFood: (barcode?: string) => void;
  startEditCustomFood: (food: CustomFoodRecord) => void;
  transientEpoch: number;
  transitioning: boolean;
  updateCustomForm: (recipe: (form: CustomFoodForm) => CustomFoodForm) => void;
  updateDraft: (key: string, recipe: (draft: MealDraft) => MealDraft) => void;
  updatePicker: (recipe: (picker: PickerState) => PickerState) => void;
  updateScanner: (recipe: (scanner: ScannerState) => ScannerState) => void;
};

const NutritionWorkspaceContext = createContext<NutritionWorkspaceValue | null>(null);

function logicalRoutes(entries: readonly StackEntry[]) {
  return entries
    .filter((entry) => entry.phase !== "exit")
    .map((entry) => entry.route);
}

export function NutritionWorkspaceProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [model, setModel] = useState<WorkspaceModel>(() => createEmptyWorkspace());
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [dataRevision, setDataRevision] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transientEpoch, setTransientEpoch] = useState(0);
  const modelRef = useRef(model);
  const stackRef = useRef(stack);
  const readyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRef = useRef(false);
  const tabHandler = useRef<(() => void) | null>(null);
  const backHandlers = useRef(new Set<() => boolean>());

  useEffect(() => {
    modelRef.current = model;
    stackRef.current = stack;
  });

  const flush = useCallback(async () => {
    if (!readyRef.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const payload = serializeWorkspace({
      ...modelRef.current,
      stack: logicalRoutes(stackRef.current),
      activeDraftKey: activeDraftKeyFrom(stackRef.current),
    });
    await writeWorkspacePayload(db, payload);
  }, [db]);

  const scheduleSave = useCallback(() => {
    if (!readyRef.current) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void flush();
    }, 400);
  }, [flush]);

  const commitModel = useCallback(
    (next: WorkspaceModel) => {
      modelRef.current = next;
      setModel(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const commitStack = useCallback(
    (next: StackEntry[], locked: boolean) => {
      stackRef.current = next;
      lockRef.current = locked;
      setStack(next);
      setTransitioning(locked);
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [payload, mealIds, operations] = await Promise.all([
          readWorkspacePayload(db),
          getExistingMealIds(db),
          getCommittedOperations(db),
        ]);
        const restored = restoreWorkspace(payload, mealIds, operations);

        if (cancelled) {
          return;
        }

        modelRef.current = restored;
        const entries = restored.stack.map((route) => ({
          key: createId(),
          phase: "idle" as const,
          route,
        }));
        stackRef.current = entries;
        setModel(restored);
        setStack(entries);
      } finally {
        if (!cancelled) {
          readyRef.current = true;
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        void flush();
      }
    });

    return () => subscription.remove();
  }, [flush]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const push = useCallback(
    (route: NutritionRoute) => {
      if (lockRef.current) {
        return;
      }

      const current = stackRef.current.filter((entry) => entry.phase !== "exit");
      const top = current[current.length - 1];

      if (top && sameRoute(top.route, route)) {
        return;
      }

      commitStack(
        [
          ...current,
          {
            key: createId(),
            phase: "enter",
            route,
          },
        ],
        true,
      );
    },
    [commitStack],
  );

  const pop = useCallback(() => {
    if (lockRef.current || stackRef.current.length === 0) {
      return;
    }

    const top = stackRef.current[stackRef.current.length - 1];
    commitStack(
      stackRef.current.map((entry) =>
        entry.key === top.key ? { ...entry, phase: "exit" } : entry,
      ),
      true,
    );
  }, [commitStack]);

  const returnToMealLog = useCallback(() => {
    if (lockRef.current) {
      return;
    }

    const current = stackRef.current.filter((entry) => entry.phase !== "exit");
    const meal = current.find((entry) => entry.route.screen === "mealLog");
    const top = current[current.length - 1];

    if (!meal || !top || meal.key === top.key) {
      return;
    }

    commitStack(
      [
        { ...meal, phase: "idle" },
        { ...top, phase: "exit" },
      ],
      true,
    );
  }, [commitStack]);

  const closeToRoot = useCallback(() => {
    if (lockRef.current || stackRef.current.length === 0) {
      return;
    }

    const top = stackRef.current[stackRef.current.length - 1];
    commitStack([{ ...top, phase: "exit" }], true);
  }, [commitStack]);

  const startCustomFood = useCallback(
    (barcode = "") => {
      if (lockRef.current) {
        return;
      }

      commitModel({
        ...modelRef.current,
        customForm: { ...createCustomFoodForm(), barcode },
      });
      push({ screen: "customFood" });
    },
    [commitModel, push],
  );

  const startEditCustomFood = useCallback(
    (food: CustomFoodRecord) => {
      if (lockRef.current) {
        return;
      }

      commitModel({
        ...modelRef.current,
        customForm: customFoodToForm(food),
      });
      push({ screen: "customFood" });
    },
    [commitModel, push],
  );

  const completeCustomFood = useCallback(() => {
    if (lockRef.current) {
      return;
    }

    const current = stackRef.current.filter((entry) => entry.phase !== "exit");
    const pickerIndex = current.findIndex((entry) => entry.route.screen === "mealItem");
    const top = current[current.length - 1];

    if (pickerIndex < 0 || !top || current[pickerIndex].key === top.key) {
      pop();
      return;
    }

    commitModel({
      ...modelRef.current,
      customForm: createCustomFoodForm(),
      picker: { ...modelRef.current.picker, tab: "custom" },
    });
    commitStack(
      [
        ...current.slice(0, pickerIndex),
        { ...current[pickerIndex], phase: "idle" },
        { ...top, phase: "exit" },
      ],
      true,
    );
  }, [commitModel, commitStack, pop]);

  const settleStack = useCallback(
    (entryKey: string) => {
      const current = stackRef.current;
      const entry = current.find((candidate) => candidate.key === entryKey);

      if (!entry || entry.phase === "idle") {
        lockRef.current = false;
        setTransitioning(false);
        return;
      }

      const next =
        entry.phase === "exit"
          ? current.filter((candidate) => candidate.key !== entryKey)
          : entry.replaceBelow
            ? [{ ...entry, phase: "idle" as const, replaceBelow: false }]
            : current.map((candidate) =>
                candidate.key === entryKey
                  ? { ...candidate, phase: "idle" as const }
                  : candidate,
              );

      commitStack(next, false);
      commitModel({
        ...modelRef.current,
        activeDraftKey: activeDraftKeyFrom(next),
        stack: logicalRoutes(next),
      });
    },
    [commitModel, commitStack],
  );

  const revealMealLog = useCallback(
    (draftKey: string) => {
      const route: NutritionRoute = { screen: "mealLog", draftKey };
      const current = stackRef.current.filter((entry) => entry.phase !== "exit");
      const existing = current.find(
        (entry) =>
          entry.route.screen === "mealLog" && entry.route.draftKey === draftKey,
      );
      const top = current[current.length - 1];

      if (existing) {
        if (!top || top.key === existing.key) {
          return;
        }

        if (lockRef.current) {
          return;
        }

        commitStack(
          [
            { ...existing, phase: "idle" },
            { ...top, phase: "exit" },
          ],
          true,
        );
        return;
      }

      if (lockRef.current) {
        return;
      }

      commitStack(
        [
          ...current,
          {
            key: createId(),
            phase: "enter",
            replaceBelow: current.length > 0,
            route,
          },
        ],
        true,
      );
    },
    [commitStack],
  );

  const openNewMeal = useCallback(
    (day: Date) => {
      const key = newMealDraftKey(day);
      const current = modelRef.current;
      const drafts = { ...current.drafts };

      if (!drafts[key]) {
        drafts[key] = createMealDraft({
          key,
          mode: "create",
          day,
          operationId: createId(),
        });
      }

      commitModel({
        ...current,
        activeDraftKey: key,
        diaryDayMs: startOfLocalDay(day).getTime(),
        drafts,
      });
      revealMealLog(key);
      tabHandler.current?.();
    },
    [commitModel, revealMealLog],
  );

  const openEditMeal = useCallback(
    (meal: StoredMealLog) => {
      const key = editMealDraftKey(meal.timelineEntryId);
      const current = modelRef.current;
      const drafts = { ...current.drafts };

      if (!drafts[key]) {
        drafts[key] = draftFromStoredMeal(meal);
      }

      commitModel({
        ...current,
        activeDraftKey: key,
        diaryDayMs: startOfLocalDay(new Date(meal.loggedAt)).getTime(),
        drafts,
        expandedMealId: meal.timelineEntryId,
      });
      revealMealLog(key);
      tabHandler.current?.();
    },
    [commitModel, revealMealLog],
  );

  const removeDraft = useCallback(
    (key: string) => {
      const drafts = { ...modelRef.current.drafts };
      delete drafts[key];
      commitModel({
        ...modelRef.current,
        activeDraftKey:
          modelRef.current.activeDraftKey === key
            ? null
            : modelRef.current.activeDraftKey,
        drafts,
      });
    },
    [commitModel],
  );
  const updateDraft = useCallback(
    (key: string, recipe: (draft: MealDraft) => MealDraft) => {
      const current = modelRef.current;
      const draft = current.drafts[key];

      if (!draft) {
        return;
      }

      commitModel({
        ...current,
        drafts: {
          ...current.drafts,
          [key]: recipe(draft),
        },
      });
    },
    [commitModel],
  );

  const discardDraft = useCallback(
    async (key: string) => {
      const draft = modelRef.current.drafts[key];

      if (!draft) {
        return;
      }

      if (draft.mode === "edit" && draft.timelineEntryId) {
        const { dayStart, dayEnd } = localDayBounds(new Date(draft.loggedAt));
        const meals = await getMealLogsForDay(
          db,
          dayStart.getTime(),
          dayEnd.getTime(),
        );
        const meal = meals.find(
          (candidate) => candidate.timelineEntryId === draft.timelineEntryId,
        );

        if (!meal) {
          const drafts = { ...modelRef.current.drafts };
          delete drafts[key];
          commitModel({
            ...modelRef.current,
            drafts,
            notice: "That meal is no longer available.",
          });
          closeToRoot();
          return;
        }

        updateDraft(key, () => draftFromStoredMeal(meal));
        return;
      }

      const day = new Date(`${draft.dayKey}T12:00:00`);
      updateDraft(key, () =>
        createMealDraft({
          key,
          mode: "create",
          day,
          operationId: createId(),
          loggedAt: initialLoggedAt(day),
        }),
      );
    },
    [closeToRoot, commitModel, db, updateDraft],
  );

  const value = useMemo<NutritionWorkspaceValue>(
    () => ({
      activeDraft: activeDraft(model, stack),
      clearNotice: () => commitModel({ ...modelRef.current, notice: null }),
      closeToRoot,
      completeCustomFood,
      customForm: model.customForm,
      dataRevision,
      diaryDate: new Date(model.diaryDayMs),
      discardDraft,
      dismissTransient: () => {
        Keyboard.dismiss();
        setTransientEpoch((epoch) => epoch + 1);
      },
      drafts: model.drafts,
      expandedMealId: model.expandedMealId,
      facts: model.facts,
      flush,
      handleHardwareBack: () => {
        if (keyboardVisible) {
          Keyboard.dismiss();
          return true;
        }

        for (const handler of [...backHandlers.current].reverse()) {
          if (handler()) {
            return true;
          }
        }

        if (stackRef.current.length > 0) {
          pop();
          return true;
        }

        return false;
      },
      homeDate: new Date(model.homeDayMs),
      keyboardVisible,
      markNutritionChanged: () => setDataRevision((revision) => revision + 1),
      notice: model.notice,
      openEditMeal,
      openNewMeal,
      picker: model.picker,
      pop,
      push,
      ready,
      removeDraft,
      registerBackHandler: (handler) => {
        backHandlers.current.add(handler);
        return () => {
          backHandlers.current.delete(handler);
        };
      },
      requestNutritionTab: () => tabHandler.current?.(),
      returnToMealLog,
      scanner: model.scanner,
      setDiaryDate: (date) =>
        commitModel({
          ...modelRef.current,
          diaryDayMs: startOfLocalDay(date).getTime(),
          expandedMealId: null,
        }),
      setExpandedMealId: (id) =>
        commitModel({ ...modelRef.current, expandedMealId: id }),
      setFacts: (facts) => commitModel({ ...modelRef.current, facts }),
      setHomeDate: (date) =>
        commitModel({
          ...modelRef.current,
          homeDayMs: startOfLocalDay(date).getTime(),
        }),
      setNotice: (notice) => commitModel({ ...modelRef.current, notice }),
      setNutritionTabHandler: (handler) => {
        tabHandler.current = handler;
      },
      settleStack,
      stack,
      startCustomFood,
      startEditCustomFood,
      transientEpoch,
      transitioning,
      updateCustomForm: (recipe) =>
        commitModel({
          ...modelRef.current,
          customForm: recipe(modelRef.current.customForm),
        }),
      updateDraft,
      updatePicker: (recipe) =>
        commitModel({
          ...modelRef.current,
          picker: recipe(modelRef.current.picker),
        }),
      updateScanner: (recipe) =>
        commitModel({
          ...modelRef.current,
          scanner: recipe(modelRef.current.scanner),
        }),
    }),
    [
      closeToRoot,
      commitModel,
      completeCustomFood,
      dataRevision,
      discardDraft,
      flush,
      keyboardVisible,
      model,
      openEditMeal,
      openNewMeal,
      pop,
      push,
      ready,
      removeDraft,
      returnToMealLog,
      settleStack,
      stack,
      startCustomFood,
      startEditCustomFood,
      transientEpoch,
      transitioning,
      updateDraft,
    ],
  );

  return (
    <NutritionWorkspaceContext.Provider value={value}>
      {children}
    </NutritionWorkspaceContext.Provider>
  );
}

export function useNutritionWorkspace() {
  const value = useContext(NutritionWorkspaceContext);

  if (!value) {
    throw new Error("useNutritionWorkspace must be used inside NutritionWorkspaceProvider");
  }

  return value;
}

function sameRoute(left: NutritionRoute, right: NutritionRoute) {
  if (left.screen !== right.screen) {
    return false;
  }

  if (left.screen === "mealLog" && right.screen === "mealLog") {
    return left.draftKey === right.draftKey;
  }

  return true;
}

function activeDraftKeyFrom(entries: readonly StackEntry[]) {
  const meal = [...entries]
    .reverse()
    .find((entry) => entry.phase !== "exit" && entry.route.screen === "mealLog");

  return meal && meal.route.screen === "mealLog" ? meal.route.draftKey : null;
}

function activeDraft(model: WorkspaceModel, entries: readonly StackEntry[]) {
  const key = activeDraftKeyFrom(entries) ?? model.activeDraftKey;
  return key ? (model.drafts[key] ?? null) : null;
}
