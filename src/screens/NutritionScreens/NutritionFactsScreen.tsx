import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { NutritionActionBar, NutritionPage } from "../../components/nutrition/NutritionChrome";
import { MacronutrientBreakdownCard } from "../../components/MacronutrientBreakdownCard";
import { PressOpacity } from "../../components/PressOpacity";
import { DAILY_NUTRIENT_TARGETS } from "../../constants/nutrition";
import { listFavourites, removeFavourite, setFavourite } from "../../data/nutritionCatalogRepository";
import {
  createId,
  favouriteConfigKey,
  formatCalorieInput,
  formatDerivedQuantity,
  scaleExtras,
  scaleSnapshot,
  servingTotalLabel,
  sumExtraTotals,
} from "../../nutrition/calculations";
import type { DraftMealItem } from "../../nutrition/drafts";
import { resolveCatalogFood } from "../../services/foodCatalog";
import { providerErrorMessage } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { CatalogFood, CatalogServing } from "../../types/nutrition";

const tokens = themes.dark;
const FAVOURITE_GOLD = "#C9A227";

export function NutritionFactsScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const {
    activeDraft,
    facts,
    pop,
    registerBackHandler,
    returnToMealLog,
    setFacts,
    transitioning,
    updateDraft,
  } = useNutritionWorkspace();
  const [food, setFood] = useState<CatalogFood | null>(facts?.snapshot ?? null);
  const [loading, setLoading] = useState(facts?.snapshot == null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favouritePending, setFavouritePending] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

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
    if (!facts || (facts.snapshot && retry === 0)) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);

      void resolveCatalogFood(db, facts.food)
        .then((resolved) => {
          if (cancelled) {
            return;
          }

          if (!resolved) {
            setError("Nutrition details are unavailable.");
            setLoading(false);
            return;
          }

          setFood(resolved);
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
  }, [db, facts, retry]);

  useEffect(() => {
    if (!selectorOpen) {
      return;
    }

    return registerBackHandler(() => {
      setSelectorOpen(false);
      return true;
    });
  }, [registerBackHandler, selectorOpen]);

  if (!facts) {
    return null;
  }

  const session = facts;

  const serving =
    food?.servings.find((candidate) => candidate.id === facts.servingId) ??
    food?.servings.find((candidate) => candidate.id === food.defaultServingId) ??
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
  const scaled = serving && amountValid ? scaleSnapshot(serving.nutrients, amount) : null;
  const scaledExtras =
    serving && amountValid ? scaleExtras(serving.extras, amount) : [];
  const configKey =
    food && serving && amountValid
      ? favouriteConfigKey(food.ref, serving.id, amount)
      : null;
  const favourited = configKey !== null && favourites.includes(configKey);
  const description = serving
    ? servingTotalLabel(facts.amountInput, serving.amount, serving.unit, serving.label)
    : null;

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
    if (!caloriesCanDrive || !/^\d*\.?\d*$/.test(value) || !serving || energy === null) {
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

  function toggleSelector() {
    if (!selectorOpen) {
      Keyboard.dismiss();
    }

    setSelectorOpen((open) => !open);
  }

  function selectServing(next: CatalogServing) {
    setSelectorOpen(false);
    setFacts({
      ...session,
      inputMode: "amount",
      servingId: next.id,
    });
  }

  async function toggleFavourite() {
    if (!configKey || !food || !serving || !amountValid || favouritePending) {
      return;
    }

    setFavouritePending(true);

    try {
      if (favourited) {
        await removeFavourite(db, configKey);
      } else {
        await setFavourite(db, {
          amount,
          configKey,
          food: food.ref,
          servingId: serving.id,
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
          left={{ accessibilityLabel: "Back", label: "Back", onPress: pop }}
          right={{
            accessibilityLabel: facts.draftItemId ? "Update item" : "Add to meal",
            disabled: !serving || !amountValid,
            label: facts.draftItemId ? "Update Item" : "Add to Meal",
            onPress: addToMeal,
          }}
        />
      }
      onClose={pop}
      right={
        <PressOpacity
          accessibilityLabel={favourited ? "Remove favourite" : "Save favourite"}
          disabled={!configKey || favouritePending}
          onPress={() => void toggleFavourite()}
          style={styles.star}
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
        <View>
          <Text style={[styles.body, { color: theme.colors.text }]}>{error}</Text>
          <PressOpacity
            accessibilityLabel="Retry loading food"
            onPress={() => setRetry((value) => value + 1)}
            style={styles.retry}
          >
            <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
          </PressOpacity>
        </View>
      ) : null}
      {food?.attribution ? (
        <Text style={[styles.attribution, { color: theme.colors.textMuted }]}>
          {food.attribution === "fatsecret"
            ? "Nutrition information from fatsecret"
            : `Product data from ${food.attribution}`}
        </Text>
      ) : null}
      <Text style={[styles.label, { color: theme.colors.text }]}>Amount</Text>
      <TextInput
        accessibilityLabel="Serving amount"
        keyboardType="decimal-pad"
        onChangeText={changeAmount}
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
        value={facts.amountInput}
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Serving</Text>
      {selectorOpen ? (
        <PressOpacity
          accessibilityLabel="Close serving options"
          onPress={() => setSelectorOpen(false)}
          style={styles.servingBackdrop}
        />
      ) : null}
      <View style={styles.servingMenu}>
        <PressOpacity
          accessibilityLabel={`Serving, ${serving?.label ?? "unavailable"}`}
          disabled={!food || food.servings.length === 0}
          onPress={toggleSelector}
          style={[styles.servingButton, { borderColor: theme.colors.border }]}
        >
          <Text
            numberOfLines={1}
            style={[styles.servingLabel, { color: theme.colors.text }]}
          >
            {serving?.label ?? "Unavailable"}
          </Text>
          <Ionicons
            color={theme.colors.textMuted}
            name={selectorOpen ? "chevron-up" : "chevron-down"}
            size={16}
          />
        </PressOpacity>
        {selectorOpen && food && food.servings.length > 0 ? (
          <View
            style={[
              styles.servingDropdown,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.servingOptions}
            >
              {food.servings.map((option, index) => {
                const selected = option.id === serving?.id;

                return (
                  <PressOpacity
                    accessibilityLabel={
                      selected ? `${option.label}, selected` : option.label
                    }
                    key={option.id}
                    onPress={() => selectServing(option)}
                    style={[
                      styles.servingOption,
                      index > 0 && {
                        borderTopColor: theme.colors.border,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.servingOptionLabel, { color: theme.colors.text }]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons
                        color={theme.colors.tertiary}
                        name="checkmark"
                        size={20}
                      />
                    ) : (
                      <View style={styles.checkmarkSpace} />
                    )}
                  </PressOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>
      {description ? (
        <Text style={[styles.body, { color: theme.colors.textMuted }]}>{description}</Text>
      ) : null}
      <Text style={[styles.label, { color: theme.colors.text }]}>Calories</Text>
      <TextInput
        accessibilityLabel="Calories"
        editable={caloriesCanDrive}
        keyboardType="decimal-pad"
        onChangeText={changeCalories}
        placeholder={caloriesCanDrive ? undefined : "Unavailable"}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
        value={calorieText}
      />
      <MacronutrientBreakdownCard
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
        micronutrients={sumExtraTotals([{ extrasPerServing: scaledExtras, quantity: 1 }])}
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
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    paddingTop: tokens.spacing.md,
  },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
  },
  servingBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  servingMenu: {
    zIndex: 2,
  },
  servingButton: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
  },
  servingLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
  },
  servingDropdown: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.24)",
    left: 0,
    marginTop: tokens.spacing.xs,
    position: "absolute",
    right: 0,
    top: "100%",
  },
  servingOptions: {
    maxHeight: 240,
  },
  servingOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  servingOptionLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  checkmarkSpace: {
    width: 20,
  },
  body: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    paddingTop: tokens.spacing.sm,
  },
  attribution: {
    fontSize: tokens.typography.label.fontSize,
    paddingTop: tokens.spacing.sm,
  },
  retry: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
});
