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
import { MealLogModal } from "../components/MealLogModal";
import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { DAILY_NUTRIENT_TARGETS } from "../constants/nutrition";
import {
  calculateNutrientTotals,
  getMealLogsForDay,
} from "../data/nutritionRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { StoredMealItem, StoredMealLog } from "../types/nutrition";

const tokens = themes.dark;

export function NutritionScreen() {
  const db = useSQLiteContext();
  const { height } = useWindowDimensions();
  const { theme } = useAppTheme();
  const [currentDay, setCurrentDay] = useState(() => new Date());
  const [meals, setMeals] = useState<StoredMealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<StoredMealLog | null>(null);
  const requestId = useRef(0);

  const { dayStart, dayEnd } = useMemo(
    () => getLocalDayBounds(currentDay),
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
        setDatabaseError("Couldn’t load today’s meals");
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }, [dayEnd, dayStart, db]);

  useEffect(() => {
    void loadMeals();

    return () => {
      requestId.current += 1;
    };
  }, [loadMeals]);

  useEffect(() => {
    const millisecondsUntilTomorrow = Math.max(
      1000,
      dayEnd.getTime() - Date.now() + 250,
    );
    const timer = setTimeout(
      () => setCurrentDay(new Date()),
      millisecondsUntilTomorrow,
    );

    return () => clearTimeout(timer);
  }, [dayEnd]);

  const dailyTotals = useMemo(
    () => calculateNutrientTotals(meals.flatMap((meal) => meal.items)),
    [meals],
  );
  const catalogueHeight = clamp(height * 0.42, 240, 420);

  function openNewMeal() {
    setSelectedMeal(null);
    setMealModalOpen(true);
  }

  function openMeal(meal: StoredMealLog) {
    setSelectedMeal(meal);
    setMealModalOpen(true);
  }

  function closeMealModal() {
    setMealModalOpen(false);
    setSelectedMeal(null);
  }

  async function handleMealSaved() {
    await loadMeals();
  }

  return (
    <Screen centerTitle title="Nutrition">
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Today’s meals
        </Text>
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
                No meals logged today
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.mealList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {meals.map((meal) => (
                <MealCatalogueEntry
                  key={meal.timelineEntryId}
                  meal={meal}
                  onPress={() => openMeal(meal)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <PressOpacity
          accessibilityLabel="Log meal"
          onPress={openNewMeal}
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
        )}
      </View>

      <MealLogModal
        mealToEdit={selectedMeal ?? undefined}
        onClose={closeMealModal}
        onDeleted={handleMealSaved}
        onSaved={handleMealSaved}
        visible={mealModalOpen}
      />
    </Screen>
  );
}

function MealCatalogueEntry({
  meal,
  onPress,
}: {
  meal: StoredMealLog;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={`${meal.title}, logged at ${formatTime(
        meal.loggedAt,
      )}. ${formatMealTotalsForAccessibility(meal)}`}
      onPress={onPress}
      style={[
        styles.meal,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.mealHeader}>
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

      <Text style={[styles.mealTotals, { color: theme.colors.text }]}>
        {formatTotal(meal.totals.energyKcal, meal.totals.incomplete.energyKcal)}{" "}
        kcal · P{" "}
        {formatTotal(meal.totals.proteinG, meal.totals.incomplete.proteinG)} g ·
        C{" "}
        {formatTotal(
          meal.totals.carbohydratesG,
          meal.totals.incomplete.carbohydratesG,
        )}{" "}
        g · F {formatTotal(meal.totals.fatG, meal.totals.incomplete.fatG)} g
      </Text>

      <View style={styles.foodList}>
        {meal.items.map((item) => (
          <StoredFoodRow item={item} key={item.id} />
        ))}
      </View>
    </PressOpacity>
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

function formatMealTotalsForAccessibility(meal: StoredMealLog) {
  const totals = meal.totals;
  const isIncomplete = Object.values(totals.incomplete).some(Boolean);
  const energyPrefix = totals.incomplete.energyKcal ? "at least " : "";
  const proteinPrefix = totals.incomplete.proteinG ? "at least " : "";
  const carbohydratesPrefix = totals.incomplete.carbohydratesG
    ? "at least "
    : "";
  const fatPrefix = totals.incomplete.fatG ? "at least " : "";

  return `${energyPrefix}${formatNumber(
    totals.energyKcal,
    0,
  )} kilocalories, ${proteinPrefix}${formatNumber(
    totals.proteinG,
  )} grams protein, ${carbohydratesPrefix}${formatNumber(
    totals.carbohydratesG,
  )} grams carbohydrates, and ${fatPrefix}${formatNumber(
    totals.fatG,
  )} grams fat.${isIncomplete ? " Incomplete nutrition data." : ""}`;
}

function formatNullableContribution(value: number | null, quantity: number) {
  return value === null ? "—" : formatNumber(value * quantity);
}

function formatTotal(value: number, incomplete: boolean) {
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

function getLocalDayBounds(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return { dayEnd, dayStart };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: tokens.spacing.sm,
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
    padding: tokens.spacing.md,
  },
  mealHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
  },
  mealTitle: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  mealTime: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  mealTotals: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.label.lineHeight,
    paddingTop: tokens.spacing.xs,
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
});
