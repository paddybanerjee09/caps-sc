import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createMealLog,
  getMealCountForDay,
  updateMealLog,
} from "../data/nutritionRepository";
import {
  FoodDataCentralError,
  getFoodDetails,
  searchFoods,
} from "../services/foodDataCentralApi";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  NewMealItem,
  NormalizedFoodDetails,
  NormalizedFoodSearchResult,
  NutrientSnapshot,
  StoredMealLog,
} from "../types/nutrition";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const SEARCH_DEBOUNCE_MS = 400;
const MINIMUM_SEARCH_LENGTH = 2;

type MealLogModalProps = {
  mealToEdit?: StoredMealLog;
  onClose: () => void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

type EditableMealItem = Omit<NewMealItem, "quantity"> & {
  quantityInput: string;
};

type DetailsError = {
  fdcId: number;
  message: string;
  retryable: boolean;
};

export function MealLogModal({
  mealToEdit,
  onClose,
  onSaved,
  visible,
}: MealLogModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [loggedAt, setLoggedAt] = useState(() => new Date());
  const [draftItems, setDraftItems] = useState<EditableMealItem[]>([]);
  const [initializing, setInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    NormalizedFoodSearchResult[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");
  const [detailsLoadingFdcId, setDetailsLoadingFdcId] = useState<number | null>(
    null,
  );
  const [detailsError, setDetailsError] = useState<DetailsError | null>(null);

  const initializationRequestId = useRef(0);
  const searchRequestId = useRef(0);
  const detailsRequestId = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const detailsController = useRef<AbortController | null>(null);
  const savingGuard = useRef(false);

  const cancelSearchRequest = useCallback(() => {
    searchRequestId.current += 1;
    searchController.current?.abort();
    searchController.current = null;
  }, []);

  const cancelDetailsRequest = useCallback(() => {
    detailsRequestId.current += 1;
    detailsController.current?.abort();
    detailsController.current = null;
  }, []);

  const resetSearchDraft = useCallback(() => {
    cancelSearchRequest();
    cancelDetailsRequest();
    setSearchQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setLastSubmittedQuery("");
    setDetailsLoadingFdcId(null);
    setDetailsError(null);
  }, [cancelDetailsRequest, cancelSearchRequest]);

  const modalMaxHeight = Math.max(
    1,
    Math.min(680, windowHeight - insets.top - insets.bottom - 32),
  );

  const initializeCreateDraft = useCallback(async () => {
    const currentRequestId = initializationRequestId.current + 1;
    initializationRequestId.current = currentRequestId;
    const openedAt = new Date();
    const { dayStart, dayEnd } = getLocalDayBounds(openedAt);

    setInitializing(true);
    setInitializationError(false);
    setTitle("");
    setLoggedAt(openedAt);
    setDraftItems([]);

    try {
      const mealCount = await getMealCountForDay(
        db,
        dayStart.getTime(),
        dayEnd.getTime(),
      );

      if (initializationRequestId.current === currentRequestId) {
        setTitle(`Meal #${mealCount + 1}`);
      }
    } catch {
      if (initializationRequestId.current === currentRequestId) {
        setInitializationError(true);
      }
    } finally {
      if (initializationRequestId.current === currentRequestId) {
        setInitializing(false);
      }
    }
  }, [db]);

  useEffect(() => {
    if (!visible) {
      initializationRequestId.current += 1;
      return;
    }

    resetSearchDraft();
    setSaving(false);
    savingGuard.current = false;

    if (mealToEdit) {
      initializationRequestId.current += 1;
      setInitializing(false);
      setInitializationError(false);
      setTitle(mealToEdit.title);
      setLoggedAt(new Date(mealToEdit.loggedAt));
      setDraftItems(
        mealToEdit.items.map((item) => ({
          brandName: item.brandName,
          description: item.description,
          fdcId: item.fdcId,
          nutrientsPerServing: { ...item.nutrientsPerServing },
          quantityInput: formatQuantityInput(item.quantity),
          servingAmount: item.servingAmount,
          servingDescription: item.servingDescription,
          servingUnit: item.servingUnit,
        })),
      );
    } else {
      void initializeCreateDraft();
    }

    return () => {
      initializationRequestId.current += 1;
      cancelSearchRequest();
      cancelDetailsRequest();
    };
  }, [
    cancelDetailsRequest,
    cancelSearchRequest,
    initializeCreateDraft,
    mealToEdit,
    resetSearchDraft,
    visible,
  ]);

  const runSearch = useCallback(async (query: string) => {
    cancelSearchRequest();

    const currentRequestId = searchRequestId.current + 1;
    searchRequestId.current = currentRequestId;
    const controller = new AbortController();
    searchController.current = controller;

    setLastSubmittedQuery(query);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const results = await searchFoods(query, controller.signal);

      if (searchRequestId.current === currentRequestId) {
        setSearchResults(results);
      }
    } catch (error) {
      if (
        searchRequestId.current === currentRequestId &&
        !isAbortError(error)
      ) {
        setSearchError(getFoodDataErrorMessage(error, "search"));
      }
    } finally {
      if (searchRequestId.current === currentRequestId) {
        setSearchLoading(false);
        searchController.current = null;
      }
    }
  }, [cancelSearchRequest]);

  useEffect(() => {
    if (!visible) {
      cancelSearchRequest();
      return;
    }

    const query = searchQuery.trim();
    cancelSearchRequest();
    setSearchError(null);
    setSearchResults([]);
    setLastSubmittedQuery("");

    if (query.length < MINIMUM_SEARCH_LENGTH) {
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [cancelSearchRequest, runSearch, searchQuery, visible]);

  const parsedDraftItems = useMemo(
    () =>
      draftItems.map((item) => ({
        item,
        quantity: Number(item.quantityInput),
      })),
    [draftItems],
  );

  function closeModal() {
    if (savingGuard.current) {
      return;
    }

    resetAndCloseModal();
  }

  function resetAndCloseModal() {
    initializationRequestId.current += 1;
    resetSearchDraft();
    savingGuard.current = false;
    setSaving(false);
    setTitle("");
    setDraftItems([]);
    onClose();
  }

  async function addFood(result: NormalizedFoodSearchResult) {
    if (draftItems.some((item) => item.fdcId === result.fdcId)) {
      setDraftItems((currentItems) =>
        incrementDraftItem(currentItems, result.fdcId),
      );
      return;
    }

    cancelDetailsRequest();

    const currentRequestId = detailsRequestId.current + 1;
    detailsRequestId.current = currentRequestId;
    const controller = new AbortController();
    detailsController.current = controller;

    setDetailsLoadingFdcId(result.fdcId);
    setDetailsError(null);

    try {
      const details = await getFoodDetails(result.fdcId, controller.signal);

      if (detailsRequestId.current !== currentRequestId) {
        return;
      }

      if (!hasAnyNutrient(details.nutrientsPerServing)) {
        setDetailsError({
          fdcId: result.fdcId,
          message: "Nutrition data is unavailable for this food.",
          retryable: false,
        });
        return;
      }

      setDraftItems((currentItems) =>
        addOrIncrementDraftItem(currentItems, details),
      );
    } catch (error) {
      if (
        detailsRequestId.current === currentRequestId &&
        !isAbortError(error)
      ) {
        const unavailable =
          error instanceof FoodDataCentralError &&
          (error.code === "unavailable-serving" ||
            error.code === "unavailable-nutrients");

        setDetailsError({
          fdcId: result.fdcId,
          message: getFoodDataErrorMessage(error, "details"),
          retryable: !unavailable,
        });
      }
    } finally {
      if (detailsRequestId.current === currentRequestId) {
        setDetailsLoadingFdcId(null);
        detailsController.current = null;
      }
    }
  }

  function changeQuantity(fdcId: number, value: string) {
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setDraftItems((currentItems) =>
      currentItems.map((item) =>
        item.fdcId === fdcId ? { ...item, quantityInput: value } : item,
      ),
    );
  }

  function removeFood(fdcId: number) {
    setDraftItems((currentItems) =>
      currentItems.filter((item) => item.fdcId !== fdcId),
    );
  }

  async function saveMeal() {
    if (savingGuard.current || detailsController.current !== null) {
      return;
    }

    const trimmedTitle = title.trim();
    const loggedAtTime = loggedAt.getTime();
    const now = new Date();

    if (!trimmedTitle) {
      Alert.alert("Meal title required", "Enter a title for this meal.");
      return;
    }

    if (
      !Number.isFinite(loggedAtTime) ||
      loggedAtTime > now.getTime() ||
      !isSameLocalDay(loggedAt, now)
    ) {
      Alert.alert(
        "Invalid meal time",
        "Meal logs must use a time from today that has already passed.",
      );
      return;
    }

    if (draftItems.length === 0) {
      Alert.alert("Add a food", "A meal must contain at least one food.");
      return;
    }

    if (
      parsedDraftItems.some(
        ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0,
      )
    ) {
      Alert.alert(
        "Invalid quantity",
        "Every serving quantity must be greater than zero.",
      );
      return;
    }

    const items: NewMealItem[] = parsedDraftItems.map(({ item, quantity }) => ({
      brandName: item.brandName,
      description: item.description,
      fdcId: item.fdcId,
      nutrientsPerServing: { ...item.nutrientsPerServing },
      quantity,
      servingAmount: item.servingAmount,
      servingDescription: item.servingDescription,
      servingUnit: item.servingUnit,
    }));

    savingGuard.current = true;
    setSaving(true);

    try {
      const meal = {
        items,
        loggedAt: loggedAtTime,
        title: trimmedTitle,
      };

      if (mealToEdit) {
        await updateMealLog(db, mealToEdit.timelineEntryId, meal);
      } else {
        await createMealLog(db, meal);
      }

      await onSaved?.(loggedAtTime);
      resetAndCloseModal();
    } catch {
      savingGuard.current = false;
      setSaving(false);
      Alert.alert("Couldn't save meal", "Please try again.");
    }
  }

  const searchText = searchQuery.trim();

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.overlay,
          {
            backgroundColor: theme.colors.overlay,
            paddingBottom: Math.max(tokens.spacing.lg, insets.bottom),
            paddingTop: Math.max(tokens.spacing.lg, insets.top),
          },
        ]}
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.surface,
              maxHeight: modalMaxHeight,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {mealToEdit ? "Edit Meal" : "Log Meal"}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.bodyScroll}
          >
            {initializing ? (
              <View style={styles.initializationState}>
                <ActivityIndicator color={theme.colors.tertiary} />
              </View>
            ) : initializationError ? (
              <View style={styles.initializationState}>
                <Text style={[styles.stateText, { color: theme.colors.text }]}>
                  {"Couldn't prepare a new meal."}
                </Text>
                <PressOpacity
                  accessibilityLabel="Retry preparing meal"
                  onPress={() => void initializeCreateDraft()}
                  style={styles.retryButton}
                >
                  <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
                </PressOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.label, { color: theme.colors.text }]}>
                  Title
                </Text>
                <TextInput
                  accessibilityLabel="Meal title"
                  maxLength={50}
                  onChangeText={setTitle}
                  placeholder="Meal title"
                  placeholderTextColor={theme.colors.textMuted}
                  selectionColor={theme.colors.tertiary}
                  style={[
                    styles.textInput,
                    {
                      borderColor: theme.colors.borderStrong,
                      color: theme.colors.text,
                    },
                  ]}
                  value={title}
                />

                <View style={styles.timeSection}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Time
                  </Text>
                  {visible ? (
                    <LogTimeChanger
                      maximumDate={new Date()}
                      onChange={setLoggedAt}
                      value={loggedAt}
                    />
                  ) : null}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Foods
                  </Text>
                  <TextInput
                    accessibilityLabel="Search foods"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setSearchQuery}
                    placeholder="Search USDA foods"
                    placeholderTextColor={theme.colors.textMuted}
                    returnKeyType="search"
                    selectionColor={theme.colors.tertiary}
                    style={[
                      styles.textInput,
                      {
                        borderColor: theme.colors.borderStrong,
                        color: theme.colors.text,
                      },
                    ]}
                    value={searchQuery}
                  />

                  {searchText.length < MINIMUM_SEARCH_LENGTH ? (
                    <Text
                      style={[
                        styles.helpText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Enter at least two characters.
                    </Text>
                  ) : searchLoading ? (
                    <View style={styles.searchState}>
                      <ActivityIndicator color={theme.colors.tertiary} />
                    </View>
                  ) : searchError ? (
                    <View style={styles.searchState}>
                      <Text
                        style={[
                          styles.stateText,
                          { color: theme.colors.text },
                        ]}
                      >
                        {searchError}
                      </Text>
                      <PressOpacity
                        accessibilityLabel="Retry food search"
                        onPress={() =>
                          void runSearch(
                            lastSubmittedQuery || searchQuery.trim(),
                          )
                        }
                        style={styles.retryButton}
                      >
                        <Text style={{ color: theme.colors.tertiary }}>
                          Retry
                        </Text>
                      </PressOpacity>
                    </View>
                  ) : lastSubmittedQuery && searchResults.length === 0 ? (
                    <Text
                      style={[
                        styles.helpText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      No foods found.
                    </Text>
                  ) : (
                    searchResults.map((result) => {
                      const resultError =
                        detailsError?.fdcId === result.fdcId
                          ? detailsError
                          : null;
                      const loadingDetails =
                        detailsLoadingFdcId === result.fdcId;

                      return (
                        <PressOpacity
                          accessibilityLabel={
                           resultError?.retryable
                              ? `Retry adding ${result.description}`
                              : resultError
                                ? `${result.description}. ${resultError.message}`
                                : `Add ${result.description}`
                          }
                          disabled={
                            detailsLoadingFdcId !== null ||
                            (resultError !== null && !resultError.retryable)
                          }
                          key={result.fdcId}
                          onPress={() => void addFood(result)}
                          style={[
                            styles.searchResult,
                            {
                              backgroundColor: theme.colors.surfaceMuted,
                              borderColor: theme.colors.border,
                            },
                          ]}
                        >
                          <View style={styles.resultText}>
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.resultTitle,
                                { color: theme.colors.text },
                              ]}
                            >
                              {result.description}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.resultSubtitle,
                                {
                                  color: resultError
                                    ? theme.colors.tertiary
                                    : theme.colors.textMuted,
                                },
                              ]}
                            >
                              {resultError?.message ??
                                result.brandName ??
                                result.dataType}
                            </Text>
                          </View>

                          {loadingDetails ? (
                            <ActivityIndicator
                              color={theme.colors.tertiary}
                              size="small"
                            />
                          ) : (
                            <Text
                              style={[
                                styles.resultAction,
                                {
                                  color: resultError
                                    ? theme.colors.textMuted
                                    : theme.colors.tertiary,
                                },
                              ]}
                            >
                              {resultError?.retryable
                                ? "Retry"
                                : resultError
                                  ? "Unavailable"
                                  : "Add"}
                            </Text>
                          )}
                        </PressOpacity>
                      );
                    })
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    Selected foods
                  </Text>

                  {draftItems.length === 0 ? (
                    <Text
                      style={[
                        styles.helpText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Search for and add at least one food.
                    </Text>
                  ) : (
                    draftItems.map((item) => (
                      <View
                        key={item.fdcId}
                        style={[
                          styles.draftItem,
                          {
                            backgroundColor: theme.colors.surfaceMuted,
                            borderColor: theme.colors.border,
                          },
                        ]}
                      >
                        <View style={styles.draftItemHeader}>
                          <View style={styles.draftItemTitleGroup}>
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.resultTitle,
                                { color: theme.colors.text },
                              ]}
                            >
                              {item.description}
                            </Text>
                            {item.brandName ? (
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.resultSubtitle,
                                  { color: theme.colors.textMuted },
                                ]}
                              >
                                {item.brandName}
                              </Text>
                            ) : null}
                          </View>

                          <PressOpacity
                            accessibilityLabel={`Remove ${item.description}`}
                            onPress={() => removeFood(item.fdcId)}
                            style={styles.removeButton}
                          >
                            <Ionicons
                              color={theme.colors.textMuted}
                              name="close"
                              size={20}
                            />
                          </PressOpacity>
                        </View>

                        <View style={styles.quantityRow}>
                          <TextInput
                            accessibilityLabel={`Serving quantity for ${item.description}`}
                            keyboardType="decimal-pad"
                            onChangeText={(value) =>
                              changeQuantity(item.fdcId, value)
                            }
                            placeholder="1"
                            placeholderTextColor={theme.colors.textMuted}
                            selectionColor={theme.colors.tertiary}
                            style={[
                              styles.quantityInput,
                              {
                                borderColor: theme.colors.borderStrong,
                                color: theme.colors.text,
                              },
                            ]}
                            value={item.quantityInput}
                          />
                          <Text
                            numberOfLines={2}
                            style={[
                              styles.servingText,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {"\u00d7"} {item.servingDescription}
                          </Text>
                        </View>

                        <View style={styles.nutrientRow}>
                          <NutrientValue
                            label="kcal"
                            quantityInput={item.quantityInput}
                            value={item.nutrientsPerServing.energyKcal}
                          />
                          <NutrientValue
                            label="P"
                            quantityInput={item.quantityInput}
                            unit="g"
                            value={item.nutrientsPerServing.proteinG}
                          />
                          <NutrientValue
                            label="C"
                            quantityInput={item.quantityInput}
                            unit="g"
                            value={item.nutrientsPerServing.carbohydratesG}
                          />
                          <NutrientValue
                            label="F"
                            quantityInput={item.quantityInput}
                            unit="g"
                            value={item.nutrientsPerServing.fatG}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <View
            style={[styles.actions, { borderTopColor: theme.colors.border }]}
          >
            <PressOpacity
              accessibilityLabel="Cancel meal log"
              disabled={saving}
              onPress={closeModal}
              style={styles.actionButton}
            >
              <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
            </PressOpacity>

            <PressOpacity
              accessibilityLabel={
                mealToEdit ? "Save meal changes" : "Log meal"
              }
              disabled={
                initializing ||
                initializationError ||
                saving ||
                detailsLoadingFdcId !== null
              }
              onPress={() => void saveMeal()}
              style={styles.actionButton}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.tertiary} size="small" />
              ) : (
                <Text style={{ color: theme.colors.tertiary }}>
                  {mealToEdit ? "Save Changes" : "Log Meal"}
                </Text>
              )}
            </PressOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function NutrientValue({
  label,
  quantityInput,
  unit = "",
  value,
}: {
  label: string;
  quantityInput: string;
  unit?: string;
  value: number | null;
}) {
  const { theme } = useAppTheme();
  const quantity = Number(quantityInput);
  const total =
    value === null || !Number.isFinite(quantity) || quantity <= 0
      ? null
      : value * quantity;

  return (
    <Text style={[styles.nutrientText, { color: theme.colors.textMuted }]}>
      {label} {formatNutrient(total, label === "kcal")}
      {total === null ? "" : unit}
    </Text>
  );
}

function addOrIncrementDraftItem(
  currentItems: EditableMealItem[],
  details: NormalizedFoodDetails,
) {
  const existingItem = currentItems.find(
    (item) => item.fdcId === details.fdcId,
  );

  if (existingItem) {
    return incrementDraftItem(currentItems, details.fdcId);
  }

  return [
    ...currentItems,
    {
      brandName: details.brandName,
      description: details.description,
      fdcId: details.fdcId,
      nutrientsPerServing: { ...details.nutrientsPerServing },
      quantityInput: "1",
      servingAmount: details.servingAmount,
      servingDescription: details.servingDescription,
      servingUnit: details.servingUnit,
    },
  ];
}

function incrementDraftItem(
  currentItems: EditableMealItem[],
  fdcId: number,
) {
  return currentItems.map((item) => {
    if (item.fdcId !== fdcId) {
      return item;
    }

    const currentQuantity = Number(item.quantityInput);
    return {
      ...item,
      quantityInput: formatQuantityInput(
        Number.isFinite(currentQuantity) && currentQuantity > 0
          ? currentQuantity + 1
          : 1,
      ),
    };
  });
}

function getLocalDayBounds(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return { dayEnd, dayStart };
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function hasAnyNutrient(nutrients: NutrientSnapshot) {
  return Object.values(nutrients).some((value) => value !== null);
}

function formatQuantityInput(quantity: number) {
  return Number.isInteger(quantity)
    ? quantity.toFixed(0)
    : String(Number(quantity.toFixed(3)));
}

function formatNutrient(value: number | null, wholeNumber: boolean) {
  if (value === null || !Number.isFinite(value)) {
    return "\u2014";
  }

  return value.toLocaleString([], {
    maximumFractionDigits: wholeNumber ? 0 : 1,
    minimumFractionDigits: 0,
  });
}

function getFoodDataErrorMessage(
  error: unknown,
  operation: "details" | "search",
) {
  if (!(error instanceof FoodDataCentralError)) {
    return operation === "search"
      ? "Couldn't search foods. Check your connection."
      : "Couldn't load this food. Please try again.";
  }

  switch (error.code) {
    case "missing-key":
      return "Food search isn't configured.";
    case "rate-limit":
      return "USDA's request limit was reached. Try again later.";
    case "network":
      return "Couldn't reach USDA. Check your connection.";
    case "unavailable-nutrients":
      return "Calories and macronutrients are unavailable for this food.";
    case "unavailable-serving":
      return "A usable serving is unavailable for this food.";
    case "http":
    case "invalid-response":
      return operation === "search"
        ? "Couldn't search USDA foods. Please try again."
        : "Couldn't load this food. Please try again.";
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    flexShrink: 1,
    overflow: "hidden",
    width: "100%",
    maxWidth: 520,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    padding: tokens.spacing.lg,
  },
  bodyScroll: {
    flexShrink: 1,
  },
  initializationState: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 180,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    paddingBottom: tokens.spacing.xs,
  },
  textInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  timeSection: {
    alignItems: "center",
    paddingTop: tokens.spacing.md,
  },
  section: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  helpText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  searchState: {
    alignItems: "center",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 64,
  },
  retryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  searchResult: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    minHeight: 56,
    padding: tokens.spacing.md,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "600",
    lineHeight: tokens.typography.body.lineHeight,
  },
  resultSubtitle: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  resultAction: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
  },
  draftItem: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  draftItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  draftItemTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  removeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    marginRight: -tokens.spacing.sm,
    marginTop: -tokens.spacing.sm,
  },
  quantityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  quantityInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
    textAlign: "center",
    width: 72,
  },
  servingText: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  nutrientRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  nutrientText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  actions: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.lg,
    justifyContent: "flex-end",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
});
