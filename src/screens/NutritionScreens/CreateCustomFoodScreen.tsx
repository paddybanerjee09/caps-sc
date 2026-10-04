import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { NutritionPage } from "../../components/nutrition/NutritionChrome";
import { PressOpacity } from "../../components/PressOpacity";
import {
  createCustomFood,
  updateCustomFood,
} from "../../data/nutritionCatalogRepository";
import {
  calorieCrossCheck,
  formatDisplayNumber,
  isFoodUnit,
  normalizeBarcode,
} from "../../nutrition/calculations";
import { NUTRIENT_REGISTRY } from "../../nutrition/nutrients";
import { catalogFoodFromCustom } from "../../services/foodCatalog";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { ExtraNutrientValue, FoodUnit } from "../../types/nutrition";

const tokens = themes.dark;
const UNITS: FoodUnit[] = ["g", "ml", "tsp", "tbsp", "serving"];

export function CreateCustomFoodScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { customForm, flush, pop, push, setFacts, transitioning, updateCustomForm } =
    useNutritionWorkspace();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const calories = Number(customForm.calories);
  const protein = Number(customForm.protein);
  const carbohydrates = Number(customForm.carbohydrates);
  const fat = Number(customForm.fat);
  const warning =
    [calories, protein, carbohydrates, fat].every((value) => Number.isFinite(value) && value >= 0)
      ? calorieCrossCheck(calories, protein, carbohydrates, fat)
      : null;

  async function saveAndContinue() {
    if (saving || transitioning) {
      return;
    }

    const nextErrors = validateForm(customForm);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    const extras = extrasFromForm(customForm.extras);
    const input = {
      barcode: normalizeBarcode(customForm.barcode),
      brand: customForm.brand.trim() || null,
      carbohydratesG: carbohydrates,
      energyKcal: calories,
      extras,
      fatG: fat,
      name: customForm.name.trim(),
      proteinG: protein,
      servingAmount: Number(customForm.servingAmount),
      servingUnit: customForm.servingUnit,
    };

    try {
      await flush();
      const id = customForm.customFoodId
        ? customForm.customFoodId
        : await createCustomFood(db, customForm.operationId, input);

      if (customForm.customFoodId) {
        await updateCustomFood(db, customForm.customFoodId, input);
      }

      updateCustomForm((form) => ({ ...form, customFoodId: id }));
      const food = catalogFoodFromCustom({ ...input, id });
      setFacts({
        amountInput: "1",
        calorieInput: "",
        draftItemId: null,
        food: food.ref,
        inputMode: "amount",
        servingId: food.defaultServingId,
        snapshot: food,
      });
      push({ screen: "facts" });
    } catch {
      setErrors({ form: "Couldn't save this food. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <NutritionPage
      footer={
        <PressOpacity
          accessibilityLabel="Next"
          disabled={saving}
          onPress={() => void saveAndContinue()}
          style={[styles.next, { backgroundColor: theme.colors.tertiary }]}
        >
          <Text style={[styles.nextLabel, { color: theme.colors.background }]}>
            {saving ? "Saving" : "Next"}
          </Text>
        </PressOpacity>
      }
      onClose={pop}
      title="New Food"
    >
      <Field
        error={errors.name}
        label="Food name"
        onChangeText={(name) => updateCustomForm((form) => ({ ...form, name }))}
        value={customForm.name}
      />
      <Field
        label="Brand"
        onChangeText={(brand) => updateCustomForm((form) => ({ ...form, brand }))}
        value={customForm.brand}
      />
      <Field
        error={errors.barcode}
        keyboardType="number-pad"
        label="Barcode"
        onChangeText={(barcode) => updateCustomForm((form) => ({ ...form, barcode }))}
        value={customForm.barcode}
      />
      <Field
        error={errors.servingAmount}
        keyboardType="decimal-pad"
        label="Base serving amount"
        onChangeText={(servingAmount) =>
          updateCustomForm((form) => ({ ...form, servingAmount }))
        }
        value={customForm.servingAmount}
      />
      <Text style={[styles.label, { color: theme.colors.text }]}>Base serving unit</Text>
      <View style={styles.units}>
        {UNITS.map((unit) => (
          <PressOpacity
            accessibilityLabel={unit}
            key={unit}
            onPress={() => updateCustomForm((form) => ({ ...form, servingUnit: unit }))}
            style={styles.unit}
          >
            <Text
              style={{
                color:
                  customForm.servingUnit === unit
                    ? theme.colors.tertiary
                    : theme.colors.textMuted,
                fontWeight: "700",
              }}
            >
              {unit}
            </Text>
          </PressOpacity>
        ))}
      </View>
      <Field
        error={errors.calories}
        keyboardType="decimal-pad"
        label="Calories (kcal)"
        onChangeText={(value) => updateCustomForm((form) => ({ ...form, calories: value }))}
        value={customForm.calories}
      />
      <Field
        error={errors.fat}
        keyboardType="decimal-pad"
        label="Fat (g)"
        onChangeText={(value) => updateCustomForm((form) => ({ ...form, fat: value }))}
        value={customForm.fat}
      />
      <Field
        error={errors.carbohydrates}
        keyboardType="decimal-pad"
        label="Carbohydrates (g)"
        onChangeText={(value) =>
          updateCustomForm((form) => ({ ...form, carbohydrates: value }))
        }
        value={customForm.carbohydrates}
      />
      <Field
        error={errors.protein}
        keyboardType="decimal-pad"
        label="Protein (g)"
        onChangeText={(value) => updateCustomForm((form) => ({ ...form, protein: value }))}
        value={customForm.protein}
      />
      {warning ? (
        <Text style={[styles.warning, { color: theme.colors.text }]}>
          Macronutrients estimate about {formatDisplayNumber(warning.estimate, 0)} kcal.
          Check the values before continuing. Next stays available.
        </Text>
      ) : null}
      <Text style={[styles.section, { color: theme.colors.text }]}>Optional nutrients</Text>
      {NUTRIENT_REGISTRY.map((definition) => (
        <Field
          error={errors[definition.id]}
          key={definition.id}
          keyboardType="decimal-pad"
          label={`${definition.name} (${definition.unit})`}
          onChangeText={(value) =>
            updateCustomForm((form) => ({
              ...form,
              extras: { ...form.extras, [definition.id]: value },
            }))
          }
          value={customForm.extras[definition.id] ?? ""}
        />
      ))}
      {errors.form ? (
        <Text style={[styles.warning, { color: theme.colors.text }]}>{errors.form}</Text>
      ) : null}
    </NutritionPage>
  );
}

function Field({
  error,
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  error?: string;
  keyboardType?: "decimal-pad" | "number-pad";
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.field, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { color: theme.colors.text }]}
        value={value}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function validateForm(form: {
  barcode: string;
  calories: string;
  carbohydrates: string;
  extras: Record<string, string>;
  fat: string;
  name: string;
  protein: string;
  servingAmount: string;
  servingUnit: string;
}) {
  const errors: Record<string, string> = {};

  if (!form.name.trim()) {
    errors.name = "Enter a food name.";
  }

  const servingAmount = Number(form.servingAmount);

  if (!Number.isFinite(servingAmount) || servingAmount <= 0) {
    errors.servingAmount = "Enter a serving amount greater than zero.";
  }

  if (!isFoodUnit(form.servingUnit)) {
    errors.servingAmount = "Choose a serving unit.";
  }

  if (form.barcode.trim() && !normalizeBarcode(form.barcode)) {
    errors.barcode = "Use an 8, 12, 13, or 14 digit barcode.";
  }

  for (const [key, label] of [
    ["calories", "Calories"],
    ["protein", "Protein"],
    ["carbohydrates", "Carbohydrates"],
    ["fat", "Fat"],
  ] as const) {
    if (form[key].trim() === "") {
      errors[key] = `${label} is required. Zero is allowed.`;
      continue;
    }

    const value = Number(form[key]);

    if (!Number.isFinite(value) || value < 0) {
      errors[key] = `${label} must be a number that is zero or greater.`;
    }
  }

  for (const definition of NUTRIENT_REGISTRY) {
    const raw = form.extras[definition.id]?.trim() ?? "";

    if (!raw) {
      continue;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
      errors[definition.id] = `${definition.name} must be zero or greater.`;
    }
  }

  return errors;
}

function extrasFromForm(values: Record<string, string>): ExtraNutrientValue[] {
  return NUTRIENT_REGISTRY.flatMap((definition) => {
    const raw = values[definition.id]?.trim() ?? "";

    if (!raw) {
      return [];
    }

    return [{ amount: Number(raw), id: definition.id, unit: definition.unit }];
  });
}

const styles = StyleSheet.create({
  field: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: tokens.spacing.sm,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
  },
  input: {
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
  },
  error: {
    color: "#D31516",
    fontSize: tokens.typography.label.fontSize,
  },
  warning: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    paddingTop: tokens.spacing.md,
  },
  section: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    paddingTop: tokens.spacing.lg,
  },
  units: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  unit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 52,
  },
  next: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: tokens.spacing.lg,
    marginVertical: tokens.spacing.sm,
    minHeight: 48,
  },
  nextLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
});
