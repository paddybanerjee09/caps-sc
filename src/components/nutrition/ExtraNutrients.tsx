import { StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../PressOpacity";
import { formatAmount } from "../../nutrition/calculations";
import type { ExtraTotal } from "../../nutrition/calculations";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function ExtraNutrientSection({
  totals,
  title = "Micronutrients",
}: {
  title?: string;
  totals: ExtraTotal[];
}) {
  const { theme } = useAppTheme();
  const micros = totals.filter((total) => total.group === "micro");
  const others = totals.filter((total) => total.group === "other");

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.colors.text }]}>{title}</Text>
      <NutrientRows totals={micros} />
      {others.some((total) => total.amount !== null) ? (
        <>
          <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
            Other nutrients
          </Text>
          <NutrientRows totals={others} />
        </>
      ) : null}
    </View>
  );
}

function NutrientRows({ totals }: { totals: ExtraTotal[] }) {
  const { theme } = useAppTheme();

  return (
    <View>
      {totals.map((total) => (
        <View
          key={total.id}
          style={[styles.row, { borderBottomColor: theme.colors.border }]}
        >
          <Text style={[styles.name, { color: theme.colors.text }]}>{total.name}</Text>
          <Text style={[styles.value, { color: theme.colors.textMuted }]}>
            {formatAmount(total.amount, total.precision, total.partial)} {total.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function MicronutrientSummary({
  onPress,
  selected,
}: {
  onPress: () => void;
  selected: ExtraTotal | null;
}) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel="Choose a micronutrient"
      onPress={onPress}
      style={[styles.summary, { borderBottomColor: theme.colors.border }]}
    >
      <View>
        <Text style={[styles.heading, { color: theme.colors.text }]}>
          Micronutrients
        </Text>
        <Text style={[styles.name, { color: theme.colors.textMuted }]}>
          {selected?.name ?? "None available"}
        </Text>
      </View>
      <Text style={[styles.value, { color: theme.colors.text }]}>
        {selected
          ? `${formatAmount(selected.amount, selected.precision, selected.partial)} ${selected.unit}`
          : "\u2014"}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: tokens.spacing.xs,
    paddingTop: tokens.spacing.md,
  },
  heading: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  subheading: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
    paddingTop: tokens.spacing.sm,
  },
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: tokens.spacing.sm,
  },
  summary: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: tokens.spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    paddingRight: tokens.spacing.md,
  },
  value: {
    fontSize: tokens.typography.body.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.body.lineHeight,
  },
});
