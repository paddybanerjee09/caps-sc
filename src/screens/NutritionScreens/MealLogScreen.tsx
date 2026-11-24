import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  NutritionActionBar,
  NutritionPage,
  NutritionTextInput,
} from "../../components/nutrition/NutritionChrome";
import { LoggedFoodComponent } from "../../components/nutrition/LoggedFoodComponent";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { MacronutrientBreakdownCard } from "../../components/MacronutrientBreakdownCard";
import { PressOpacity } from "../../components/PressOpacity";
import { DAILY_NUTRIENT_TARGETS } from "../../constants/nutrition";
import {
  createSavedMeal,
  deleteSavedMeal,
  listSavedMeals,
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
  savedTemplateItemToDraft,
  type DraftMealItem,
} from "../../nutrition/drafts";
import { resolveCatalogFood } from "../../services/foodCatalog";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackWarn } from "../../utils/feedback";
import type { NewMealItem } from "../../types/nutrition";

const tokens = themes.dark;

export function MealLogScreen({ draftKey }: { draftKey: string }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useNutritionWorkspace();
  const {
    closeToRoot,
    drafts,
    dataRevision,
    flush,
    markNutritionChanged,
    pop,
    push,
    registerBackHandler,
    removeDraft,
    setFacts,
    transitioning,
    updateDraft,
  } = workspace;
  const mealDraft = drafts[draftKey] ?? null;
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const mutationPending = useRef(false);
  const [templateCheck, setTemplateCheck] = useState({ id: "", ready: false, error: false, revision: -1, attempt: -1 });
  const [checkAttempt, setCheckAttempt] = useState(0);
  const savedMealId = mealDraft?.savedMealId ?? null;

  useEffect(() => registerBackHandler(() => mutationPending.current), [registerBackHandler]);

  useEffect(() => {
    if (!savedMealId) return;
    let cancelled = false;
    void listSavedMeals(db).then((meals) => {
      if (cancelled) return;
      const saved = meals.find((meal) => meal.id === savedMealId);
      updateDraft(draftKey, (draft) => draft.savedMealId !== savedMealId ? draft : ({
        ...draft,
        savedMealId: saved?.id ?? null,
        savedSignature: saved ? compositionSignature({
          title: saved.title,
          items: saved.items.map(savedTemplateItemToDraft),
        }) : null,
        pendingTemplateOperationId: null,
      }));
      setTemplateCheck({ id: savedMealId, ready: true, error: false, revision: dataRevision, attempt: checkAttempt });
    }).catch(() => {
      if (!cancelled) setTemplateCheck({ id: savedMealId, ready: false, error: true, revision: dataRevision, attempt: checkAttempt });
    });
    return () => { cancelled = true; };
  }, [db, draftKey, savedMealId, dataRevision, checkAttempt, updateDraft]);

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
            );

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
  const templateCheckCurrent = templateCheck.id === savedMealId && templateCheck.revision === dataRevision && templateCheck.attempt === checkAttempt;
  const templateReady = !savedMealId || (templateCheckCurrent && templateCheck.ready);
  const templateCheckError = templateCheckCurrent && templateCheck.error;
  const templateSaved =
    templateReady && savedMealId !== null && mealDraft.savedSignature !== null && mealDraft.savedSignature === signature;
  const itemsValid = mealItemsFromDraft(mealDraft.items);
  const canSaveTemplate =
    templateReady &&
    !saving &&
    !savingTemplate &&
    !templateSaved &&
    mealDraft.title.trim().length > 0 &&
    itemsValid !== null;

  function editItem(item: DraftMealItem) {
    if (transitioning || mutationPending.current) {
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
              storagePolicy: item.storagePolicy,
            }
          : null,
    });
    push({ screen: "facts" });
  }

  async function saveTemplate(closeAfterSave = false) {
    if (!canSaveTemplate || !itemsValid || mutationPending.current || transitioning) {
      return;
    }

    mutationPending.current = true;
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
      setTemplateCheck({ id: savedMealId, ready: true, error: false, revision: dataRevision + 1, attempt: checkAttempt });
      markNutritionChanged();
      feedbackConfirm();
      if (closeAfterSave) {
        pop();
      }
    } catch {
      Alert.alert("Couldn't save meal", "Please try again.");
    } finally {
      mutationPending.current = false;
      setSavingTemplate(false);
    }
  }

  async function unsaveTemplate() {
    if (!savedMealId || mutationPending.current || transitioning) return;
    mutationPending.current = true;
    setSavingTemplate(true);
    try {
      await deleteSavedMeal(db, savedMealId);
      for (const draft of Object.values(drafts)) {
        if (draft.savedMealId === savedMealId) {
          updateDraft(draft.key, (current) => current.savedMealId !== savedMealId ? current : ({
            ...current,
            savedMealId: null,
            savedSignature: null,
            pendingTemplateOperationId: null,
          }));
        }
      }
      markNutritionChanged();
      feedbackConfirm();
    } catch {
      Alert.alert("Couldn't unsave meal", "Please try again.");
    } finally {
      mutationPending.current = false;
      setSavingTemplate(false);
    }
  }

  async function submitMeal() {
    if (mutationPending.current || transitioning) {
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

    mutationPending.current = true;
    setSaving(true);
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
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }

    markNutritionChanged();
    closeToRoot();
  }

  function confirmDelete() {
    if (!mealDraft.timelineEntryId || mutationPending.current) {
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
              if (mutationPending.current) return;
              mutationPending.current = true;
              setSaving(true);
              try {
                await deleteMealLog(db, mealDraft.timelineEntryId!);
                removeDraft(draftKey);
                await flush();
                markNutritionChanged();
                closeToRoot();
              } catch {
                Alert.alert("Couldn't delete meal", "Please try again.");
              } finally {
                mutationPending.current = false;
                setSaving(false);
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
          navigationDisabled={saving || savingTemplate}
          danger={
            editing
              ? {
                  accessibilityLabel: "Delete meal",
                  disabled: saving || savingTemplate,
                  label: "Delete Meal",
                  onPress: confirmDelete,
                }
              : undefined
          }
          left={{
            accessibilityLabel: !templateReady
              ? templateCheckError ? "Retry saved meal status" : "Checking saved meal status"
              : templateSaved ? "Unsave meal" : "Save meal",
            disabled: saving || savingTemplate || transitioning || (!templateReady && !templateCheckError) || (templateReady && !templateSaved && !canSaveTemplate),
            label: savingTemplate ? "Saving" : !templateReady ? (templateCheckError ? "Retry" : "Loading") : templateSaved ? "Unsave Meal" : "Save Meal",
            onPress: () => {
              if (!templateReady) setCheckAttempt((attempt) => attempt + 1);
              else if (templateSaved) void unsaveTemplate();
              else void saveTemplate();
            },
          }}
          right={
            editingSavedTemplate
              ? {
                  accessibilityLabel: "Save saved meal",
                  disabled: !canSaveTemplate || savingTemplate,
                  label: savingTemplate ? "Saving" : "Save Changes",
                  onPress: () => void saveTemplate(true),
                }
              : {
                  accessibilityLabel: editing ? "Save changes" : "Log meal",
                  disabled: saving || savingTemplate,
                  label: editing ? "Save Changes" : "Log Meal",
                  onPress: () => void submitMeal(),
                }
          }
        />
      }
      onClose={() => { if (!mutationPending.current) closeToRoot(); }}
      right={
        editingSavedTemplate ? undefined : (
          <LogTimeChanger
            compact
            inline
            label="Change Log Time"
            maximumDate={new Date()}
            onChange={(date) =>
              !mutationPending.current && updateDraft(draftKey, (draft) => ({
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
      <View style={[styles.card, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.borderStrong,
      }]}>
        <NutritionTextInput
          accessibilityLabel="Meal title"
          editable={!saving && !savingTemplate}
          maxLength={80}
          onChangeText={(title) => updateDraft(draftKey, (draft) => ({ ...draft, title, titleTouched: true }))}
          placeholder="Meal title"
          style={styles.titleInput}
          value={mealDraft.title}
        />
        <MacronutrientBreakdownCard
          compact
          embedded
          incomplete={totals.incomplete}
          micronutrients={extraTotals}
          targets={DAILY_NUTRIENT_TARGETS}
          values={{
            carbohydratesG: totals.carbohydratesG,
            energyKcal: totals.energyKcal,
            fatG: totals.fatG,
            proteinG: totals.proteinG,
          }}
        />
      </View>
      <View style={[styles.card, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.borderStrong,
      }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            MEAL ITEMS ({mealDraft.items.length})
          </Text>
          <PressOpacity
            accessibilityLabel="Browse saved meals"
            disabled={saving || savingTemplate}
            onPress={() => push({ screen: "savedMeals" })}
            style={styles.savedMeals}
          >
            <Ionicons color={theme.colors.textMuted} name="bookmarks-outline" size={18} />
            <Text style={[styles.savedMealsLabel, { color: theme.colors.textMuted }]}>Saved Meals</Text>
          </PressOpacity>
        </View>
        <PressOpacity
          accessibilityLabel="Add meal item"
          disabled={saving || savingTemplate}
          onPress={() => push({ screen: "mealItem" })}
          style={[styles.addItem, { backgroundColor: theme.colors.tertiary }]}
        >
          <Ionicons color={addItemTextColor} name="add-circle-outline" size={24} />
          <Text style={[styles.addItemLabel, { color: addItemTextColor }]}>Add Meal Item</Text>
        </PressOpacity>
        <View style={styles.items}>
          {mealDraft.items.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textMuted }]}>Add food</Text>
          ) : mealDraft.items.map((item) => (
            <LoggedFoodComponent
              disabled={saving || savingTemplate}
              item={item}
              key={item.clientId}
              onPress={() => editItem(item)}
              onRemove={() => {
                feedbackStep("down");
                updateDraft(draftKey, (draft) => ({
                  ...draft,
                  items: draft.items.filter((candidate) => candidate.clientId !== item.clientId),
                }));
              }}
            />
          ))}
        </View>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  titleInput: { fontWeight: "700", minHeight: 48 },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  cardHeaderLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  savedMeals: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.xs,
  },
  savedMealsLabel: { fontSize: 12, fontWeight: "700" },
  addItem: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  addItemLabel: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  items: { gap: tokens.spacing.sm },
  empty: { fontSize: 13, lineHeight: 18, padding: tokens.spacing.sm, textAlign: "center" },
});
