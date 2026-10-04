import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../PressOpacity";
import { formatAmount } from "../../nutrition/calculations";
import type { ExtraTotal } from "../../nutrition/calculations";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function MicronutrientDisclosure({
  totals,
}: {
  totals: readonly ExtraTotal[];
}) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const micros = totals.filter((total) => total.group === "micro");
  const others = totals.filter((total) => total.group === "other");

  return (
    <View>
      <PressOpacity
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} micronutrients`}
        onPress={() => setExpanded((current) => !current)}
        style={[styles.toggle, { borderTopColor: theme.colors.border }]}
      >
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
          Micronutrients
        </Text>
        <Ionicons
          color={theme.colors.textMuted}
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={18}
        />
      </PressOpacity>
      {expanded ? (
        <>
          <NutrientRows totals={micros} />
          {others.some((total) => total.amount !== null) ? (
            <>
              <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
                Other nutrients
              </Text>
              <NutrientRows totals={others} />
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function NutrientRows({ totals }: { totals: readonly ExtraTotal[] }) {
  const { theme } = useAppTheme();

  return (
    <View>
      {totals.map((total) => (
        <View
          key={total.id}
          style={[styles.row, { borderTopColor: theme.colors.border }]}
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

const styles = StyleSheet.create({
  toggle: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 44,
  },
  toggleLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  subheading: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
    paddingBottom: tokens.spacing.xs,
    paddingTop: tokens.spacing.md,
  },
  row: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
    minHeight: 32,
    paddingVertical: tokens.spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  value: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.label.lineHeight,
  },
});
