import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  FoodMacroLine,
  NutritionActionBar,
  NutritionPage,
  NutritionTextInput,
  useDangerColors,
} from "../../components/nutrition/NutritionChrome";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { MacronutrientBreakdownCard } from "../../components/MacronutrientBreakdownCard";
import { PressOpacity } from "../../components/PressOpacity";
import { DAILY_NUTRIENT_TARGETS } from "../../constants/nutrition";
import {
  createSavedMeal,
  updateSavedMeal,
} from "../../data/nutritionCatalogRepository";
import {
  createMealLog,
  deleteMealLog,
  getMealCountForDay,
  mealExists,
  updateMealLog,
} from "../../data/nutritionRepository";
import {
  calculateNutrientTotals,
  createId,
  localDayBounds,
  sumExtraTotals,
  zeroNutrientTotals,
} from "../../nutrition/calculations";
import {
  compositionSignature,
  type DraftMealItem,
} from "../../nutrition/drafts";
import { resolveCatalogFood } from "../../services/foodCatalog";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackWarn } from "../../utils/feedback";
import type { NewMealItem } from "../../types/nutrition";

const tokens = themes.dark;

const MEAL_TITLE_PRESETS = [
  "Breakfast",
  "Pre-Training",
  "Post-Training",
  "Lunch",
  "Dinner",
  "Snack",
  "Refuel",
] as const;

export function MealLogScreen({ draftKey }: { draftKey: string }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const dangerColors = useDangerColors();
  const workspace = useNutritionWorkspace();
  const {
    closeToRoot,
    discardDraft,
    drafts,
    flush,
    markNutritionChanged,
    pop,
    push,
    removeDraft,
    setFacts,
    transitioning,
    updateDraft,
  } = workspace;
  const mealDraft = drafts[draftKey] ?? null;
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (
      !mealDraft ||
      mealDraft.mode !== "create" ||
      mealDraft.titleTouched ||
      mealDraft.title
    ) {
      return;
    }

    let cancelled = false;
    const { dayStart, dayEnd } = localDayBounds(new Date(mealDraft.loggedAt));

    void getMealCountForDay(db, dayStart.getTime(), dayEnd.getTime()).then(
      (count) => {
        if (!cancelled) {
          updateDraft(draftKey, (draft) =>
            draft.titleTouched || draft.title
              ? draft
              : { ...draft, title: `Meal #${count + 1}` },
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [db, draftKey, mealDraft, updateDraft]);

  useEffect(() => {
    if (!mealDraft) {
      return;
    }

    const pending = mealDraft.items.filter(
      (item) => item.storagePolicy === "reference" && !item.resolved,
    );

    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      for (const item of pending) {
        if (cancelled) {
          return;
        }

        try {
          const food = await resolveCatalogFood(db, item.food);
          const serving =
            food?.servings.find(
              (candidate) => candidate.id === item.servingId,
            ) ?? food?.servings[0];

          if (!food || !serving || cancelled) {
            continue;
          }

          updateDraft(draftKey, (draft) => ({
            ...draft,
            items: draft.items.map((currentItem) =>
              currentItem.clientId === item.clientId
                ? {
                    ...currentItem,
                    brandName: food.brandName,
                    description: food.name,
                    extrasPerServing: serving.extras,
                    nutrientsPerServing: serving.nutrients,
                    resolved: true,
                    servingAmount: serving.amount,
                    servingDescription: serving.label,
                    servingId: serving.id,
                    servingUnit: serving.unit,
                  }
                : currentItem,
            ),
          }));
        } catch {
          // Keep the stored reference and let the row show that details are unavailable.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, draftKey, mealDraft, updateDraft]);

  if (!mealDraft) {
    return null;
  }

  const editing = mealDraft.mode === "edit";
  const editingSavedTemplate = mealDraft.mode === "savedTemplate";
  const contributions = mealDraft.items.map((item) => ({
    quantity: Number(item.quantityInput),
    nutrientsPerServing: item.nutrientsPerServing,
    extrasPerServing: item.extrasPerServing,
  }));
  const totals =
    mealDraft.items.length === 0
      ? zeroNutrientTotals()
      : calculateNutrientTotals(contributions);
  const extraTotals = sumExtraTotals(
    mealDraft.items.length === 0 ? [] : contributions,
  );
  const signature = compositionSignature(mealDraft);
  const templateSaved =
    mealDraft.savedSignature !== null && mealDraft.savedSignature === signature;
  const itemsValid = mealItemsFromDraft(mealDraft.items);
  const canSaveTemplate =
    !savingTemplate &&
    !templateSaved &&
    mealDraft.title.trim().length > 0 &&
    itemsValid !== null;

  function editItem(item: DraftMealItem) {
    if (transitioning) {
      return;
    }

    setFacts({
      amountInput: item.quantityInput,
      calorieInput: "",
      draftItemId: item.clientId,
      food: item.food,
      inputMode: "amount",
      servingId: item.servingId,
      snapshot:
        item.storagePolicy === "snapshot" && item.description
          ? {
              attribution:
                item.food.source === "openfoodfacts" ? "Open Food Facts" : null,
              brandName: item.brandName,
              defaultServingId: item.servingId,
              name: item.description,
              ref: item.food,
              servings: [
                {
                  amount: item.servingAmount ?? 1,
                  extras: item.extrasPerServing,
                  id: item.servingId,
                  label: item.servingDescription ?? "1 serving",
                  nutrients: item.nutrientsPerServing,
                  unit: item.servingUnit ?? "serving",
                },
              ],
              storagePolicy: "snapshot",
            }
          : null,
    });
    push({ screen: "facts" });
  }

  async function saveTemplate() {
    if (!canSaveTemplate || !itemsValid || savingTemplate) {
      return;
    }

    const operationId = mealDraft.pendingTemplateOperationId ?? createId();
    updateDraft(draftKey, (draft) => ({
      ...draft,
      pendingTemplateOperationId: operationId,
    }));
    setSavingTemplate(true);

    try {
      await flush();
      const savedMealId = mealDraft.savedMealId
        ? mealDraft.savedMealId
        : await createSavedMeal(db, operationId, mealDraft.title, itemsValid);

      if (mealDraft.savedMealId) {
        await updateSavedMeal(db, savedMealId, mealDraft.title, itemsValid);
      }

      updateDraft(draftKey, (draft) => {
        const next = {
          ...draft,
          pendingTemplateOperationId: null,
          savedMealId,
        };
        return {
          ...next,
          savedSignature: compositionSignature(next),
        };
      });
      feedbackConfirm();
      if (editingSavedTemplate) {
        markNutritionChanged();
        pop();
      }
    } catch {
      Alert.alert("Couldn't save meal", "Please try again.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function submitMeal() {
    if (saving || transitioning) {
      return;
    }

    if (!mealDraft.title.trim()) {
      Alert.alert("Meal title required", "Enter a title for this meal.");
      return;
    }

    if (!itemsValid) {
      Alert.alert(
        "Add a food",
        "A meal needs a title and at least one food with a serving greater than zero.",
      );
      return;
    }

    let committed = false;

    try {
      await flush();
      const meal = {
        items: itemsValid,
        loggedAt: mealDraft.loggedAt,
        operationId: mealDraft.operationId,
        savedMealId: mealDraft.savedMealId,
        title: mealDraft.title.trim(),
      };

      if (editing && mealDraft.timelineEntryId) {
        const exists = await mealExists(db, mealDraft.timelineEntryId);

        if (!exists) {
          removeDraft(draftKey);
          workspace.setNotice("That meal is no longer available.");
          await flush();
          closeToRoot();
          return;
        }

        await updateMealLog(db, mealDraft.timelineEntryId, meal);
      } else {
        await createMealLog(db, meal);
      }

      committed = true;
      feedbackConfirm();
      removeDraft(draftKey);
      await flush();
    } catch {
      if (!committed) {
        setSaving(false);
        Alert.alert(
          "Couldn't save meal",
          "The draft is still here. Please try again.",
        );
        return;
      }
    }

    markNutritionChanged();
    closeToRoot();
  }

  function confirmDiscard() {
    feedbackWarn();
    Alert.alert(
      editing ? "Discard changes?" : "Discard draft?",
      editing
        ? "This restores the meal as it was logged. The logged meal stays unchanged."
        : "This clears the meal you are building.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void discardDraft(draftKey);
          },
          style: "destructive",
          text: "Discard",
        },
      ],
    );
  }

  function confirmDelete() {
    if (!mealDraft.timelineEntryId) {
      return;
    }

    feedbackWarn();
    Alert.alert(
      "Delete meal?",
      "This removes the meal from your diary. It cannot be undone.",
      [
        { style: "cancel", text: "Cancel" },
        {
          style: "destructive",
          text: "Delete",
          onPress: () => {
            void (async () => {
              try {
                await deleteMealLog(db, mealDraft.timelineEntryId!);
                removeDraft(draftKey);
                await flush();
                markNutritionChanged();
                closeToRoot();
              } catch {
                Alert.alert("Couldn't delete meal", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }

  const addItemTextColor = readableTextColor(theme.colors.tertiary);

  return (
    <NutritionPage
      footer={
        <NutritionActionBar
          danger={
            editing
              ? {
                  accessibilityLabel: "Delete meal",
                  disabled: saving,
                  label: "Delete Meal",
                  onPress: confirmDelete,
                }
              : undefined
          }
          left={
            editingSavedTemplate
              ? undefined
              : {
                  accessibilityLabel: "Saved meals",
                  label: "Saved Meals",
                  onPress: () => push({ screen: "savedMeals" }),
                }
          }
          right={
            editingSavedTemplate
              ? {
                  accessibilityLabel: "Save saved meal",
                  disabled: !canSaveTemplate || savingTemplate,
                  label: savingTemplate ? "Saving" : "Save Changes",
                  onPress: () => void saveTemplate(),
                }
              : {
                  accessibilityLabel: editing ? "Save changes" : "Log meal",
                  disabled: saving,
                  label: editing ? "Save Changes" : "Log Meal",
                  onPress: () => void submitMeal(),
                }
          }
        />
      }
      onClose={closeToRoot}
      right={
        editingSavedTemplate ? undefined : (
          <LogTimeChanger
            compact
            inline
            label="Change Log Time"
            maximumDate={new Date()}
            onChange={(date) =>
              updateDraft(draftKey, (draft) => ({
                ...draft,
                loggedAt: date.getTime(),
              }))
            }
            value={new Date(mealDraft.loggedAt)}
          />
        )
      }
      title={
        editingSavedTemplate
          ? "Edit Saved Meal"
          : editing
            ? "Edit Meal"
            : "Log Meal"
      }
    >
      {/* Card 1: Meal Identity & Quick Presets */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            MEAL IDENTITY
          </Text>
          <Text style={[styles.cardBadge, { color: theme.colors.tertiary }]}>
            SWIPE PRESETS
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.presetStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {MEAL_TITLE_PRESETS.map((preset) => {
            const selected = mealDraft.title === preset;
            return (
              <PressOpacity
                accessibilityLabel={`Use meal title ${preset}`}
                key={preset}
                onPress={() => {
                  feedbackStep("up");
                  updateDraft(draftKey, (draft) => ({
                    ...draft,
                    title: preset,
                    titleTouched: true,
                  }));
                }}
                silent
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.surfaceMuted,
                    borderColor: selected
                      ? theme.colors.tertiary
                      : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: selected ? addItemTextColor : theme.colors.text },
                  ]}
                >
                  {preset}
                </Text>
              </PressOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.titleRow}>
          <NutritionTextInput
            accessibilityLabel="Meal title"
            maxLength={80}
            onChangeText={(title) =>
              updateDraft(draftKey, (draft) => ({
                ...draft,
                title,
                titleTouched: true,
              }))
            }
            placeholder="Enter meal title"
            style={styles.titleInput}
            value={mealDraft.title}
          />
          <View style={styles.titleActions}>
            <PressOpacity
              accessibilityLabel={templateSaved ? "Meal saved" : "Save meal"}
              disabled={!canSaveTemplate}
              onPress={() => void saveTemplate()}
              style={[
                styles.titleAction,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[styles.titleActionLabel, { color: theme.colors.text }]}
              >
                {templateSaved
                  ? "Saved"
                  : savingTemplate
                    ? "Saving"
                    : "Save Meal"}
              </Text>
            </PressOpacity>
            {editingSavedTemplate ? null : (
              <PressOpacity
                accessibilityLabel="Discard draft"
                onPress={confirmDiscard}
                silent
                style={[
                  styles.titleAction,
                  {
                    backgroundColor: dangerColors.background,
                    borderColor: dangerColors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.titleActionLabel,
                    { color: dangerColors.text },
                  ]}
                >
                  Discard draft
                </Text>
              </PressOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Card 2: Meal Items & Inline Quantity Steppers */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            MEAL ITEMS ({mealDraft.items.length})
          </Text>
          <Text style={[styles.cardBadge, { color: theme.colors.textMuted }]}>
            INLINE +/- SERVINGS
          </Text>
        </View>

        <PressOpacity
          accessibilityLabel="Add meal item"
          onPress={() => push({ screen: "mealItem" })}
          style={[styles.addItem, { backgroundColor: theme.colors.tertiary }]}
        >
          <Ionicons
            color={addItemTextColor}
            name="add-circle-outline"
            size={24}
          />
          <Text style={[styles.addItemLabel, { color: addItemTextColor }]}>
            Add Meal Item
          </Text>
        </PressOpacity>

        <View style={styles.items}>
          {mealDraft.items.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
                Add a food to this meal. You can search, scan a barcode, or use
                a custom food.
              </Text>
            </View>
          ) : (
            mealDraft.items.map((item) => (
              <View
                key={item.clientId}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <PressOpacity
                  accessibilityLabel={`Edit ${item.description ?? "food"}`}
                  onPress={() => editItem(item)}
                  style={styles.itemMain}
                >
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>
                    {item.description ?? "Food details unavailable"}
                  </Text>
                  <Text
                    style={[styles.itemMeta, { color: theme.colors.textMuted }]}
                  >
                    {item.quantityInput} × {item.servingDescription ?? "serving"}
                  </Text>
                  <FoodMacroLine nutrients={scaleLine(item)} />
                </PressOpacity>

                <View style={styles.itemInputRow}>
                  <NutritionTextInput
                    accessibilityLabel={`${item.description ?? "Food"} servings`}
                    keyboardType="decimal-pad"
                    onChangeText={(quantityInput) => updateDraft(draftKey, (draft) => ({
                      ...draft,
                      items: draft.items.map((candidate) => candidate.clientId === item.clientId
                        ? { ...candidate, quantityInput }
                        : candidate),
                    }))}
                    placeholder="1"
                    style={{ flex: 1, fontVariant: ["tabular-nums"] }}
                    value={item.quantityInput}
                  />

                  <PressOpacity
                    accessibilityLabel={`Remove ${item.description ?? "food"}`}
                    onPress={() => {
                      feedbackStep("down");
                      updateDraft(draftKey, (draft) => ({
                        ...draft,
                        items: draft.items.filter(
                          (candidate) => candidate.clientId !== item.clientId,
                        ),
                      }));
                    }}
                    silent
                    style={[
                      styles.remove,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      color={theme.colors.textMuted}
                      name="close"
                      size={18}
                    />
                  </PressOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* Card 3: Meal Totals */}
      <MacronutrientBreakdownCard
        compact
        incomplete={totals.incomplete}
        micronutrients={extraTotals}
        targets={DAILY_NUTRIENT_TARGETS}
        title="Meal totals"
        values={{
          carbohydratesG: totals.carbohydratesG,
          energyKcal: totals.energyKcal,
          fatG: totals.fatG,
          proteinG: totals.proteinG,
        }}
      />
    </NutritionPage>
  );
}

function mealItemsFromDraft(items: DraftMealItem[]): NewMealItem[] | null {
  if (items.length === 0) {
    return null;
  }

  const next: NewMealItem[] = [];

  for (const item of items) {
    const quantity = Number(item.quantityInput);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      item.servingId.length === 0
    ) {
      return null;
    }

    next.push({
      brandName: item.brandName,
      description: item.description,
      extrasPerServing: item.extrasPerServing,
      food: item.food,
      nutrientsPerServing: item.nutrientsPerServing,
      quantity,
      servingAmount: item.servingAmount,
      servingDescription: item.servingDescription,
      servingId: item.servingId,
      servingUnit: item.servingUnit,
      storagePolicy: item.storagePolicy,
    });
  }

  return next;
}

function scaleLine(item: DraftMealItem) {
  const quantity = Number(item.quantityInput);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return item.nutrientsPerServing;
  }

  return {
    carbohydratesG:
      item.nutrientsPerServing.carbohydratesG === null
        ? null
        : item.nutrientsPerServing.carbohydratesG * quantity,
    energyKcal:
      item.nutrientsPerServing.energyKcal === null
        ? null
        : item.nutrientsPerServing.energyKcal * quantity,
    fatG:
      item.nutrientsPerServing.fatG === null
        ? null
        : item.nutrientsPerServing.fatG * quantity,
    proteinG:
      item.nutrientsPerServing.proteinG === null
        ? null
        : item.nutrientsPerServing.proteinG * quantity,
  };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cardBadge: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  presetStrip: {
    gap: 6,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: tokens.spacing.sm,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  titleInput: {
    flexBasis: 140,
    flexGrow: 1,
    fontWeight: "800",
    minHeight: 48,
  },
  titleActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginLeft: "auto",
  },
  titleAction: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  titleActionLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  addItem: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  addItemLabel: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  items: {
    gap: tokens.spacing.sm,
  },
  emptyCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: tokens.spacing.md,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  itemCard: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    paddingLeft: tokens.spacing.md,
    paddingRight: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  itemMain: {
    flex: 1,
    gap: 2,
    paddingVertical: 4,
  },
  itemName: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "800",
  },
  itemMeta: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  itemInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  remove: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
