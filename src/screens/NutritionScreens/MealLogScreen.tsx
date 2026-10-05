import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

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
import { createSavedMeal } from "../../data/nutritionCatalogRepository";
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
import type { NewMealItem } from "../../types/nutrition";

const tokens = themes.dark;

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
    if (!mealDraft || mealDraft.mode !== "create" || mealDraft.titleTouched || mealDraft.title) {
      return;
    }

    let cancelled = false;
    const { dayStart, dayEnd } = localDayBounds(new Date(mealDraft.loggedAt));

    void getMealCountForDay(db, dayStart.getTime(), dayEnd.getTime()).then((count) => {
      if (!cancelled) {
        updateDraft(draftKey, (draft) =>
          draft.titleTouched || draft.title ? draft : { ...draft, title: `Meal #${count + 1}` },
        );
      }
    });

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
            food?.servings.find((candidate) => candidate.id === item.servingId) ??
            food?.servings[0];

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
              attribution: item.food.source === "openfoodfacts" ? "Open Food Facts" : null,
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
      const savedMealId = await createSavedMeal(
        db,
        operationId,
        mealDraft.title,
        itemsValid,
      );
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
      removeDraft(draftKey);
      await flush();
    } catch {
      if (!committed) {
        setSaving(false);
        Alert.alert("Couldn't save meal", "The draft is still here. Please try again.");
        return;
      }
    }

    markNutritionChanged();
    closeToRoot();
  }

  function confirmDiscard() {
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

    Alert.alert("Delete meal?", "This removes the meal from your diary. It cannot be undone.", [
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
    ]);
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
          left={{
            accessibilityLabel: "Saved meals",
            label: "Saved Meals",
            onPress: () => push({ screen: "savedMeals" }),
          }}
          right={{
            accessibilityLabel: editing ? "Save changes" : "Log meal",
            disabled: saving,
            label: editing ? "Save Changes" : "Log Meal",
            onPress: () => void submitMeal(),
          }}
        />
      }
      onClose={pop}
      right={
        <LogTimeChanger
          inline
          label="Change Log Time"
          onChange={(date) =>
            updateDraft(draftKey, (draft) => ({ ...draft, loggedAt: date.getTime() }))
          }
          value={new Date(mealDraft.loggedAt)}
        />
      }
      sideWidth={120}
      title={editing ? "Edit Meal" : "Log Meal"}
    >
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
                backgroundColor: theme.colors.accentMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.titleActionLabel, { color: theme.colors.text }]}>
              {templateSaved ? "Saved" : savingTemplate ? "Saving" : "Save Meal"}
            </Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel="Discard draft"
            onPress={confirmDiscard}
            style={[
              styles.titleAction,
              {
                backgroundColor: dangerColors.background,
                borderColor: dangerColors.border,
              },
            ]}
          >
            <Text style={[styles.titleActionLabel, { color: dangerColors.text }]}>
              Discard draft
            </Text>
          </PressOpacity>
        </View>
      </View>
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
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Meal items</Text>
      <PressOpacity
        accessibilityLabel="Add meal item"
        onPress={() => push({ screen: "mealItem" })}
        style={[styles.addItem, { backgroundColor: theme.colors.tertiary }]}
      >
        <Ionicons color={addItemTextColor} name="add-circle-outline" size={24} />
        <Text style={[styles.addItemLabel, { color: addItemTextColor }]}>Add Meal Item</Text>
      </PressOpacity>
      <View style={[styles.items, { borderColor: theme.colors.border }]}>
        {mealDraft.items.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
            Add a food to this meal. You can search, scan a barcode, or use a custom food.
          </Text>
        ) : (
          mealDraft.items.map((item) => (
            <View
              key={item.clientId}
              style={[styles.itemRow, { borderTopColor: theme.colors.border }]}
            >
              <PressOpacity
                accessibilityLabel={`Edit ${item.description ?? "food"}`}
                onPress={() => editItem(item)}
                style={styles.itemMain}
              >
                <Text style={[styles.itemName, { color: theme.colors.text }]}>
                  {item.description ?? "Food details unavailable"}
                </Text>
                <Text style={[styles.itemMeta, { color: theme.colors.textMuted }]}>
                  {item.quantityInput} × {item.servingDescription ?? "serving"}
                </Text>
                <FoodMacroLine nutrients={scaleLine(item)} />
              </PressOpacity>
              <PressOpacity
                accessibilityLabel={`Remove ${item.description ?? "food"}`}
                onPress={() =>
                  updateDraft(draftKey, (draft) => ({
                    ...draft,
                    items: draft.items.filter((candidate) => candidate.clientId !== item.clientId),
                  }))
                }
                style={styles.remove}
              >
                <Ionicons color={theme.colors.textMuted} name="close" size={18} />
              </PressOpacity>
            </View>
          ))
        )}
      </View>
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

    if (!Number.isFinite(quantity) || quantity <= 0 || item.servingId.length === 0) {
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
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
  },
  titleInput: {
    flexBasis: 112,
    flexGrow: 1,
    fontWeight: "700",
    minHeight: 48,
  },
  titleActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginLeft: "auto",
  },
  titleAction: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  titleActionLabel: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    marginTop: tokens.spacing.lg,
  },
  addItem: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.28)",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    marginTop: tokens.spacing.sm,
    minHeight: 56,
    paddingHorizontal: tokens.spacing.lg,
  },
  addItemLabel: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    lineHeight: 20,
  },
  items: {
    marginTop: tokens.spacing.md,
  },
  empty: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    paddingBottom: tokens.spacing.md,
    textAlign: "center",
  },
  itemRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
  },
  itemMain: {
    flex: 1,
    paddingVertical: tokens.spacing.sm,
  },
  itemName: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  itemMeta: {
    fontSize: tokens.typography.label.fontSize,
  },
  remove: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
