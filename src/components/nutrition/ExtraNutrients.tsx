import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../PressOpacity";
import { formatAmount } from "../../nutrition/calculations";
import type { ExtraTotal } from "../../nutrition/calculations";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackToggle } from "../../utils/feedback";

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
    <View style={styles.container}>
      <PressOpacity
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} micronutrients`}
        accessibilityState={{ expanded }}
        onPress={() => {
          const next = !expanded;
          feedbackToggle(next);
          setExpanded(next);
        }}
        silent
        style={[
          styles.toggle,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
          MICRONUTRIENTS & TRACE TOTALS
        </Text>
        <Ionicons
          color={theme.colors.tertiary}
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
        />
      </PressOpacity>
      {expanded ? (
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <NutrientRows totals={micros} />
          {others.some((total) => total.amount !== null) ? (
            <>
              <Text style={[styles.subheading, { color: theme.colors.tertiary }]}>
                OTHER NUTRIENTS
              </Text>
              <NutrientRows totals={others} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function NutrientRows({ totals }: { totals: readonly ExtraTotal[] }) {
  const { theme } = useAppTheme();

  return (
    <View>
      {totals.map((total, index) => (
        <View
          key={total.id}
          style={[
            styles.row,
            index > 0 && {
              borderTopColor: theme.colors.border,
              borderTopWidth: 1,
            },
          ]}
        >
          <Text style={[styles.name, { color: theme.colors.text }]}>
            {total.name}
          </Text>
          <Text style={[styles.value, { color: theme.colors.textMuted }]}>
            {formatAmount(total.amount, total.precision, total.partial)}{" "}
            {total.unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.xs,
  },
  toggle: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  panel: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  subheading: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    paddingBottom: tokens.spacing.xs,
    paddingTop: tokens.spacing.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
    minHeight: 36,
    paddingVertical: tokens.spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  value: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
});
