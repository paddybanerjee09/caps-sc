import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DAILY_NUTRIENT_TARGETS } from "../constants/nutrition";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  DraftMealItem,
  NormalizedFoodDetails,
  NormalizedFoodSearchResult,
  NutrientBasis,
  NutrientSnapshot,
  ServingOption,
} from "../types/nutrition";
import { MacronutrientBreakdownCard } from "./MacronutrientBreakdownCard";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const STORED_OPTION_ID = "stored";

export type FoodServingEditorProps = {
  food: Pick<
    NormalizedFoodSearchResult,
    "fdcId" | "description" | "brandName"
  >;
  details?: NormalizedFoodDetails;
  itemToEdit?: DraftMealItem;
  detailsLoading?: boolean;
  detailsError?: string | null;
  onRetryDetails?: () => void;
  onCancel: () => void;
  onConfirm: (item: DraftMealItem) => void;
};

export function FoodServingEditor({
  food,
  details,
  itemToEdit,
  detailsLoading = false,
  detailsError = null,
  onRetryDetails,
  onCancel,
  onConfirm,
}: FoodServingEditorProps) {
  const { theme } = useAppTheme();
  const [quantityInput, setQuantityInput] = useState(
    itemToEdit?.quantityInput ?? "1",
  );
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    itemToEdit ? STORED_OPTION_ID : null,
  );
  const [servingSelectorOpen, setServingSelectorOpen] = useState(false);

  const matchingDetails =
    details?.fdcId === food.fdcId ? details : undefined;
  const servingOptions = useMemo(
    () => mergeServingOptions(itemToEdit, matchingDetails),
    [itemToEdit, matchingDetails],
  );

  useEffect(() => {
    setQuantityInput(itemToEdit?.quantityInput ?? "1");
    setSelectedOptionId(itemToEdit ? STORED_OPTION_ID : null);
    setServingSelectorOpen(false);
  }, [food.fdcId, itemToEdit]);

  useEffect(() => {
    if (itemToEdit || selectedOptionId !== null || !matchingDetails) {
      return;
    }

    const defaultOptionExists = matchingDetails.servingOptions.some(
      (option) => option.id === matchingDetails.defaultServingOptionId,
    );
    setSelectedOptionId(
      defaultOptionExists
        ? matchingDetails.defaultServingOptionId
        : matchingDetails.servingOptions[0]?.id ?? null,
    );
  }, [itemToEdit, matchingDetails, selectedOptionId]);

  const selectedOption =
    servingOptions.find((option) => option.id === selectedOptionId) ?? null;
  const selectedBasis = getBasisForSelection(
    selectedOption,
    itemToEdit,
    matchingDetails,
  );
  const nutrientsPerServing = getNutrientsPerServing(
    selectedOption,
    selectedBasis,
    itemToEdit,
  );
  const quantity = Number(quantityInput);
  const quantityIsValid = Number.isFinite(quantity) && quantity > 0;
  const configuredNutrients =
    nutrientsPerServing && quantityIsValid
      ? scaleNutrients(nutrientsPerServing, quantity)
      : emptyNutrients();
  const incomplete = getIncompleteNutrients(configuredNutrients);
  const hasUsableNutrition =
    nutrientsPerServing !== null &&
    Object.values(nutrientsPerServing).some((value) => value !== null);
  const canConfirm =
    selectedOption !== null &&
    Number.isFinite(selectedOption.amount) &&
    selectedOption.amount > 0 &&
    quantityIsValid &&
    hasUsableNutrition;

  function changeQuantity(value: string) {
    if (/^\d*\.?\d*$/.test(value)) {
      setQuantityInput(value);
    }
  }

  function confirmSelection() {
    if (!canConfirm || !selectedOption || !nutrientsPerServing) {
      return;
    }

    const verifiedOptions = servingOptions.filter(
      (option) => option.source !== "stored",
    );
    const draftNutrientBasis =
      matchingDetails?.nutrientBasis ?? selectedBasis;

    onConfirm({
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName,
      quantityInput: quantityInput.trim(),
      servingAmount: selectedOption.amount,
      servingUnit: selectedOption.unit,
      servingDescription: selectedOption.label,
      nutrientsPerServing,
      ...(draftNutrientBasis
        ? { nutrientBasis: draftNutrientBasis }
        : {}),
      ...(verifiedOptions.length > 0
        ? { servingOptions: verifiedOptions }
        : {}),
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.foodHeading}>
        <Text
          numberOfLines={2}
          style={[styles.foodName, { color: theme.colors.text }]}
        >
          {food.description}
        </Text>
        {food.brandName ? (
          <Text
            numberOfLines={1}
            style={[styles.brandName, { color: theme.colors.textMuted }]}
          >
            {food.brandName}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Amount</Text>
        <View style={styles.amountRow}>
          <TextInput
            accessibilityLabel={`Amount of ${food.description}`}
            keyboardType="decimal-pad"
            onChangeText={changeQuantity}
            placeholder="1"
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.tertiary}
            style={[
              styles.amountInput,
              {
                borderColor: theme.colors.borderStrong,
                color: theme.colors.text,
              },
            ]}
            value={quantityInput}
          />
          <Text style={[styles.amountUnit, { color: theme.colors.textMuted }]}>
            servings
          </Text>
        </View>
        {quantityInput.length > 0 && !quantityIsValid ? (
          <Text style={[styles.validationText, { color: theme.colors.textMuted }]}>
            Enter an amount greater than zero.
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Serving</Text>

        {servingOptions.length > 0 ? (
          <View
            style={[
              styles.servingSelector,
              { borderColor: theme.colors.borderStrong },
            ]}
          >
            <Pressable
              accessibilityLabel={`Serving size, ${
                selectedOption?.label ?? "not selected"
              }`}
              accessibilityRole="button"
              accessibilityState={{ expanded: servingSelectorOpen }}
              onPress={() =>
                setServingSelectorOpen((currentValue) => !currentValue)
              }
              style={({ pressed }) => [
                styles.servingSelectorButton,
                { backgroundColor: theme.colors.surfaceMuted },
                pressed && { opacity: tokens.opacity.pressed },
              ]}
            >
              <Text
                numberOfLines={2}
                style={[
                  styles.servingLabel,
                  { color: theme.colors.text },
                ]}
              >
                {selectedOption?.label ?? "Choose a serving"}
              </Text>
              <Ionicons
                color={theme.colors.textMuted}
                name={servingSelectorOpen ? "chevron-up" : "chevron-down"}
                size={20}
              />
            </Pressable>

            {servingSelectorOpen ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
                style={[
                  styles.servingOptions,
                  { borderTopColor: theme.colors.border },
                ]}
              >
                {servingOptions.map((option, index) => {
                  const selected = option.id === selectedOptionId;

                  return (
                    <Pressable
                      accessibilityLabel={`${option.label} serving`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={option.id}
                      onPress={() => {
                        setSelectedOptionId(option.id);
                        setServingSelectorOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.servingOption,
                        index > 0 && {
                          borderTopColor: theme.colors.border,
                          borderTopWidth: 1,
                        },
                        pressed && {
                          backgroundColor: theme.colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.servingLabel,
                          {
                            color: selected
                              ? theme.colors.tertiary
                              : theme.colors.text,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                      {selected ? (
                        <Ionicons
                          color={theme.colors.tertiary}
                          name="checkmark"
                          size={20}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {detailsLoading ? (
          <View style={styles.detailsState}>
            <ActivityIndicator color={theme.colors.tertiary} size="small" />
            <Text
              style={[styles.detailsStateText, { color: theme.colors.textMuted }]}
            >
              Loading serving options…
            </Text>
          </View>
        ) : detailsError ? (
          <View style={styles.detailsError}>
            <Text
              style={[styles.detailsStateText, { color: theme.colors.textMuted }]}
            >
              {detailsError}
            </Text>
            {onRetryDetails ? (
              <PressOpacity
                accessibilityLabel="Retry loading serving options"
                onPress={onRetryDetails}
                style={styles.retryButton}
              >
                <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
              </PressOpacity>
            ) : null}
          </View>
        ) : servingOptions.length === 0 ? (
          <Text
            style={[styles.detailsStateText, { color: theme.colors.textMuted }]}
          >
            No serving options are available.
          </Text>
        ) : null}
      </View>

      <MacronutrientBreakdownCard
        incomplete={incomplete}
        targets={DAILY_NUTRIENT_TARGETS}
        title="Nutrition for this amount"
        values={configuredNutrients}
      />

      <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
        <PressOpacity
          accessibilityLabel="Back to meal"
          onPress={onCancel}
          style={styles.actionButton}
        >
          <Text style={{ color: theme.colors.textMuted }}>Back</Text>
        </PressOpacity>

        <PressOpacity
          accessibilityLabel={itemToEdit ? "Update food" : "Add food to meal"}
          disabled={!canConfirm}
          onPress={confirmSelection}
          style={styles.actionButton}
        >
          <Text style={{ color: theme.colors.tertiary }}>
            {itemToEdit ? "Update Food" : "Add to Meal"}
          </Text>
        </PressOpacity>
      </View>
    </View>
  );
}

function mergeServingOptions(
  itemToEdit: DraftMealItem | undefined,
  details: NormalizedFoodDetails | undefined,
) {
  const merged = new Map<string, ServingOption>();

  if (itemToEdit) {
    merged.set(STORED_OPTION_ID, {
      id: STORED_OPTION_ID,
      label: itemToEdit.servingDescription,
      amount: itemToEdit.servingAmount,
      unit: itemToEdit.servingUnit,
      source: "stored",
    });

    for (const option of itemToEdit.servingOptions ?? []) {
      if (option.id !== STORED_OPTION_ID) {
        merged.set(option.id, option);
      }
    }
  }

  for (const option of details?.servingOptions ?? []) {
    if (option.id !== STORED_OPTION_ID) {
      merged.set(option.id, option);
    }
  }

  const storedOption = merged.get(STORED_OPTION_ID);

  return Array.from(merged.values()).filter(
    (option) =>
      option.id === STORED_OPTION_ID ||
      !storedOption ||
      !servingOptionsMatch(option, storedOption),
  );
}

function servingOptionsMatch(left: ServingOption, right: ServingOption) {
  return (
    left.unit === right.unit &&
    Math.abs(left.amount - right.amount) <= 0.001 &&
    normalizeServingLabel(left.label) === normalizeServingLabel(right.label)
  );
}

function normalizeServingLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function getBasisForSelection(
  option: ServingOption | null,
  itemToEdit: DraftMealItem | undefined,
  details: NormalizedFoodDetails | undefined,
): NutrientBasis | undefined {
  if (!option || option.id === STORED_OPTION_ID) {
    return itemToEdit?.nutrientBasis;
  }

  if (details?.servingOptions.some((candidate) => candidate.id === option.id)) {
    return details.nutrientBasis;
  }

  return itemToEdit?.nutrientBasis;
}

function getNutrientsPerServing(
  option: ServingOption | null,
  basis: NutrientBasis | undefined,
  itemToEdit: DraftMealItem | undefined,
): NutrientSnapshot | null {
  if (!option) {
    return null;
  }

  if (option.id === STORED_OPTION_ID && itemToEdit) {
    return { ...itemToEdit.nutrientsPerServing };
  }

  if (
    !basis ||
    basis.unit !== option.unit ||
    !Number.isFinite(basis.amount) ||
    basis.amount <= 0
  ) {
    return null;
  }

  return scaleNutrients(basis.nutrients, option.amount / basis.amount);
}

function scaleNutrients(
  nutrients: NutrientSnapshot,
  multiplier: number,
): NutrientSnapshot {
  return {
    energyKcal:
      nutrients.energyKcal === null
        ? null
        : nutrients.energyKcal * multiplier,
    proteinG:
      nutrients.proteinG === null ? null : nutrients.proteinG * multiplier,
    carbohydratesG:
      nutrients.carbohydratesG === null
        ? null
        : nutrients.carbohydratesG * multiplier,
    fatG: nutrients.fatG === null ? null : nutrients.fatG * multiplier,
  };
}

function emptyNutrients(): NutrientSnapshot {
  return {
    energyKcal: null,
    proteinG: null,
    carbohydratesG: null,
    fatG: null,
  };
}

function getIncompleteNutrients(
  nutrients: NutrientSnapshot,
): Record<keyof NutrientSnapshot, boolean> {
  return {
    energyKcal: nutrients.energyKcal === null,
    proteinG: nutrients.proteinG === null,
    carbohydratesG: nutrients.carbohydratesG === null,
    fatG: nutrients.fatG === null,
  };
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.lg,
  },
  foodHeading: {
    gap: tokens.spacing.xs,
  },
  foodName: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  brandName: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  field: {
    gap: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  amountInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
    textAlign: "center",
    width: 88,
  },
  amountUnit: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  validationText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  servingSelector: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  servingSelectorButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  servingOptions: {
    borderTopWidth: 1,
    maxHeight: 220,
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
  servingLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  detailsState: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 44,
  },
  detailsError: {
    alignItems: "flex-start",
    gap: tokens.spacing.xs,
  },
  detailsStateText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  retryButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  actions: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    paddingTop: tokens.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 88,
  },
});
