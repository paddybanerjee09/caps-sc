import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  NutritionActionBar,
  NutritionPage,
  NutritionTextInput,
} from "../../components/nutrition/NutritionChrome";
import { MacronutrientBreakdownCard } from "../../components/MacronutrientBreakdownCard";
import { PressOpacity } from "../../components/PressOpacity";
import { DAILY_NUTRIENT_TARGETS } from "../../constants/nutrition";
import {
  listFavourites,
  removeFavourite,
  setFavourite,
} from "../../data/nutritionCatalogRepository";
import {
  createId,
  favouriteConfigKey,
  formatCalorieInput,
  formatDerivedQuantity,
  scaleExtras,
  scaleSnapshot,
  sumExtraTotals,
} from "../../nutrition/calculations";
import type { DraftMealItem } from "../../nutrition/drafts";
import { convertServingQuantity, withServingUnits } from "../../nutrition/servings";
import { resolveCatalogFood } from "../../services/foodCatalog";
import { providerErrorMessage } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep, feedbackToggle } from "../../utils/feedback";
import type { CatalogFood, CatalogServing } from "../../types/nutrition";

const tokens = themes.dark;
const FAVOURITE_GOLD = "#EAB308";

export function NutritionFactsScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const {
    activeDraft,
    closeToRoot,
    completeCustomFood,
    facts,
    returnToMealLog,
    setFacts,
    stack,
    transitioning,
    updateDraft,
  } = useNutritionWorkspace();
  const [creatingCustomFood] = useState(() => {
    const screens = stack.map((entry) => entry.route.screen);
    const index = screens.lastIndexOf("facts");
    return index > 0 && screens[index - 1] === "customFood";
  });
  const foodRef = facts?.food;
  const snapshot = facts?.snapshot;
  const [food, setFood] = useState<CatalogFood | null>(() =>
    snapshot ? withServingUnits(snapshot) : null,
  );
  const [loading, setLoading] = useState(facts?.snapshot == null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favouritePending, setFavouritePending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void listFavourites(db).then((rows) => {
      if (!cancelled) {
        setFavourites(rows.map((row) => row.configKey));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [db, favouritePending]);

  useEffect(() => {
    if (!foodRef || (snapshot && retry === 0)) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);

      void resolveCatalogFood(db, foodRef)
        .then((resolved) => {
          if (cancelled) {
            return;
          }

          if (!resolved) {
            setError("Nutrition details are unavailable.");
            setLoading(false);
            return;
          }

          setFood(withServingUnits(resolved));
          setLoading(false);
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setError(providerErrorMessage(reason, "Couldn't load this food."));
            setLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [db, foodRef, snapshot, retry]);

  if (!facts) {
    return null;
  }

  const session = facts;
  const activeText = readableTextColor(theme.colors.tertiary);

  const serving =
    food?.servings.find((candidate) => candidate.id === facts.servingId) ??
    food?.servings.find(
      (candidate) => candidate.id === food.defaultServingId,
    ) ??
    null;
  const amount = Number(facts.amountInput);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const energy = serving?.nutrients.energyKcal ?? null;
  const caloriesCanDrive = energy !== null && energy > 0;
  const calorieText =
    facts.inputMode === "calories"
      ? facts.calorieInput
      : energy !== null && amountValid
        ? formatCalorieInput(energy * amount)
        : "";
  const scaled =
    serving && amountValid ? scaleSnapshot(serving.nutrients, amount) : null;
  const scaledExtras =
    serving && amountValid ? scaleExtras(serving.extras, amount) : [];
  const configKey =
    food && serving && amountValid
      ? favouriteConfigKey(food.ref, serving.id, amount)
      : null;
  const favourited = configKey !== null && favourites.includes(configKey);

  function changeAmount(value: string) {
    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setFacts({
      ...session,
      amountInput: value,
      inputMode: "amount",
    });
  }

  function changeCalories(value: string) {
    if (
      !caloriesCanDrive ||
      !/^\d*\.?\d*$/.test(value) ||
      !serving ||
      energy === null
    ) {
      return;
    }

    const calories = Number(value);
    setFacts({
      ...session,
      amountInput:
        Number.isFinite(calories) && calories > 0
          ? formatDerivedQuantity(calories / energy)
          : "",
      calorieInput: value,
      inputMode: "calories",
    });
  }

  function selectServing(next: CatalogServing) {
    feedbackStep("up");
    setFacts({
      ...session,
      amountInput: serving && amountValid
        ? formatDerivedQuantity(convertServingQuantity(amount, serving, next))
        : session.amountInput,
      inputMode: "amount",
      servingId: next.id,
    });
  }

  async function toggleFavourite() {
    if (!configKey || !food || !serving || !amountValid || favouritePending) {
      return;
    }

    setFavouritePending(true);
    feedbackToggle(!favourited);

    try {
      if (favourited) {
        await removeFavourite(db, configKey);
      } else {
        await setFavourite(db, {
          amount,
          configKey,
          food: food.ref,
          servingId: serving.id,
          snapshot: food,
        });
      }
    } finally {
      setFavouritePending(false);
    }
  }

  function addToMeal() {
    if (!activeDraft || !food || !serving || !amountValid || transitioning) {
      return;
    }

    const item: DraftMealItem = {
      brandName: food.brandName,
      clientId: session.draftItemId ?? createId(),
      description: food.name,
      extrasPerServing: serving.extras,
      food: food.ref,
      nutrientsPerServing: serving.nutrients,
      quantityInput: session.amountInput.trim(),
      resolved: true,
      servingAmount: serving.amount,
      servingDescription: serving.label,
      servingId: serving.id,
      servingUnit: serving.unit,
      storagePolicy: food.storagePolicy,
    };

    feedbackConfirm();
    updateDraft(activeDraft.key, (draft) => ({
      ...draft,
      items: session.draftItemId
        ? draft.items.map((current) =>
            current.clientId === session.draftItemId ? item : current,
          )
        : [...draft.items, item],
    }));
    returnToMealLog();
  }

  return (
    <NutritionPage
      footer={
        <NutritionActionBar
          right={
            creatingCustomFood
              ? {
                  accessibilityLabel: "Create custom food",
                  label: "Create Custom Food",
                  onPress: () => {
                    feedbackConfirm();
                    completeCustomFood();
                  },
                }
              : {
                  accessibilityLabel: facts.draftItemId
                    ? "Update item"
                    : "Add to meal",
                  disabled: !serving || !amountValid,
                  label: facts.draftItemId ? "Update Item" : "Add to Meal",
                  onPress: addToMeal,
                }
          }
        />
      }
      onClose={closeToRoot}
      right={
        <PressOpacity
          accessibilityLabel={
            favourited ? "Remove favourite" : "Save favourite"
          }
          disabled={!configKey || favouritePending}
          onPress={() => void toggleFavourite()}
          silent
          style={[
            styles.star,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons
            color={FAVOURITE_GOLD}
            name={favourited ? "star" : "star-outline"}
            size={22}
          />
        </PressOpacity>
      }
      title={food?.name ?? "Food"}
    >
      {loading ? <ActivityIndicator color={theme.colors.tertiary} /> : null}
      {error ? (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.body, { color: theme.colors.text }]}>
            {error}
          </Text>
          <PressOpacity
            accessibilityLabel="Retry loading food"
            onPress={() => setRetry((value) => value + 1)}
            style={styles.retry}
          >
            <Text style={{ color: theme.colors.tertiary, fontWeight: "800" }}>
              Retry
            </Text>
          </PressOpacity>
        </View>
      ) : null}

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
            SERVING UNIT & QUANTITY
          </Text>
          {food?.attribution ? (
            <Text style={[styles.attribution, { color: theme.colors.textMuted }]}>
              {food.attribution === "fatsecret"
                ? "fatsecret"
                : food.attribution}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>
          SERVING SIZE (SWIPE)
        </Text>
        <ScrollView
          contentContainerStyle={styles.presetStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {(food?.servings ?? []).map((option) => {
            const selected = option.id === serving?.id;
            return (
              <PressOpacity
                accessibilityLabel={
                  selected ? `${option.label}, selected` : option.label
                }
                accessibilityState={{ selected }}
                key={option.id}
                onPress={() => selectServing(option)}
                silent
                style={[
                  styles.servingPill,
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
                    styles.servingPillText,
                    { color: selected ? activeText : theme.colors.text },
                  ]}
                >
                  {option.label}
                </Text>
              </PressOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>
          QUANTITY
        </Text>
        <View style={styles.inputRow}>

          <NutritionTextInput
            accessibilityLabel="Serving amount"
            keyboardType="decimal-pad"
            onChangeText={changeAmount}
            placeholder="1"
            style={styles.centerInput}
            value={facts.amountInput}
          />

        </View>

      </View>

      <MacronutrientBreakdownCard
        compact
        energyInput={{
          editable: caloriesCanDrive,
          invalid: facts.inputMode === "calories" && !amountValid,
          onChangeText: changeCalories,
          value: calorieText,
        }}
        incomplete={{
          carbohydratesG: scaled?.carbohydratesG == null,
          energyKcal: scaled?.energyKcal == null,
          fatG: scaled?.fatG == null,
          proteinG: scaled?.proteinG == null,
        }}
        micronutrients={sumExtraTotals([
          { extrasPerServing: scaledExtras, quantity: 1 },
        ])}
        targets={DAILY_NUTRIENT_TARGETS}
        title="Nutrition for this amount"
        values={
          scaled ?? {
            carbohydratesG: null,
            energyKcal: null,
            fatG: null,
            proteinG: null,
          }
        }
      />
    </NutritionPage>
  );
}

const styles = StyleSheet.create({
  star: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
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
  subLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  servingPill: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  servingPillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  centerInput: {
    flex: 1,
    fontVariant: ["tabular-nums"],
    minHeight: 48,
    textAlign: "center",
  },
  presetStrip: {
    gap: 6,
  },
  body: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  attribution: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  retry: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 48,
  },
});
