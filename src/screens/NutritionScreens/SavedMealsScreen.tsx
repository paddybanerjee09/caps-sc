import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  totalsForItems,
  type SavedMealSummary,
} from "../../data/nutritionCatalogRepository";
import { createId } from "../../nutrition/calculations";
import { compositionSignature, type DraftMealItem } from "../../nutrition/drafts";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

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
    registerBackHandler,
    returnToMealLog,
    updateDraft,
  } = useNutritionWorkspace();
  const [meals, setMeals] = useState<SavedMealSummary[]>([]);
  const [sort, setSort] = useState<SavedSort>("alpha");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadMeals = useCallback(() => {
    void listSavedMeals(db).then(setMeals);
  }, [db]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    return registerBackHandler(() => {
      setMenuOpen(false);
      return true;
    });
  }, [menuOpen, registerBackHandler]);

  useEffect(() => {
    loadMeals();
  }, [dataRevision, loadMeals]);

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

            updateDraft(activeDraft.key, (draft) => {
              const next = {
                ...draft,
                items: meal.items.map(templateItemToDraft),
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
                loadMeals();
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

  return (
    <NutritionPage
      controls={
        <View style={styles.controls}>
          <Text style={[styles.count, { color: theme.colors.textMuted }]}>
            {meals.length} {meals.length === 1 ? "meal" : "meals"}
          </Text>
          <PressOpacity
            accessibilityLabel={`Sort saved meals, ${sortLabels[sort]}`}
            onPress={() => setMenuOpen((open) => !open)}
            style={styles.sortButton}
          >
            <Text style={{ color: theme.colors.text }}>{sortLabels[sort]}</Text>
            <Ionicons color={theme.colors.text} name="swap-vertical" size={18} />
          </PressOpacity>
          {menuOpen ? (
            <View
              style={[
                styles.menu,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {(Object.keys(sortLabels) as SavedSort[]).map((option) => (
                <PressOpacity
                  accessibilityLabel={sortLabels[option]}
                  key={option}
                  onPress={() => {
                    setSort(option);
                    setMenuOpen(false);
                  }}
                  style={styles.menuRow}
                >
                  <Text style={{ color: theme.colors.text }}>{sortLabels[option]}</Text>
                </PressOpacity>
              ))}
            </View>
          ) : null}
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
        <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
          Save a meal from the composer to reuse it here.
        </Text>
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(meal) => meal.id}
          renderItem={({ item }) => {
            const totals = totalsForItems(item.items);
            const partial = Object.values(totals.incomplete).some(Boolean);

            return (
              <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
                <PressOpacity
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => openEditSavedMeal(item)}
                  style={styles.rowMain}
                >
                  <Text style={[styles.name, { color: theme.colors.text }]}>{item.title}</Text>
                  <FoodMacroLine
                    nutrients={{
                      carbohydratesG: totals.carbohydratesG,
                      energyKcal: totals.energyKcal,
                      fatG: totals.fatG,
                      proteinG: totals.proteinG,
                    }}
                    partial={partial}
                  />
                </PressOpacity>
                {activeDraft && activeDraft.mode !== "savedTemplate" ? (
                  <PressOpacity
                    accessibilityLabel={`Use ${item.title} in current meal`}
                    onPress={() => confirmUse(item)}
                    style={styles.rowAction}
                  >
                    <Ionicons color={theme.colors.tertiary} name="download-outline" size={20} />
                  </PressOpacity>
                ) : null}
                <PressOpacity
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => openEditSavedMeal(item)}
                  style={styles.rowAction}
                >
                  <Ionicons color={theme.colors.textMuted} name="create-outline" size={20} />
                </PressOpacity>
                <PressOpacity
                  accessibilityLabel={`Delete ${item.title}`}
                  onPress={() => confirmDelete(item)}
                  style={styles.rowAction}
                >
                  <Ionicons color={theme.colors.textMuted} name="close" size={20} />
                </PressOpacity>
              </View>
            );
          }}
        />
      )}
      {menuOpen ? (
        <PressOpacity
          accessibilityLabel="Close sort options"
          onPress={() => setMenuOpen(false)}
          pressedOpacity={1}
          style={styles.backdrop}
        />
      ) : null}
    </NutritionPage>
  );
}

function templateItemToDraft(item: SavedMealSummary["items"][number]): DraftMealItem {
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

const styles = StyleSheet.create({
  controls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.lg,
    zIndex: 2,
  },
  count: {
    fontSize: tokens.typography.label.fontSize,
  },
  sortButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    minHeight: 44,
  },
  menu: {
    borderWidth: StyleSheet.hairlineWidth,
    position: "absolute",
    right: tokens.spacing.lg,
    top: 44,
    width: 180,
  },
  menuRow: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  empty: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    padding: tokens.spacing.lg,
    textAlign: "center",
  },
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
    paddingLeft: tokens.spacing.lg,
    paddingRight: tokens.spacing.sm,
  },
  rowMain: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 64,
    paddingVertical: tokens.spacing.sm,
  },
  rowAction: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  name: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
});
