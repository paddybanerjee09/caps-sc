import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";

import {
  FoodMacroLine,
  NutritionActionBar,
  NutritionPage,
} from "../../components/nutrition/NutritionChrome";
import { PressOpacity } from "../../components/PressOpacity";
import {
  deleteSavedMeal,
  listSavedMeals,
  type SavedMealSummary,
} from "../../data/nutritionCatalogRepository";
import { calculateNutrientTotals } from "../../nutrition/calculations";
import {
  compositionSignature,
  savedTemplateItemToDraft,
} from "../../nutrition/drafts";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

type SavedSort = "alpha" | "recent" | "logged";

const sortLabels: Record<SavedSort, string> = {
  alpha: "Alphabetical",
  recent: "Most Recent",
  logged: "Most Logged",
};

export function SavedMealsScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const {
    activeDraft,
    closeToRoot,
    dataRevision,
    markNutritionChanged,
    openEditSavedMeal,
    pop,
    returnToMealLog,
    updateDraft,
  } = useNutritionWorkspace();
  const [meals, setMeals] = useState<SavedMealSummary[]>([]);
  const [sort, setSort] = useState<SavedSort>("alpha");

  useEffect(() => {
    let cancelled = false;

    void listSavedMeals(db).then((savedMeals) => {
      if (!cancelled) {
        setMeals(savedMeals);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dataRevision, db]);

  const ordered = useMemo(() => {
    return [...meals].sort((left, right) => {
      if (sort === "logged" && right.loggedCount !== left.loggedCount) {
        return right.loggedCount - left.loggedCount;
      }

      if (sort === "recent" && right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }

      const name = left.title.localeCompare(right.title, undefined, {
        sensitivity: "base",
      });
      return name === 0 ? left.id.localeCompare(right.id) : name;
    });
  }, [meals, sort]);

  function confirmUse(meal: SavedMealSummary) {
    const replacing = (activeDraft?.items.length ?? 0) > 0;
    Alert.alert(
      `Use ${meal.title}?`,
      replacing
        ? "This will replace the foods in the current meal."
        : "This loads the template into the current meal. It does not log it.",
      [
        { style: "cancel", text: "Cancel" },
        {
          text: "Use Meal",
          onPress: () => {
            if (!activeDraft) {
              return;
            }

            feedbackConfirm();
            updateDraft(activeDraft.key, (draft) => {
              const next = {
                ...draft,
                items: meal.items.map(savedTemplateItemToDraft),
                savedMealId: meal.id,
                title: meal.title,
                titleTouched: true,
              };
              return {
                ...next,
                savedSignature: compositionSignature(next),
              };
            });
            returnToMealLog();
          },
        },
      ],
    );
  }

  function confirmDelete(meal: SavedMealSummary) {
    feedbackWarn();
    Alert.alert(
      "Delete saved meal?",
      `${meal.title} will be removed from your saved meals. Meals you already logged keep their nutrition.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void (async () => {
              try {
                await deleteSavedMeal(db, meal.id);
                markNutritionChanged();
              } catch {
                Alert.alert("Couldn't delete meal", "Please try again.");
              }
            })();
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  }

  const activeText = readableTextColor(theme.colors.tertiary);

  return (
    <NutritionPage
      controls={
        <View
          style={[
            styles.controlsCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.controlsTopRow}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              SORT SAVED MEALS
            </Text>
            <Text style={[styles.count, { color: theme.colors.tertiary }]}>
              {meals.length} {meals.length === 1 ? "MEAL" : "MEALS"}
            </Text>
          </View>
          <View style={styles.sortPillRow}>
            {(Object.keys(sortLabels) as SavedSort[]).map((option) => {
              const selected = sort === option;
              return (
                <PressOpacity
                  accessibilityLabel={sortLabels[option]}
                  accessibilityState={{ selected }}
                  key={option}
                  onPress={() => {
                    feedbackStep("up");
                    setSort(option);
                  }}
                  silent
                  style={[
                    styles.sortPill,
                    {
                      backgroundColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.surfaceMuted,
                      borderColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      { color: selected ? activeText : theme.colors.text },
                    ]}
                  >
                    {sortLabels[option]}
                  </Text>
                </PressOpacity>
              );
            })}
          </View>
        </View>
      }
      footer={
        <NutritionActionBar
          left={{ accessibilityLabel: "Back", label: "Back", onPress: pop }}
          right={{
            accessibilityLabel: "Back to meal",
            label: "Back to Meal",
            onPress: returnToMealLog,
          }}
        />
      }
      onClose={closeToRoot}
      scroll={false}
      title="Saved Meals"
    >
      {ordered.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
            Save a meal from the composer to reuse it here.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={ordered}
          keyExtractor={(meal) => meal.id}
          renderItem={({ item }) => {
            const totals = calculateNutrientTotals(item.items);
            const partial = Object.values(totals.incomplete).some(Boolean);

            return (
              <View
                style={[
                  styles.mealCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <PressOpacity
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => openEditSavedMeal(item)}
                  style={styles.rowMain}
                >
                  <Text style={[styles.name, { color: theme.colors.text }]}>
                    {item.title}
                  </Text>
                  <FoodMacroLine nutrients={totals} partial={partial} />
                </PressOpacity>
                {activeDraft && activeDraft.mode !== "savedTemplate" ? (
                  <PressOpacity
                    accessibilityLabel={`Use ${item.title} in current meal`}
                    onPress={() => confirmUse(item)}
                    style={[
                      styles.rowAction,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <Ionicons
                      color={theme.colors.tertiary}
                      name="download-outline"
                      size={20}
                    />
                  </PressOpacity>
                ) : null}
                <PressOpacity
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => openEditSavedMeal(item)}
                  style={[
                    styles.rowAction,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    color={theme.colors.text}
                    name="create-outline"
                    size={20}
                  />
                </PressOpacity>
                <PressOpacity
                  accessibilityLabel={`Delete ${item.title}`}
                  onPress={() => confirmDelete(item)}
                  style={[
                    styles.rowAction,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    color={theme.colors.textMuted}
                    name="close"
                    size={20}
                  />
                </PressOpacity>
              </View>
            );
          }}
        />
      )}
    </NutritionPage>
  );
}

const styles = StyleSheet.create({
  controlsCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  controlsTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  count: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  sortPillRow: {
    flexDirection: "row",
    gap: 6,
  },
  sortPill: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 6,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    margin: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  empty: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  listContent: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  mealCard: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 72,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  rowMain: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  rowAction: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  name: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "800",
  },
});
