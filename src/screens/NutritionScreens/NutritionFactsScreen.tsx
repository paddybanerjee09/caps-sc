import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { convertServingQuantity, servingUnitOptions, withServingUnits } from "../../nutrition/servings";
import { resolveCatalogFood } from "../../services/foodCatalog";
import { providerErrorMessage } from "../../services/providerError";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
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
    registerBackHandler,
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
  const pageRef = useRef<ComponentRef<typeof View>>(null);
  const unitsRef = useRef<ComponentRef<typeof View>>(null);
  const pageWidthRef = useRef<number | null>(null);
  const [unitsMenu, setUnitsMenu] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => registerBackHandler(() => {
    if (!unitsMenu) return false;
    setUnitsMenu(null);
    return true;
  }), [registerBackHandler, unitsMenu]);

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
    setUnitsMenu(null);
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

  function openUnits() {
    Keyboard.dismiss();
    pageRef.current?.measureInWindow((pageX, pageY, pageWidth, pageHeight) => {
      unitsRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
        const width = Math.min(Math.max(buttonWidth, 200), pageWidth - 16);
        const below = pageHeight - (y - pageY + buttonHeight) - 8;
        const above = y - pageY - 8;
        const opensBelow = below >= Math.min(240, above);
        const maxHeight = Math.max(48, Math.min(288, opensBelow ? below : above));
        setUnitsMenu({
          left: Math.min(Math.max(8, x - pageX), pageWidth - width - 8),
          top: opensBelow ? y - pageY + buttonHeight + 4 : Math.max(8, y - pageY - maxHeight - 4),
          width,
          maxHeight,
        });
      });
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
    <View
      ref={pageRef}
      collapsable={false}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (pageWidthRef.current !== null && pageWidthRef.current !== width) setUnitsMenu(null);
        pageWidthRef.current = width;
      }}
      style={styles.page}
    >
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

        <View style={styles.inputRow}>
          <View style={styles.quantityField}>
            <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>QUANTITY</Text>
            <NutritionTextInput
              accessibilityLabel="Serving quantity"
              keyboardType="decimal-pad"
              onChangeText={changeAmount}
              placeholder="1"
              style={styles.centerInput}
              value={facts.amountInput}
            />
          </View>
          <View ref={unitsRef} collapsable={false} style={styles.unitsField}>
            <Text style={[styles.subLabel, { color: theme.colors.textMuted }]}>SERVING UNITS</Text>
            <PressOpacity
              accessibilityLabel={`Serving units, ${serving?.label ?? "Choose units"}`}
              accessibilityState={{ expanded: unitsMenu != null, disabled: !food }}
              disabled={!food}
              onPress={openUnits}
              style={[styles.unitsButton, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
            >
              <Text style={[styles.unitsText, { color: theme.colors.text }]}>{serving?.label ?? "Choose units"}</Text>
              <Ionicons color={theme.colors.textMuted} name="chevron-down" size={16} />
            </PressOpacity>
          </View>
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
    {unitsMenu && food ? (
      <View accessibilityViewIsModal style={styles.unitsOverlay}>
        <PressOpacity accessibilityLabel="Close serving units" onPress={() => setUnitsMenu(null)} style={StyleSheet.absoluteFill} silent />
        <View style={[styles.unitsMenu, unitsMenu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {servingUnitOptions(food, serving?.id).map((option) => (
              <PressOpacity accessibilityLabel={option.label} accessibilityState={{ selected: option.id === serving?.id }} key={option.id} onPress={() => selectServing(option)} style={[styles.unitChoice, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.unitsText, { color: theme.colors.text }]}>{option.label}</Text>
                {option.id === serving?.id ? <Ionicons color={theme.colors.tertiary} name="checkmark" size={18} /> : null}
              </PressOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
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
  unitsButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  unitsText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  inputRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 6,
  },
  quantityField: { flex: 1, gap: 6 },
  unitsField: { flex: 2, gap: 6 },
  unitsOverlay: { ...StyleSheet.absoluteFill, zIndex: 10 },
  unitsMenu: { borderWidth: 1, borderRadius: tokens.radius.md, overflow: "hidden", position: "absolute", boxShadow: "0px 6px 16px rgba(0, 0, 0, 0.24)" },
  unitChoice: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  centerInput: {
    width: "100%",
    fontVariant: ["tabular-nums"],
    minHeight: 48,
    textAlign: "center",
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
