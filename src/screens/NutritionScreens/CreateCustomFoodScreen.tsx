import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import {
  NutritionPage,
  NutritionFooter,
  NutritionTextInput,
  useDangerColors,
} from "../../components/nutrition/NutritionChrome";
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
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep } from "../../utils/feedback";
import type { ExtraNutrientValue, FoodUnit } from "../../types/nutrition";

const tokens = themes.dark;
const UNITS: FoodUnit[] = ["g", "ml", "tsp", "tbsp", "serving"];
const MACRO_FIELDS = [
  {
    key: "calories",
    label: "Calories",
    name: "Calories (kcal)",
    unit: "kcal",
  },
  {
    key: "protein",
    label: "Protein",
    name: "Protein (g)",
    unit: "g",
  },
  {
    key: "carbohydrates",
    label: "Carbs",
    name: "Carbohydrates (g)",
    unit: "g",
  },
  { key: "fat", label: "Fat", name: "Fat (g)", unit: "g" },
] as const;
const NUTRIENT_ROWS = pairs(NUTRIENT_REGISTRY);

export function CreateCustomFoodScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const {
    customForm,
    closeToRoot,
    flush,
    markNutritionChanged,
    push,
    setFacts,
    transitioning,
    updateCustomForm,
  } = useNutritionWorkspace();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const calories = Number(customForm.calories);
  const protein = Number(customForm.protein);
  const carbohydrates = Number(customForm.carbohydrates);
  const fat = Number(customForm.fat);
  const warning =
    [calories, protein, carbohydrates, fat].every(
      (value) => Number.isFinite(value) && value >= 0,
    )
      ? calorieCrossCheck(calories, protein, carbohydrates, fat)
      : null;
  const activeText = readableTextColor(theme.colors.tertiary);

  async function saveAndContinue() {
    if (saving || transitioning) {
      return;
    }

    const nextErrors = validateForm(customForm);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
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

      feedbackConfirm();
      updateCustomForm((form) => ({ ...form, customFoodId: id }));
      markNutritionChanged();
      const food = catalogFoodFromCustom({ ...input, id });
      setFacts({
        amountInput: "1",
        calorieInput: "",
        draftItemId: null,
        food: food.ref,
        inputMode: "amount",
        servingId: null,
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
        <NutritionFooter>
          <PressOpacity
            accessibilityLabel="Next"
            disabled={saving}
            onPress={() => void saveAndContinue()}
            style={[styles.next, { backgroundColor: theme.colors.tertiary }]}
          >
            <Text style={[styles.nextLabel, { color: activeText }]}>
              {saving ? "Saving" : "Next"}
            </Text>
          </PressOpacity>
        </NutritionFooter>
      }
      onClose={closeToRoot}
      title={customForm.customFoodId ? "Edit Food" : "New Food"}
    >
      {/* Card 1: Food Identity & Base Serving */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
          FOOD IDENTITY & BASE SERVING
        </Text>

        <Field
          error={errors.name}
          label="Food name"
          onChangeText={(name) => updateCustomForm((form) => ({ ...form, name }))}
          placeholder="Enter food name"
          prominent
          value={customForm.name}
        />
        <Field
          label="Brand"
          onChangeText={(brand) =>
            updateCustomForm((form) => ({ ...form, brand }))
          }
          placeholder="Enter brand (optional)"
          value={customForm.brand}
        />
        <Field
          error={errors.barcode}
          keyboardType="number-pad"
          label="Barcode"
          onChangeText={(barcode) =>
            updateCustomForm((form) => ({ ...form, barcode }))
          }
          placeholder="Enter barcode (optional)"
          value={customForm.barcode}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Base serving unit
        </Text>
        <View style={styles.units}>
          {UNITS.map((unit) => {
            const selected = customForm.servingUnit === unit;
            return (
              <PressOpacity
                accessibilityLabel={unit}
                accessibilityState={{ selected }}
                key={unit}
                onPress={() => {
                  feedbackStep("up");
                  updateCustomForm((form) => ({ ...form, servingUnit: unit }));
                }}
                silent
                style={[
                  styles.unit,
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
                  style={{
                    color: selected ? activeText : theme.colors.text,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  {unit}
                </Text>
              </PressOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.colors.text }]}>
          Base serving amount
        </Text>
        <View style={styles.inputRow}>

          <NutritionTextInput
            accessibilityLabel="Base serving amount"
            invalid={Boolean(errors.servingAmount)}
            keyboardType="decimal-pad"
            onChangeText={(servingAmount) =>
              updateCustomForm((form) => ({ ...form, servingAmount }))
            }
            placeholder="100"
            style={styles.centerInput}
            value={customForm.servingAmount}
          />

        </View>

        <FieldErrors messages={[errors.servingAmount]} />
      </View>

      {/* Card 2: Macronutrients Per Base Serving */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
          NUTRITION PER BASE SERVING
        </Text>

        {MACRO_FIELDS.map((field) => (
          <View key={field.key} style={styles.macroField}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {field.name}
            </Text>
            <View style={styles.inputRow}>

              <NutritionTextInput
                accessibilityLabel={field.name}
                invalid={Boolean(errors[field.key])}
                keyboardType="decimal-pad"
                onChangeText={(value) =>
                  updateCustomForm((form) => ({ ...form, [field.key]: value }))
                }
                placeholder={`0 ${field.unit}`}
                style={styles.centerInput}
                value={customForm[field.key]}
              />

            </View>
          </View>
        ))}

        <FieldErrors messages={MACRO_FIELDS.map((field) => errors[field.key])} />
        {warning ? (
          <Text style={[styles.warning, { color: theme.colors.text }]}>
            Macronutrients estimate about{" "}
            {formatDisplayNumber(warning.estimate, 0)} kcal. Check the values
            before continuing. Next stays available.
          </Text>
        ) : null}
      </View>

      {/* Card 3: Optional Nutrients */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
          OPTIONAL MICRONUTRIENTS
        </Text>
        {NUTRIENT_ROWS.map((row) => (
          <View key={row[0].id}>
            <View style={styles.gridRow}>
              {row.map((definition) => (
                <GridField
                  accessibilityLabel={`${definition.name} (${definition.unit})`}
                  invalid={Boolean(errors[definition.id])}
                  key={definition.id}
                  label={`${definition.name} (${definition.unit})`}
                  onChangeText={(value) =>
                    updateCustomForm((form) => ({
                      ...form,
                      extras: { ...form.extras, [definition.id]: value },
                    }))
                  }
                  placeholder="Optional"
                  value={customForm.extras[definition.id] ?? ""}
                />
              ))}
              {row.length === 1 ? <View style={styles.gridCell} /> : null}
            </View>
            <FieldErrors
              messages={row.map((definition) => errors[definition.id])}
            />
          </View>
        ))}
        <FieldErrors messages={[errors.form]} />
      </View>
    </NutritionPage>
  );
}

function Field({
  error,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  prominent = false,
  value,
}: {
  error?: string;
  keyboardType?: "decimal-pad" | "number-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  prominent?: boolean;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <NutritionTextInput
        accessibilityLabel={label}
        invalid={Boolean(error)}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={prominent && styles.prominentInput}
        value={value}
      />
      <FieldErrors messages={[error]} />
    </View>
  );
}

function GridField({
  accessibilityLabel,
  invalid,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  invalid: boolean;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.gridCell}>
      <Text
        numberOfLines={2}
        style={[styles.label, { color: theme.colors.text }]}
      >
        {label}
      </Text>
      <NutritionTextInput
        accessibilityLabel={accessibilityLabel}
        invalid={invalid}
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.gridInput}
        value={value}
      />
    </View>
  );
}

function FieldErrors({ messages }: { messages: (string | undefined)[] }) {
  const dangerColors = useDangerColors();
  const visible = messages.filter((message): message is string =>
    Boolean(message),
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <View style={styles.errors}>
      {visible.map((message) => (
        <Text key={message} style={[styles.error, { color: dangerColors.text }]}>
          {message}
        </Text>
      ))}
    </View>
  );
}

function pairs<T>(items: readonly T[]) {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2));
  }

  return rows;
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
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  field: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  prominentInput: {
    fontWeight: "800",
    minHeight: 48,
  },
  units: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unit: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 58,
    paddingHorizontal: tokens.spacing.sm,
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  centerInput: {
    flex: 1,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  macroField: {
    gap: 4,
  },
  gridRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
  },
  gridCell: {
    flex: 1,
    gap: tokens.spacing.xs,
    minWidth: 0,
  },
  gridInput: {
    fontVariant: ["tabular-nums"],
    paddingHorizontal: tokens.spacing.sm,
  },
  errors: {
    gap: 2,
    paddingTop: tokens.spacing.xs,
  },
  error: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  warning: {
    fontSize: 13,
    lineHeight: 18,
    paddingTop: tokens.spacing.xs,
  },
  next: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    flex: 1,
    minHeight: 52,
  },
  nextLabel: {
    fontSize: 15,
    fontWeight: "800",
  },
});
