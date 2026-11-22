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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { scheduleIdleTask } from "../utils/scheduleIdleTask";
import { MacronutrientBreakdownCard } from "../components/MacronutrientBreakdownCard";
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
import { readableTextColor, themes } from "../theme/theme";
import { feedbackStep, feedbackToggle } from "../utils/feedback";
import type {
  CatalogFood,
  StoredMealItem,
  StoredMealLog,
} from "../types/nutrition";

const tokens = themes.dark;

export function NutritionScreen() {
  const db = useSQLiteContext();
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
  const currentDayMs = currentDay.getTime();
  const [meals, setMeals] = useState<StoredMealLog[]>([]);
  const [resolvedFoods, setResolvedFoods] = useState<
    Record<string, CatalogFood>
  >({});
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const requestId = useRef(0);

  const { dayStart, dayEnd } = useMemo(
    () => localDayBounds(new Date(currentDayMs)),
    [currentDayMs],
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
    const task = scheduleIdleTask(() => {
      void loadMeals();
    });

    return () => {
      task.cancel();
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
          const serving = food?.servings.find(
            (candidate) => candidate.id === item.servingId,
          );

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
  const previousDate = shiftLocalDate(currentDay, -1);
  const nextDate = shiftLocalDate(currentDay, 1);
  const primaryText = readableTextColor(theme.colors.tertiary);

  function changeDay(numberOfDays: number) {
    feedbackStep(numberOfDays > 0 ? "up" : "down");
    setDiaryDate(shiftLocalDate(currentDay, numberOfDays));
  }

  return (
    <Screen
      title="Nutrition"
    >
      {notice ? (
        <PressOpacity
          accessibilityLabel="Dismiss notice"
          onPress={clearNotice}
          style={[
            styles.noticeCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.tertiary,
            },
          ]}
        >
          <Text style={[styles.stateText, { color: theme.colors.text }]}>
            {notice}
          </Text>
        </PressOpacity>
      ) : null}

      {/* Card 1: Date Stepper Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.dateNavigator}>
          <PressOpacity
            accessibilityLabel={`Show previous day, ${formatFullDate(
              previousDate,
            )}`}
            onPress={() => changeDay(-1)}
            silent
            style={[
              styles.dateStepButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Ionicons color={theme.colors.text} name="chevron-back" size={20} />
            <Text style={[styles.dateStepLabel, { color: theme.colors.text }]}>
              -1d
            </Text>
          </PressOpacity>

          <PressOpacity
            accessibilityLabel="Jump to today"
            onPress={() => {
              feedbackStep("up");
              setDiaryDate(new Date());
            }}
            silent
            style={[
              styles.selectedDatePill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.selectedDateText, { color: theme.colors.text }]}
            >
              {formatSelectedDate(currentDay)}
            </Text>
          </PressOpacity>

          <PressOpacity
            accessibilityLabel={`Show next day, ${formatFullDate(nextDate)}`}
            onPress={() => changeDay(1)}
            silent
            style={[
              styles.dateStepButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.dateStepLabel, { color: theme.colors.text }]}>
              +1d
            </Text>
            <Ionicons
              color={theme.colors.text}
              name="chevron-forward"
              size={20}
            />
          </PressOpacity>
        </View>
      </View>

      {/* Card 2: Meal Diary Card & Log Meal CTA */}
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
            LOGGED MEALS DIARY
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.tertiary }]}>
              {meals.length} {meals.length === 1 ? "MEAL" : "MEALS"}
            </Text>
          </View>
        </View>

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
              <Text style={{ color: theme.colors.tertiary, fontWeight: "800" }}>
                Retry
              </Text>
            </PressOpacity>
          </View>
        ) : meals.length === 0 ? (
          <View
            style={[
              styles.emptyStateWell,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.textMuted}
              name="restaurant-outline"
              size={26}
            />
            <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
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
            style={styles.mealScroll}
          >
            {displayMeals.map((meal) => (
              <MealCatalogueEntry
                expanded={expandedMealId === meal.timelineEntryId}
                key={meal.timelineEntryId}
                meal={meal}
                onEdit={() => openEditMeal(meal)}
                onToggle={() => {
                  const willExpand = expandedMealId !== meal.timelineEntryId;
                  feedbackToggle(willExpand);
                  setExpandedMealId(
                    willExpand ? meal.timelineEntryId : null,
                  );
                }}
              />
            ))}
          </ScrollView>
        )}

        <PressOpacity
          accessibilityLabel="Log meal"
          onPress={() => openNewMeal(currentDay)}
          style={[
            styles.logMealFlowButton,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <Ionicons color={primaryText} name="add-circle" size={22} />
          <Text style={[styles.logMealFlowText, { color: primaryText }]}>
            Log Meal
          </Text>
        </PressOpacity>
      </View>

      {/* Card 3: Daily Totals Breakdown */}
      <View>
        {loading ? (
          <View
            accessibilityLabel="Loading daily nutrition totals"
            style={[
              styles.summary,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
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
                borderColor: theme.colors.borderStrong,
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
          <MacronutrientBreakdownCard
            incomplete={dailyTotals.incomplete}
            micronutrients={extraTotals}
            targets={DAILY_NUTRIENT_TARGETS}
            title="Daily totals"
            values={{
              carbohydratesG: dailyTotals.carbohydratesG,
              energyKcal: dailyTotals.energyKcal,
              fatG: dailyTotals.fatG,
              proteinG: dailyTotals.proteinG,
            }}
          />
        )}
      </View>
    </Screen>
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
          borderColor: expanded
            ? theme.colors.tertiary
            : theme.colors.borderStrong,
        },
      ]}
    >
      <View style={styles.mealTabRow}>
        <PressOpacity
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${
            meal.title
          }, ${formatTime(meal.loggedAt)}. ${formatMealTotalsForAccessibility(
            meal,
          )}`}
          onPress={onToggle}
          silent
          style={styles.mealTab}
        >
          <View style={styles.mealTabMain}>
            <View style={styles.mealTitleLine}>
              <Text
                numberOfLines={1}
                style={[styles.mealTitle, { color: theme.colors.text }]}
              >
                {meal.title}
              </Text>
              <Text style={[styles.mealTime, { color: theme.colors.textMuted }]}>
                {formatTime(meal.loggedAt)}
              </Text>
            </View>
            <Text
              style={[
                styles.mealTabNutrition,
                { color: theme.colors.textMuted },
              ]}
            >
              {nutritionSummary}
            </Text>
          </View>

          <Ionicons
            color={theme.colors.textMuted}
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
          />
        </PressOpacity>

        <PressOpacity
          accessibilityLabel={`Edit ${meal.title}`}
          onPress={onEdit}
          style={[
            styles.inlineEditBtn,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Ionicons
            color={theme.colors.tertiary}
            name="create-outline"
            size={18}
          />
        </PressOpacity>
      </View>

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
            <View style={styles.mealExpandedTop}>
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
                {meal.status === "planned" ? "PLANNED" : "COMPLETED"}
              </Text>
              <PressOpacity
                accessibilityLabel={`Edit ${meal.title}`}
                onPress={onEdit}
                style={[
                  styles.editMealPill,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.tertiary, fontSize: 12, fontWeight: "800" }}>
                  Edit Meal
                </Text>
              </PressOpacity>
            </View>

            <View style={styles.foodList}>
              {meal.items.map((item) => (
                <StoredFoodRow item={item} key={item.id} />
              ))}
            </View>
          </View>
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
      style={[
        styles.foodRow,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderLeftColor: theme.colors.tertiary,
        },
      ]}
    >
      <View style={styles.foodTopRow}>
        <Text
          numberOfLines={1}
          style={[styles.foodName, { color: theme.colors.text }]}
        >
          {item.description}
        </Text>
        <Text style={[styles.foodDetail, { color: theme.colors.textMuted }]}>
          {formatNumber(item.quantity)} × {item.servingDescription}
        </Text>
      </View>
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
    const serving = food?.servings.find(
      (candidate) => candidate.id === item.servingId,
    );

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
  return value === null ? "--" : formatNumber(value * quantity);
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
      month: "short",
      day: "numeric",
    })}`;
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
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

const styles = StyleSheet.create({
  noticeCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    padding: tokens.spacing.md,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
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
  badge: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dateNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  dateStepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 68,
    paddingHorizontal: tokens.spacing.sm,
  },
  dateStepLabel: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  selectedDatePill: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  catalogueState: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 120,
    padding: tokens.spacing.md,
  },
  emptyStateWell: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 112,
    padding: tokens.spacing.md,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: tokens.spacing.md,
  },
  mealScroll: {
    maxHeight: 340,
  },
  mealList: {
    gap: tokens.spacing.sm,
  },
  meal: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  mealTabRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    paddingRight: tokens.spacing.xs,
  },
  mealTab: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 56,
    paddingLeft: tokens.spacing.md,
    paddingRight: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
  },
  inlineEditBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  mealContent: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  mealDetails: {
    gap: tokens.spacing.sm,
  },
  mealExpandedTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editMealPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: tokens.spacing.sm,
  },
  mealTabMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  mealTitleLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  mealTabNutrition: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 15,
  },
  mealTitle: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "800",
    lineHeight: tokens.typography.body.lineHeight,
  },
  mealTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  mealStatus: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  foodList: {
    gap: tokens.spacing.xs,
  },
  foodRow: {
    borderLeftWidth: 3,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  foodTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  foodName: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    paddingRight: 8,
  },
  foodDetail: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  foodNutrients: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    lineHeight: 15,
  },
  logMealFlowButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
    width: "100%",
  },
  logMealFlowText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  summary: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.lg,
    minHeight: 144,
    padding: tokens.spacing.lg,
  },
});
