import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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
  deleteMealLog,
  getMealCountForDay,
  updateMealLog,
} from "../data/nutritionRepository";
import {
  FoodDataCentralError,
  getFoodDetails,
  searchFoods,
} from "../services/foodDataCentralApi";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, themes } from "../theme/theme";
import type {
  DraftMealItem,
  NewMealItem,
  NormalizedFoodDetails,
  NormalizedFoodSearchResult,
  StoredMealLog,
} from "../types/nutrition";
import { FoodServingEditor } from "./FoodServingEditor";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const SEARCH_DEBOUNCE_MS = 400;
const MINIMUM_SEARCH_LENGTH = 2;

type MealLogModalProps = {
  mealToEdit?: StoredMealLog;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

type FoodIdentity = Pick<
  NormalizedFoodSearchResult,
  "brandName" | "description" | "fdcId"
>;

type ServingEditorState = {
  details?: NormalizedFoodDetails;
  food: FoodIdentity;
  itemToEdit?: DraftMealItem;
};

type DetailsError = {
  fdcId: number;
  message: string;
  retryable: boolean;
};

export function MealLogModal({
  mealToEdit,
  onClose,
  onDeleted,
  onSaved,
  visible,
}: MealLogModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [loggedAt, setLoggedAt] = useState(() => new Date());
  const [draftItems, setDraftItems] = useState<DraftMealItem[]>([]);
  const [initializing, setInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [servingEditor, setServingEditor] =
    useState<ServingEditorState | null>(null);

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
  const deletingGuard = useRef(false);

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
    Math.min(620, windowHeight - insets.top - insets.bottom - 32),
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
    setDeleting(false);
    setServingEditor(null);
    savingGuard.current = false;
    deletingGuard.current = false;

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

  const runSearch = useCallback(
    async (query: string) => {
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
    },
    [cancelSearchRequest],
  );

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
    if (savingGuard.current || deletingGuard.current) {
      return;
    }

    if (servingEditor) {
      cancelDetailsRequest();
      setDetailsLoadingFdcId(null);
      setDetailsError(null);
      setServingEditor(null);
      return;
    }

    resetAndCloseModal();
  }

  function resetAndCloseModal() {
    initializationRequestId.current += 1;
    resetSearchDraft();
    savingGuard.current = false;
    deletingGuard.current = false;
    setSaving(false);
    setDeleting(false);
    setServingEditor(null);
    setTitle("");
    setDraftItems([]);
    onClose();
  }

  async function loadDetailsForEditor(
    food: FoodIdentity,
    itemToEdit?: DraftMealItem,
    editorAlreadyOpen = false,
  ) {
    cancelDetailsRequest();

    const currentRequestId = detailsRequestId.current + 1;
    detailsRequestId.current = currentRequestId;
    const controller = new AbortController();
    detailsController.current = controller;

    setDetailsLoadingFdcId(food.fdcId);
    setDetailsError(null);

    try {
      const details = await getFoodDetails(food.fdcId, controller.signal);

      if (detailsRequestId.current !== currentRequestId) {
        return;
      }

      if (editorAlreadyOpen) {
        setServingEditor((currentEditor) =>
          currentEditor?.food.fdcId === food.fdcId
            ? { ...currentEditor, details }
            : currentEditor,
        );
      } else {
        resetSearchDraft();
        setServingEditor({ details, food, itemToEdit });
      }
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
          fdcId: food.fdcId,
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

  function openFoodEditor(item: DraftMealItem) {
    const food = {
      brandName: item.brandName,
      description: item.description,
      fdcId: item.fdcId,
    };

    resetSearchDraft();
    setServingEditor({ food, itemToEdit: item });

    if (item.nutrientBasis && item.servingOptions?.length) {
      return;
    }

    void loadDetailsForEditor(food, item, true);
  }

  function selectSearchResult(result: NormalizedFoodSearchResult) {
    const existingItem = draftItems.find(
      (item) => item.fdcId === result.fdcId,
    );

    if (existingItem) {
      openFoodEditor(existingItem);
      return;
    }

    void loadDetailsForEditor(result);
  }

  function confirmFood(item: DraftMealItem) {
    setDraftItems((currentItems) =>
      currentItems.some((currentItem) => currentItem.fdcId === item.fdcId)
        ? currentItems.map((currentItem) =>
            currentItem.fdcId === item.fdcId ? item : currentItem,
          )
        : [...currentItems, item],
    );
    cancelDetailsRequest();
    setDetailsLoadingFdcId(null);
    setDetailsError(null);
    setServingEditor(null);
  }

  function retryEditorDetails() {
    if (!servingEditor) {
      return;
    }

    void loadDetailsForEditor(
      servingEditor.food,
      servingEditor.itemToEdit,
      true,
    );
  }

  function removeFood(fdcId: number) {
    setDraftItems((currentItems) =>
      currentItems.filter((item) => item.fdcId !== fdcId),
    );
  }

  async function saveMeal() {
    if (
      savingGuard.current ||
      deletingGuard.current ||
      detailsController.current !== null
    ) {
      return;
    }

    const trimmedTitle = title.trim();
    const loggedAtTime = loggedAt.getTime();

    if (!trimmedTitle) {
      Alert.alert("Meal title required", "Enter a title for this meal.");
      return;
    }

    if (!Number.isFinite(loggedAtTime)) {
      Alert.alert("Invalid meal time", "Choose a valid date and time.");
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

  async function deleteExistingMeal() {
    if (
      !mealToEdit ||
      deletingGuard.current ||
      savingGuard.current
    ) {
      return;
    }

    deletingGuard.current = true;
    setDeleting(true);

    try {
      await deleteMealLog(db, mealToEdit.timelineEntryId);
      await onDeleted?.();
      resetAndCloseModal();
    } catch {
      deletingGuard.current = false;
      setDeleting(false);
      Alert.alert("Couldn't delete meal", "Please try again.");
    }
  }

  function confirmDeleteMeal() {
    Alert.alert("Delete meal?", "This cannot be undone.", [
      {
        style: "cancel",
        text: "Cancel",
      },
      {
        onPress: () => {
          void deleteExistingMeal();
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  const searchText = searchQuery.trim();
  const searchDropdownOpen =
    searchText.length >= MINIMUM_SEARCH_LENGTH &&
    (searchLoading ||
      searchError !== null ||
      lastSubmittedQuery.length > 0);
  const busy = saving || deleting;

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
            servingEditor && styles.servingModal,
            {
              backgroundColor: theme.colors.surface,
              maxHeight: modalMaxHeight,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {servingEditor
                ? "Configure Food"
                : mealToEdit
                  ? "Edit Meal"
                  : "Log Meal"}
            </Text>
          </View>

          <MealModalBody configuringFood={servingEditor !== null}>
            {servingEditor ? (
              <FoodServingEditor
                details={servingEditor.details}
                detailsError={
                  detailsError?.fdcId === servingEditor.food.fdcId
                    ? detailsError.message
                    : null
                }
                detailsLoading={
                  detailsLoadingFdcId === servingEditor.food.fdcId
                }
                food={servingEditor.food}
                itemToEdit={servingEditor.itemToEdit}
                onCancel={closeModal}
                onConfirm={confirmFood}
                onRetryDetails={
                  detailsError?.fdcId === servingEditor.food.fdcId &&
                  detailsError.retryable
                    ? retryEditorDetails
                    : undefined
                }
              />
            ) : initializing ? (
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
                <View style={styles.titleTimeRow}>
                  <View style={styles.titleField}>
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
                  </View>

                  {visible ? (
                    <View style={styles.timeField}>
                      <LogTimeChanger
                        allowDateChange
                        onChange={setLoggedAt}
                        value={loggedAt}
                      />
                    </View>
                  ) : null}
                </View>

                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                  >
                    Foods
                  </Text>
                  <View
                    style={[
                      styles.searchControl,
                      {
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: theme.colors.surfaceMuted,
                      },
                    ]}
                  >
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
                        styles.searchInput,
                        { color: theme.colors.text },
                      ]}
                      value={searchQuery}
                    />

                    {searchDropdownOpen ? (
                      <View
                        style={[
                          styles.searchDropdown,
                          { borderTopColor: theme.colors.border },
                        ]}
                      >
                        {searchLoading ? (
                          <View style={styles.searchState}>
                            <ActivityIndicator
                              color={theme.colors.tertiary}
                            />
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
                              <Text
                                style={{ color: theme.colors.tertiary }}
                              >
                                Retry
                              </Text>
                            </PressOpacity>
                          </View>
                        ) : searchResults.length === 0 ? (
                          <View style={styles.searchState}>
                            <Text
                              style={[
                                styles.helpText,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              No foods found.
                            </Text>
                          </View>
                        ) : (
                          <ScrollView
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                            style={styles.searchResults}
                          >
                            {searchResults.map((result, index) => {
                              const resultError =
                                detailsError?.fdcId === result.fdcId
                                  ? detailsError
                                  : null;
                              const loadingDetails =
                                detailsLoadingFdcId === result.fdcId;

                              return (
                                <View
                                  key={result.fdcId}
                                  style={[
                                    styles.searchResult,
                                    index > 0
                                      ? {
                                          borderTopColor:
                                            theme.colors.border,
                                          borderTopWidth: 1,
                                        }
                                      : null,
                                  ]}
                                >
                                  <View
                                    accessibilityLabel={formatSearchResultAccessibility(
                                      result,
                                      resultError?.message,
                                    )}
                                    accessible
                                    style={styles.resultText}
                                  >
                                    <Text
                                      style={[
                                        styles.resultTitle,
                                        { color: theme.colors.text },
                                      ]}
                                    >
                                      {result.description}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.resultSubtitle,
                                        {
                                          color: resultError
                                            ? appColorPalette.red
                                            : theme.colors.textMuted,
                                        },
                                      ]}
                                    >
                                      {resultError?.message ??
                                        result.brandName ??
                                        result.dataType}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.resultMeta,
                                        { color: theme.colors.textMuted },
                                      ]}
                                    >
                                      {result.preview.basisLabel}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.resultNutrients,
                                        { color: theme.colors.textMuted },
                                      ]}
                                    >
                                      {formatSearchPreview(result)}
                                    </Text>
                                  </View>

                                  <PressOpacity
                                    accessibilityLabel={
                                      resultError?.retryable
                                        ? `Retry adding ${result.description}`
                                        : resultError
                                          ? `${result.description}. ${resultError.message}`
                                          : `Configure ${result.description}`
                                    }
                                    disabled={
                                      detailsLoadingFdcId !== null ||
                                      (resultError !== null &&
                                        !resultError.retryable)
                                    }
                                    onPress={() =>
                                      selectSearchResult(result)
                                    }
                                    style={styles.resultActionButton}
                                  >
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
                                </View>
                              );
                            })}
                          </ScrollView>
                        )}
                      </View>
                    ) : null}
                  </View>

                  {searchText.length < MINIMUM_SEARCH_LENGTH ? (
                    <Text
                      style={[
                        styles.helpText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Enter at least two characters.
                    </Text>
                  ) : null}
                </View>

                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: theme.colors.text }]}
                  >
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
                          <PressOpacity
                            accessibilityLabel={`Edit ${item.description}`}
                            onPress={() => openFoodEditor(item)}
                            style={styles.draftItemEdit}
                          >
                            <Text
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
                            <Text
                              style={[
                                styles.servingText,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {item.quantityInput} {"\u00d7"}{" "}
                              {item.servingDescription}
                            </Text>

                            <View style={styles.nutrientRow}>
                              <NutrientValue
                                label="kcal"
                                quantityInput={item.quantityInput}
                                value={
                                  item.nutrientsPerServing.energyKcal
                                }
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
                                value={
                                  item.nutrientsPerServing
                                    .carbohydratesG
                                }
                              />
                              <NutrientValue
                                label="F"
                                quantityInput={item.quantityInput}
                                unit="g"
                                value={item.nutrientsPerServing.fatG}
                              />
                            </View>
                          </PressOpacity>

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
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </MealModalBody>

          {!servingEditor ? (
            <View
              style={[
                styles.actions,
                { borderTopColor: theme.colors.border },
              ]}
            >
              {mealToEdit ? (
                <PressOpacity
                  accessibilityLabel="Delete meal"
                  disabled={busy}
                  onPress={confirmDeleteMeal}
                  style={[styles.actionButton, styles.deleteAction]}
                >
                  {deleting ? (
                    <ActivityIndicator
                      color={appColorPalette.red}
                      size="small"
                    />
                  ) : (
                    <Text style={{ color: appColorPalette.red }}>
                      Delete Entry
                    </Text>
                  )}
                </PressOpacity>
              ) : null}

              <PressOpacity
                accessibilityLabel="Cancel meal log"
                disabled={busy}
                onPress={closeModal}
                style={styles.actionButton}
              >
                <Text style={{ color: theme.colors.textMuted }}>
                  Cancel
                </Text>
              </PressOpacity>

              <PressOpacity
                accessibilityLabel={
                  mealToEdit ? "Save meal changes" : "Log meal"
                }
                disabled={
                  initializing ||
                  initializationError ||
                  busy ||
                  detailsLoadingFdcId !== null
                }
                onPress={() => void saveMeal()}
                style={styles.actionButton}
              >
                {saving ? (
                  <ActivityIndicator
                    color={theme.colors.tertiary}
                    size="small"
                  />
                ) : (
                  <Text style={{ color: theme.colors.tertiary }}>
                    {mealToEdit ? "Save Changes" : "Log Meal"}
                  </Text>
                )}
              </PressOpacity>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MealModalBody({
  children,
  configuringFood,
}: {
  children: ReactNode;
  configuringFood: boolean;
}) {
  if (configuringFood) {
    return <View style={styles.servingBody}>{children}</View>;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.bodyScroll}
    >
      {children}
    </ScrollView>
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

function getLocalDayBounds(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return { dayEnd, dayStart };
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

function formatSearchPreview(result: NormalizedFoodSearchResult) {
  const nutrients = result.preview.nutrients;

  return [
    `${formatNutrient(nutrients.energyKcal, true)} kcal`,
    `P ${formatNutrient(nutrients.proteinG, false)} g`,
    `C ${formatNutrient(nutrients.carbohydratesG, false)} g`,
    `F ${formatNutrient(nutrients.fatG, false)} g`,
  ].join(" \u00b7 ");
}

function formatSearchResultAccessibility(
  result: NormalizedFoodSearchResult,
  errorMessage?: string,
) {
  const nutrients = result.preview.nutrients;
  const nutrientSummary = [
    formatAccessibleNutrient(
      "Energy",
      nutrients.energyKcal,
      "kilocalories",
      true,
    ),
    formatAccessibleNutrient(
      "Protein",
      nutrients.proteinG,
      "grams",
      false,
    ),
    formatAccessibleNutrient(
      "Carbohydrates",
      nutrients.carbohydratesG,
      "grams",
      false,
    ),
    formatAccessibleNutrient(
      "Fat",
      nutrients.fatG,
      "grams",
      false,
    ),
  ].join(", ");

  return [
    result.description,
    result.brandName ?? result.dataType,
    result.preview.basisLabel,
    nutrientSummary,
    errorMessage,
  ]
    .filter((value): value is string => Boolean(value))
    .join(". ");
}

function formatAccessibleNutrient(
  label: string,
  value: number | null,
  unit: string,
  wholeNumber: boolean,
) {
  return value === null
    ? `${label} unavailable`
    : `${label} ${formatNutrient(value, wholeNumber)} ${unit}`;
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
  servingModal: {
    flex: 1,
  },
  servingBody: {
    flex: 1,
    minHeight: 0,
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
  titleTimeRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  titleField: {
    flex: 1,
    minWidth: 0,
  },
  timeField: {
    width: 120,
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
  searchControl: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchInput: {
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  searchDropdown: {
    borderTopWidth: 1,
  },
  searchResults: {
    maxHeight: 272,
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
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 56,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
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
  resultMeta: {
    fontSize: 11,
    lineHeight: 15,
    paddingTop: 2,
  },
  resultNutrients: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  resultActionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
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
  draftItemEdit: {
    flex: 1,
    gap: tokens.spacing.xs,
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
  servingText: {
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
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
    marginTop: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  deleteAction: {
    marginRight: "auto",
  },
});
