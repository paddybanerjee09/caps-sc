import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { NUTRITION_COLORS } from "../constants/nutrition";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, themes } from "../theme/theme";
import type { NutrientSnapshot, NutrientTargets } from "../types/nutrition";

const tokens = themes.dark;
const RING_SIZE = 132;
const RING_STROKE_WIDTH = 14;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const STACKED_BREAKPOINT = 340;

type NutrientKey = keyof NutrientSnapshot;
type MacroKey = Exclude<NutrientKey, "energyKcal">;

type MacronutrientBreakdownCardProps = {
  energyInput?: {
    editable: boolean;
    invalid: boolean;
    onChangeText: (value: string) => void;
    value: string;
  };
  values: NutrientSnapshot;
  incomplete: Record<NutrientKey, boolean>;
  targets: NutrientTargets;
  title?: string;
};

type MacroPresentation = {
  calorieFactor: number;
  color: string;
  key: MacroKey;
  label: string;
};

const macroPresentations: MacroPresentation[] = [
  {
    calorieFactor: 4,
    color: NUTRITION_COLORS.proteinG,
    key: "proteinG",
    label: "Protein",
  },
  {
    calorieFactor: 4,
    color: NUTRITION_COLORS.carbohydratesG,
    key: "carbohydratesG",
    label: "Carbohydrates",
  },
  {
    calorieFactor: 9,
    color: NUTRITION_COLORS.fatG,
    key: "fatG",
    label: "Fat",
  },
];

const nutrientPresentations: {
  color: string;
  key: NutrientKey;
  label: string;
  unit: "g" | "kcal";
}[] = [
  {
    color: NUTRITION_COLORS.energyKcal,
    key: "energyKcal",
    label: "Energy",
    unit: "kcal",
  },
  {
    color: NUTRITION_COLORS.proteinG,
    key: "proteinG",
    label: "Protein",
    unit: "g",
  },
  {
    color: NUTRITION_COLORS.carbohydratesG,
    key: "carbohydratesG",
    label: "Carbohydrates",
    unit: "g",
  },
  {
    color: NUTRITION_COLORS.fatG,
    key: "fatG",
    label: "Fat",
    unit: "g",
  },
];

export function MacronutrientBreakdownCard({
  energyInput,
  incomplete,
  targets,
  title,
  values,
}: MacronutrientBreakdownCardProps) {
  const { theme } = useAppTheme();
  const [availableWidth, setAvailableWidth] = useState(0);
  const safeValues = normalizeNutrients(values);
  const resolvedIncomplete = resolveIncomplete(safeValues, incomplete);
  const macroSegments = buildMacroSegments(safeValues);
  const isStacked = availableWidth > 0 && availableWidth < STACKED_BREAKPOINT;
  const hasIncompleteNutrient = Object.values(resolvedIncomplete).some(Boolean);
  const hasIncompleteMacro = macroPresentations.some(
    ({ key }) => resolvedIncomplete[key],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const measuredWidth = Math.round(event.nativeEvent.layout.width);
    setAvailableWidth((currentWidth) =>
      currentWidth === measuredWidth ? currentWidth : measuredWidth,
    );
  }

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {title ? (
        <Text selectable style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
      ) : null}

      <View style={[styles.breakdown, isStacked && styles.breakdownStacked]}>
        <View
          accessibilityLabel={
            energyInput
              ? undefined
              : buildRingAccessibilityLabel(
                  safeValues,
                  resolvedIncomplete,
                  macroSegments,
                )
          }
          accessibilityRole={energyInput ? undefined : "image"}
          accessible={!energyInput}
          style={styles.ring}
        >
          <Svg
            accessible={false}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            width={RING_SIZE}
          >
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              fill="none"
              r={RING_RADIUS}
              stroke={theme.colors.surfaceMuted}
              strokeWidth={RING_STROKE_WIDTH}
            />
            {macroSegments.map((segment) =>
              segment.proportion > 0 ? (
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  fill="none"
                  key={segment.key}
                  origin={`${RING_CENTER}, ${RING_CENTER}`}
                  r={RING_RADIUS}
                  rotation="-90"
                  stroke={segment.color}
                  strokeDasharray={[
                    segment.proportion * RING_CIRCUMFERENCE,
                    (1 - segment.proportion) * RING_CIRCUMFERENCE,
                  ]}
                  strokeDashoffset={
                    -segment.startProportion * RING_CIRCUMFERENCE
                  }
                  strokeLinecap="butt"
                  strokeWidth={RING_STROKE_WIDTH}
                />
              ) : null,
            )}
          </Svg>

          <View
            pointerEvents={energyInput ? "box-none" : "none"}
            style={styles.ringLabel}
          >
            {energyInput ? (
              <TextInput
                accessibilityLabel="Calories for configured food"
                editable={energyInput.editable}
                keyboardType="decimal-pad"
                onChangeText={energyInput.onChangeText}
                placeholder="\u2014"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="done"
                selectTextOnFocus
                selectionColor={theme.colors.tertiary}
                style={[
                  styles.energyInput,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: energyInput.invalid
                      ? appColorPalette.red
                      : theme.colors.borderStrong,
                    color: theme.colors.text,
                  },
                  !energyInput.editable && styles.energyInputDisabled,
                ]}
                value={energyInput.value}
              />
            ) : (
              <Text
                selectable
                style={[styles.energyValue, { color: theme.colors.text }]}
              >
                {formatNullableValue(
                  safeValues.energyKcal,
                  resolvedIncomplete.energyKcal,
                  0,
                )}
              </Text>
            )}
            <Text
              selectable
              style={[styles.energyUnit, { color: theme.colors.textMuted }]}
            >
              kcal
            </Text>
          </View>
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.macroList, isStacked && styles.macroListStacked]}
        >
          {macroSegments.map((segment) => (
            <View key={segment.key} style={styles.macroRow}>
              <View
                style={[styles.colorDot, { backgroundColor: segment.color }]}
              />
              <Text
                selectable
                style={[styles.macroLabel, { color: theme.colors.text }]}
              >
                {segment.label}
              </Text>
              <View style={styles.macroValueGroup}>
                <Text
                  selectable
                  style={[styles.macroValue, { color: theme.colors.text }]}
                >
                  {formatNullableValue(
                    segment.value,
                    resolvedIncomplete[segment.key],
                    1,
                  )}{" "}
                  {segment.value === null ? "" : "g"}
                </Text>
                <Text
                  selectable
                  style={[
                    styles.macroPercentage,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {segment.value === null
                    ? "\u2014"
                    : `${formatNumber(segment.proportion * 100, 0)}%`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {hasIncompleteMacro ? (
        <Text
          selectable
          style={[styles.note, { color: theme.colors.textMuted }]}
        >
          Percentages use available macro data only.
        </Text>
      ) : null}

      <View style={styles.progressList}>
        {nutrientPresentations.map((presentation) => (
          <NutrientProgressRow
            color={presentation.color}
            incomplete={resolvedIncomplete[presentation.key]}
            key={presentation.key}
            label={presentation.label}
            target={targets[presentation.key]}
            unit={presentation.unit}
            value={safeValues[presentation.key]}
          />
        ))}
      </View>

      {hasIncompleteNutrient ? (
        <Text
          selectable
          style={[styles.note, { color: theme.colors.textMuted }]}
        >
          + Some USDA nutrient values are unavailable.
        </Text>
      ) : null}
    </View>
  );
}

function NutrientProgressRow({
  color,
  incomplete,
  label,
  target,
  unit,
  value,
}: {
  color: string;
  incomplete: boolean;
  label: string;
  target: number;
  unit: "g" | "kcal";
  value: number | null;
}) {
  const { theme } = useAppTheme();
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const fill =
    value !== null && safeTarget > 0 ? clamp(value / safeTarget, 0, 1) : 0;
  const valueText = formatNullableValue(
    value,
    incomplete,
    unit === "kcal" ? 0 : 1,
  );
  const targetText = formatNumber(safeTarget, unit === "kcal" ? 0 : 1);

  return (
    <View
      accessibilityLabel={buildProgressAccessibilityLabel(
        incomplete,
        label,
        safeTarget,
        unit,
        value,
      )}
      accessible
      style={styles.progressRow}
    >
      <View style={styles.progressLabels}>
        <Text
          selectable
          style={[styles.progressLabel, { color: theme.colors.text }]}
        >
          {label}
        </Text>
        <Text
          selectable
          style={[styles.progressValue, { color: theme.colors.textMuted }]}
        >
          {valueText} / {targetText} {unit}
        </Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.progressTrack,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: color,
              width: `${fill * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

function buildMacroSegments(values: NutrientSnapshot) {
  const knownMacroCalories = macroPresentations.reduce((total, macro) => {
    const value = values[macro.key];
    return total + (value === null ? 0 : value * macro.calorieFactor);
  }, 0);
  let startProportion = 0;

  return macroPresentations.map((macro) => {
    const value = values[macro.key];
    const calories = value === null ? 0 : value * macro.calorieFactor;
    const proportion =
      knownMacroCalories > 0 ? clamp(calories / knownMacroCalories, 0, 1) : 0;
    const segment = {
      ...macro,
      proportion,
      startProportion,
      value,
    };

    startProportion += proportion;
    return segment;
  });
}

function buildRingAccessibilityLabel(
  values: NutrientSnapshot,
  incomplete: Record<NutrientKey, boolean>,
  macroSegments: ReturnType<typeof buildMacroSegments>,
) {
  const energyDescription =
    values.energyKcal === null
      ? "Energy unavailable"
      : `Energy ${
          incomplete.energyKcal ? "at least " : ""
        }${formatNumber(values.energyKcal, 0)} kilocalories`;
  const macroDescriptions = macroSegments.map((segment) => {
    if (segment.value === null) {
      return `${segment.label} unavailable`;
    }

    return `${segment.label} ${
      incomplete[segment.key] ? "at least " : ""
    }${formatNumber(segment.value, 1)} grams, ${formatNumber(
      segment.proportion * 100,
      0,
    )} percent of available macronutrient calories`;
  });

  return [energyDescription, ...macroDescriptions].join(". ");
}

function buildProgressAccessibilityLabel(
  incomplete: boolean,
  label: string,
  target: number,
  unit: "g" | "kcal",
  value: number | null,
) {
  const spokenUnit = unit === "kcal" ? "kilocalories" : "grams";

  if (value === null) {
    return `${label} unavailable. Target ${formatNumber(
      target,
      unit === "kcal" ? 0 : 1,
    )} ${spokenUnit}`;
  }

  return `${label}: ${incomplete ? "at least " : ""}${formatNumber(
    value,
    unit === "kcal" ? 0 : 1,
  )} out of ${formatNumber(target, unit === "kcal" ? 0 : 1)} ${spokenUnit}`;
}

function normalizeNutrients(values: NutrientSnapshot): NutrientSnapshot {
  return {
    energyKcal: normalizeNutrient(values.energyKcal),
    proteinG: normalizeNutrient(values.proteinG),
    carbohydratesG: normalizeNutrient(values.carbohydratesG),
    fatG: normalizeNutrient(values.fatG),
  };
}

function normalizeNutrient(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function resolveIncomplete(
  values: NutrientSnapshot,
  incomplete: Record<NutrientKey, boolean>,
): Record<NutrientKey, boolean> {
  return {
    energyKcal: incomplete.energyKcal || values.energyKcal === null,
    proteinG: incomplete.proteinG || values.proteinG === null,
    carbohydratesG: incomplete.carbohydratesG || values.carbohydratesG === null,
    fatG: incomplete.fatG || values.fatG === null,
  };
}

function formatNullableValue(
  value: number | null,
  incomplete: boolean,
  maximumFractionDigits: number,
) {
  if (value === null) {
    return "\u2014";
  }

  return `${formatNumber(value, maximumFractionDigits)}${
    incomplete ? "+" : ""
  }`;
}

function formatNumber(value: number, maximumFractionDigits: number) {
  return value.toLocaleString([], {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
  },
  title: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  breakdown: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.lg,
  },
  breakdownStacked: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  ring: {
    alignItems: "center",
    alignSelf: "center",
    height: RING_SIZE,
    justifyContent: "center",
    position: "relative",
    width: RING_SIZE,
  },
  ringLabel: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  energyValue: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 26,
  },
  energyInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    height: 38,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 0,
    textAlign: "center",
    width: 78,
  },
  energyInputDisabled: {
    opacity: tokens.opacity.disabled,
  },
  energyUnit: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  macroList: {
    flex: 1,
    gap: tokens.spacing.md,
    minWidth: 140,
  },
  macroListStacked: {
    flex: 0,
    width: "100%",
  },
  macroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 32,
  },
  colorDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  macroLabel: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    minWidth: 0,
  },
  macroValueGroup: {
    alignItems: "flex-end",
  },
  macroValue: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  macroPercentage: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  progressList: {
    gap: tokens.spacing.md,
  },
  progressRow: {
    gap: tokens.spacing.xs,
  },
  progressLabels: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  progressLabel: {
    flexShrink: 1,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  progressValue: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.label.lineHeight,
  },
  progressTrack: {
    borderRadius: tokens.radius.pill,
    height: 8,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: tokens.radius.pill,
    height: "100%",
  },
  note: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
