import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { FoodMacroLine } from "./NutritionChrome";
import { PressOpacity } from "../PressOpacity";
import { formatAmount } from "../../nutrition/calculations";
import type { DraftMealItem } from "../../nutrition/drafts";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function LoggedFoodComponent({
  disabled = false,
  item,
  onPress,
  onRemove,
}: {
  disabled?: boolean;
  item: DraftMealItem;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { theme } = useAppTheme();
  const name = item.description ?? "Food details unavailable";
  const quantity = Number(item.quantityInput);
  const validQuantity = Number.isFinite(quantity) && quantity > 0;
  const nutrients = Object.fromEntries(
    Object.entries(item.nutrientsPerServing).map(([key, value]) => [
      key,
      value === null || !validQuantity ? null : value * quantity,
    ]),
  ) as DraftMealItem["nutrientsPerServing"];
  const serving = item.servingDescription
    ? /^1\s+/.test(item.servingDescription)
      ? `${item.quantityInput} ${item.servingDescription.replace(/^1\s+/, "")}`
      : `${item.quantityInput} × ${item.servingDescription}`
    : item.servingAmount && item.servingUnit && item.servingUnit !== "serving"
      ? `${formatAmount(validQuantity ? quantity * item.servingAmount : null, 6)} ${item.servingUnit}`
      : `${item.quantityInput} × serving`;

  return (
    <View style={[styles.row, {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
    }]}>
      <PressOpacity
        accessibilityLabel={`Remove ${name}`}
        disabled={disabled}
        onPress={onRemove}
        style={styles.remove}
      >
        <Ionicons color={theme.colors.textMuted} name="close" size={22} />
      </PressOpacity>
      <PressOpacity
        accessibilityLabel={`Edit ${name}, ${serving}`}
        disabled={disabled}
        onPress={onPress}
        style={styles.details}
      >
        <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
        <Text style={[styles.serving, { color: theme.colors.textMuted }]}>{serving}</Text>
        <FoodMacroLine nutrients={nutrients} />
      </PressOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    padding: tokens.spacing.xs,
  },
  remove: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: 48,
  },
  details: {
    flex: 1,
    gap: 3,
    minHeight: 64,
    minWidth: 0,
    paddingRight: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  name: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  serving: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
