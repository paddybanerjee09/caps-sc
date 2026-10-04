import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { MacronutrientBreakdownCard } from "../components/MacronutrientBreakdownCard";
import { MicronutrientSummary } from "../components/nutrition/ExtraNutrients";
import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { DAILY_NUTRIENT_TARGETS } from "../constants/nutrition";
import {
  calculateNutrientTotals,
  foodIdentityKey,
  localDayBounds,
  sumExtraTotals,
} from "../nutrition/calculations";
import { getMealLogsForDay } from "../data/nutritionRepository";
import { resolveCatalogFood } from "../services/foodCatalog";
import { useNutritionWorkspace } from "../state/NutritionWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { CatalogFood, StoredMealItem, StoredMealLog } from "../types/nutrition";

const tokens = themes.dark;

export function NutritionScreen() {
  const db = useSQLiteContext();
  const { height } = useWindowDimensions();
  const { theme } = useAppTheme();
  const {
    clearNotice,
    dataRevision,
    diaryDate,
    expandedMealId,
    notice,
    openEditMeal,
    openNewMeal,
    setDiaryDate,
    setExpandedMealId,
  } = useNutritionWorkspace();
  const currentDay = diaryDate;
  const [meals, setMeals] = useState<StoredMealLog[]>([]);
  const [resolvedFoods, setResolvedFoods] = useState<Record<string, CatalogFood>>({});
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [nutrientMenu, setNutrientMenu] = useState<{ id: string; top: number } | null>(null);
  const requestId = useRef(0);
  const rootRef = useRef<View>(null);

  const { dayStart, dayEnd } = useMemo(
    () => localDayBounds(currentDay),
    [currentDay],
  );

  const loadMeals = useCallback(async () => {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setLoading(true);
    setDatabaseError(null);

    try {
      const storedMeals = await getMealLogsForDay(
        db,
        dayStart.getTime(),
        dayEnd.getTime(),
      );

      if (currentRequestId === requestId.current) {
        setMeals(storedMeals);
      }
    } catch {
      if (currentRequestId === requestId.current) {
        setDatabaseError("Couldn’t load meals for this date");
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, [dayEnd, dayStart, db]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMeals();
    }, 0);

    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loadMeals, dataRevision]);

  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timer = setTimeout(() => {
      if (isSameLocalDay(currentDay, today)) {
        setDiaryDate(new Date());
      }
    }, tomorrow.getTime() - today.getTime() + 250);

    return () => clearTimeout(timer);
  }, [currentDay, setDiaryDate]);

  useEffect(() => {
    const refs = meals.flatMap((meal) =>
      meal.items.filter((item) => item.storagePolicy === "reference"),
    );
    let cancelled = false;

    void (async () => {
      for (const item of refs) {
        if (cancelled) {
          return;
        }

        const key = `${foodIdentityKey(item.food)}:${item.servingId}`;

        try {
          const food = await resolveCatalogFood(db, item.food);
          const serving = food?.servings.find((candidate) => candidate.id === item.servingId);

          if (!cancelled && food && serving) {
            setResolvedFoods((current) => ({
              ...current,
              [key]: food,
            }));
          }
        } catch {
          // Leave the diary reference unresolved instead of inventing nutrients.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, meals]);

  const displayMeals = useMemo(
    () => meals.map((meal) => hydrateMeal(meal, resolvedFoods)),
    [meals, resolvedFoods],
  );
  const dailyTotals = useMemo(
    () => calculateNutrientTotals(displayMeals.flatMap((meal) => meal.items)),
    [displayMeals],
  );
  const extraTotals = useMemo(
    () => sumExtraTotals(displayMeals.flatMap((meal) => meal.items)),
    [displayMeals],
  );
  const selectedNutrient =
    extraTotals.find((total) => total.id === nutrientMenu?.id) ??
    extraTotals.find((total) => total.group === "micro") ??
    null;
  const catalogueHeight = clamp(height * 0.42, 240, 420);
  const previousDate = shiftLocalDate(currentDay, -1);
  const nextDate = shiftLocalDate(currentDay, 1);
  const nutrientRef = useRef<View>(null);

  function changeDay(numberOfDays: number) {
    setDiaryDate(shiftLocalDate(currentDay, numberOfDays));
  }

  function openNutrientMenu() {
    nutrientRef.current?.measureInWindow((_x, y, _width, buttonHeight) => {
      rootRef.current?.measureInWindow((_rootX, rootY) => {
        setNutrientMenu({
          id: selectedNutrient?.id ?? extraTotals[0]?.id ?? "sodium",
          top: y + buttonHeight - rootY,
        });
      });
    });
  }

  return (
    <View ref={rootRef} style={styles.workspace}>
    <Screen centerTitle title="Nutrition">
      {notice ? (
        <PressOpacity accessibilityLabel="Dismiss notice" onPress={clearNotice}>
          <Text style={[styles.stateText, { color: theme.colors.text }]}>{notice}</Text>
        </PressOpacity>
      ) : null}
      <View style={styles.dateNavigator}>
        <PressOpacity
          accessibilityLabel={`Show previous day, ${formatFullDate(
            previousDate,
          )}`}
          onPress={() => changeDay(-1)}
          style={styles.dateArrow}
        >
          <Ionicons
            color={theme.colors.text}
            name="chevron-back"
            size={22}
          />
        </PressOpacity>

        <Text
          numberOfLines={1}
          style={[styles.selectedDateText, { color: theme.colors.text }]}
        >
          {formatSelectedDate(currentDay)}
        </Text>

        <PressOpacity
          accessibilityLabel={`Show next day, ${formatFullDate(nextDate)}`}
          onPress={() => changeDay(1)}
          style={styles.dateArrow}
        >
          <Ionicons
            color={theme.colors.text}
            name="chevron-forward"
            size={22}
          />
        </PressOpacity>
      </View>

      <View style={styles.catalogueContainer}>
        <View
          style={[
            styles.catalogue,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              height: catalogueHeight,
            },
          ]}
        >
          {loading ? (
            <View style={styles.catalogueState}>
              <ActivityIndicator color={theme.colors.tertiary} />
            </View>
          ) : databaseError ? (
            <View style={styles.catalogueState}>
              <Text style={[styles.stateText, { color: theme.colors.text }]}>
                {databaseError}
              </Text>
              <PressOpacity
                accessibilityLabel="Retry loading meals"
                onPress={() => void loadMeals()}
                style={[
                  styles.retryButton,
                  { borderColor: theme.colors.borderStrong },
                ]}
              >
                <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
              </PressOpacity>
            </View>
          ) : meals.length === 0 ? (
            <View style={styles.catalogueState}>
              <Ionicons
                color={theme.colors.textMuted}
                name="restaurant-outline"
                size={28}
              />
              <Text
                style={[styles.stateText, { color: theme.colors.textMuted }]}
              >
                {isSameLocalDay(currentDay, new Date())
                  ? "No meals logged today"
                  : "No meals for this date"}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.mealList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {displayMeals.map((meal) => (
                <MealCatalogueEntry
                  expanded={expandedMealId === meal.timelineEntryId}
                  key={meal.timelineEntryId}
                  meal={meal}
                  onEdit={() => openEditMeal(meal)}
                  onToggle={() =>
                    setExpandedMealId(
                      expandedMealId === meal.timelineEntryId
                        ? null
                        : meal.timelineEntryId,
                    )
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>

        <PressOpacity
          accessibilityLabel="Log meal"
          onPress={() => openNewMeal(currentDay)}
          style={[styles.addButton, { backgroundColor: theme.colors.tertiary }]}
        >
          <Ionicons color={theme.colors.background} name="add" size={28} />
        </PressOpacity>
      </View>

      <View style={styles.summarySection}>
        {loading ? (
          <View
            accessibilityLabel="Loading daily nutrition totals"
            style={[
              styles.summary,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Daily totals
            </Text>
            <ActivityIndicator color={theme.colors.tertiary} />
          </View>
        ) : databaseError ? (
          <View
            style={[
              styles.summary,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Daily totals
            </Text>
            <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
              Daily totals unavailable
            </Text>
          </View>
        ) : (
          <>
          <MacronutrientBreakdownCard
            incomplete={dailyTotals.incomplete}
            targets={DAILY_NUTRIENT_TARGETS}
            title="Daily totals"
            values={{
              carbohydratesG: dailyTotals.carbohydratesG,
              energyKcal: dailyTotals.energyKcal,
              fatG: dailyTotals.fatG,
              proteinG: dailyTotals.proteinG,
            }}
          />
          <View ref={nutrientRef}>
            <MicronutrientSummary
              onPress={openNutrientMenu}
              selected={selectedNutrient}
            />
          </View>
          </>
        )}
      </View>
    </Screen>
      {nutrientMenu ? (
        <View style={[styles.nutrientMenu, { top: nutrientMenu.top }]}>
          <PressOpacity
            accessibilityLabel="Dismiss micronutrients"
            onPress={() => setNutrientMenu(null)}
            style={styles.nutrientBackdrop}
          />
          <View
            style={[
              styles.nutrientList,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                top: nutrientMenu.top,
              },
            ]}
          >
            {extraTotals
              .filter((total) => total.group === "micro")
              .map((total) => (
                <PressOpacity
                  accessibilityLabel={total.name}
                  key={total.id}
                  onPress={() => setNutrientMenu({ id: total.id, top: nutrientMenu.top })}
                  style={styles.nutrientChoice}
                >
                  <Text style={{ color: theme.colors.text }}>{total.name}</Text>
                </PressOpacity>
              ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MealCatalogueEntry({
  expanded,
  meal,
  onEdit,
  onToggle,
}: {
  expanded: boolean;
  meal: StoredMealLog;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { theme } = useAppTheme();
  const nutritionSummary = formatMealTabNutrition(meal);

  return (
    <View
      style={[
        styles.meal,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <PressOpacity
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${
          meal.title
        }, ${formatTime(meal.loggedAt)}. ${formatMealTotalsForAccessibility(
          meal,
        )}`}
        onPress={onToggle}
        style={styles.mealTab}
      >
        <View style={styles.mealTabMain}>
          <Text
            numberOfLines={1}
            style={[styles.mealTitle, { color: theme.colors.text }]}
          >
            {meal.title}
          </Text>
          <Text
            style={[styles.mealTabNutrition, { color: theme.colors.textMuted }]}
          >
            {nutritionSummary}
          </Text>
        </View>

        <View style={styles.mealTabEnd}>
          <Text style={[styles.mealTime, { color: theme.colors.textMuted }]}>
            {formatTime(meal.loggedAt)}
          </Text>
          <Ionicons
            color={theme.colors.textMuted}
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
          />
        </View>
      </PressOpacity>

      {expanded ? (
        <View
          style={[
            styles.mealContent,
            { borderTopColor: theme.colors.border },
          ]}
        >
          <View
            accessibilityLabel={`${meal.title}, ${meal.status}, at ${formatTime(
              meal.loggedAt,
            )}. ${formatMealTotalsForAccessibility(meal)}`}
            accessible
            style={styles.mealDetails}
          >
            <Text
              style={[
                styles.mealStatus,
                {
                  color:
                    meal.status === "planned"
                      ? theme.colors.tertiary
                      : theme.colors.textMuted,
                },
              ]}
            >
              {meal.status === "planned" ? "Planned" : "Completed"}
            </Text>

            <View style={styles.foodList}>
              {meal.items.map((item) => (
                <StoredFoodRow item={item} key={item.id} />
              ))}
            </View>
          </View>

          <PressOpacity
            accessibilityLabel={`Edit ${meal.title}`}
            onPress={onEdit}
            style={styles.editMealButton}
          >
            <Text style={{ color: theme.colors.tertiary }}>Edit Meal</Text>
          </PressOpacity>
        </View>
      ) : null}
    </View>
  );
}

function StoredFoodRow({ item }: { item: StoredMealItem }) {
  const { theme } = useAppTheme();
  const nutrients = item.nutrientsPerServing;

  return (
    <View
      style={[styles.foodRow, { borderLeftColor: theme.colors.borderStrong }]}
    >
      <Text
        numberOfLines={1}
        style={[styles.foodName, { color: theme.colors.text }]}
      >
        {item.description}
      </Text>
      <Text style={[styles.foodDetail, { color: theme.colors.textMuted }]}>
        {formatNumber(item.quantity)} × {item.servingDescription}
      </Text>
      <Text style={[styles.foodNutrients, { color: theme.colors.textMuted }]}>
        {formatNullableContribution(nutrients.energyKcal, item.quantity)} kcal ·
        P {formatNullableContribution(nutrients.proteinG, item.quantity)} g · C{" "}
        {formatNullableContribution(nutrients.carbohydratesG, item.quantity)} g
        · F {formatNullableContribution(nutrients.fatG, item.quantity)} g
      </Text>
    </View>
  );
}

function hydrateMeal(
  meal: StoredMealLog,
  resolved: Record<string, CatalogFood>,
): StoredMealLog {
  const items = meal.items.map((item) => {
    if (item.storagePolicy !== "reference") {
      return item;
    }

    const food = resolved[`${foodIdentityKey(item.food)}:${item.servingId}`];
    const serving = food?.servings.find((candidate) => candidate.id === item.servingId);

    if (!food || !serving) {
      return item;
    }

    return {
      ...item,
      brandName: food.brandName,
      description: food.name,
      extrasPerServing: serving.extras,
      nutrientsPerServing: serving.nutrients,
      servingAmount: serving.amount,
      servingDescription: serving.label,
      servingUnit: serving.unit,
    };
  });

  return {
    ...meal,
    items,
    totals: calculateNutrientTotals(items),
  };
}

function formatMealTabNutrition(meal: StoredMealLog) {
  return `${formatTotal(
    meal.totals.energyKcal,
    meal.totals.incomplete.energyKcal,
  )} kcal · P ${formatTotal(
    meal.totals.proteinG,
    meal.totals.incomplete.proteinG,
  )} g · C ${formatTotal(
    meal.totals.carbohydratesG,
    meal.totals.incomplete.carbohydratesG,
  )} g · F ${formatTotal(
    meal.totals.fatG,
    meal.totals.incomplete.fatG,
  )} g`;
}

function formatMealTotalsForAccessibility(meal: StoredMealLog) {
  const totals = meal.totals;
  const isIncomplete = Object.values(totals.incomplete).some(Boolean);

  return `${formatAccessibleTotal("kilocalories", totals.energyKcal, totals.incomplete.energyKcal)}, ${formatAccessibleTotal("grams protein", totals.proteinG, totals.incomplete.proteinG)}, ${formatAccessibleTotal("grams carbohydrates", totals.carbohydratesG, totals.incomplete.carbohydratesG)}, and ${formatAccessibleTotal("grams fat", totals.fatG, totals.incomplete.fatG)}.${isIncomplete ? " Incomplete nutrition data." : ""}`;
}

function formatAccessibleTotal(
  unit: string,
  value: number | null,
  incomplete: boolean,
) {
  if (value === null) {
    return `${unit} unavailable`;
  }

  return `${incomplete ? "at least " : ""}${formatNumber(value, unit.startsWith("kilo") ? 0 : 1)} ${unit}`;
}

function formatNullableContribution(value: number | null, quantity: number) {
  return value === null ? "—" : formatNumber(value * quantity);
}

function formatTotal(value: number | null, incomplete: boolean) {
  if (value === null) {
    return "\u2014";
  }

  return `${formatNumber(value)}${incomplete ? "+" : ""}`;
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  return safeValue.toLocaleString([], { maximumFractionDigits });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shiftLocalDate(date: Date, numberOfDays: number) {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + numberOfDays);
  return shiftedDate;
}

function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatSelectedDate(date: Date) {
  const today = new Date();

  if (isSameLocalDay(date, today)) {
    return `Today, ${date.toLocaleDateString([], {
      month: "long",
      day: "numeric",
    })}`;
  }

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  dateNavigator: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: tokens.spacing.sm,
  },
  dateArrow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  selectedDateText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  catalogue: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  catalogueContainer: {
    position: "relative",
    zIndex: 10,
  },
  catalogueState: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.md,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: tokens.spacing.md,
  },
  mealList: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.sm,
  },
  meal: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  mealTab: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  mealContent: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  mealDetails: {
    gap: tokens.spacing.sm,
  },
  mealTabMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  mealTabEnd: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  mealTabNutrition: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  mealTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  mealTime: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  mealStatus: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  foodList: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
  },
  foodRow: {
    borderLeftWidth: 2,
    paddingLeft: tokens.spacing.sm,
  },
  foodName: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  foodDetail: {
    fontSize: 11,
    lineHeight: 15,
  },
  foodNutrients: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  editMealButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  summary: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.lg,
    minHeight: 144,
    padding: tokens.spacing.lg,
  },
  summarySection: {
    marginTop: tokens.spacing.xxl,
  },
  addButton: {
    alignItems: "center",
    bottom: -24,
    borderRadius: tokens.radius.pill,
    elevation: 10,
    height: 48,
    justifyContent: "center",
    left: "50%",
    marginLeft: -24,
    position: "absolute",
    width: 48,
    zIndex: 10,
  },
  workspace: {
    flex: 1,
  },
  nutrientMenu: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  nutrientBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  nutrientList: {
    borderWidth: StyleSheet.hairlineWidth,
    left: tokens.spacing.lg,
    position: "absolute",
    right: tokens.spacing.lg,
  },
  nutrientChoice: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
});
