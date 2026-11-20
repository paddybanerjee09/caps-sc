import type { ComponentProps, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PressOpacity } from "../PressOpacity";
import { WorkflowFooter, WorkflowHeader } from "../WorkflowChrome";
import { useNutritionWorkspace } from "../../state/NutritionWorkspaceContext";
import { NUTRITION_COLORS } from "../../constants/nutrition";
import { formatAmount } from "../../nutrition/calculations";
import { useAppTheme } from "../../theme/ThemeContext";
import { appColorPalette, readableTextColor, themes } from "../../theme/theme";
import type { NutrientSnapshot } from "../../types/nutrition";

const tokens = themes.dark;

export { WorkflowHeader } from "../WorkflowChrome";

export function NutritionFooter({ children }: { children?: ReactNode }) {
  const { pop, stack, transitioning } = useNutritionWorkspace();
  const depth = stack.filter((entry) => entry.phase !== "exit").length;
  return (
    <WorkflowFooter
      backLabel={depth > 1 ? "Back" : "Cancel"}
      disabled={transitioning}
      onBack={pop}
    >
      {children}
    </WorkflowFooter>
  );
}

export function useDangerColors() {
  const { colorScheme } = useAppTheme();

  return colorScheme === "dark"
    ? {
        background: "rgba(225, 29, 36, 0.2)",
        border: "rgba(225, 29, 36, 0.7)",
        text: "#FF9494",
      }
    : {
        background: "rgba(225, 29, 36, 0.12)",
        border: "rgba(225, 29, 36, 0.55)",
        text: "#9E0B12",
      };
}

type NutritionTextInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  icon?: ComponentProps<typeof Ionicons>["name"];
  invalid?: boolean;
};

export function NutritionTextInput({
  containerStyle,
  icon,
  invalid = false,
  style,
  ...props
}: NutritionTextInputProps) {
  const { theme } = useAppTheme();
  const frame = {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: invalid ? appColorPalette.red : theme.colors.borderStrong,
  };

  if (icon) {
    return (
      <View
        style={[
          styles.textInput,
          styles.iconTextInput,
          frame,
          containerStyle,
        ]}
      >
        <Ionicons color={theme.colors.textMuted} name={icon} size={18} />
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.tertiary}
          {...props}
          style={[styles.bareTextInput, { color: theme.colors.text }, style]}
        />
      </View>
    );
  }

  return (
    <TextInput
      placeholderTextColor={theme.colors.textMuted}
      selectionColor={theme.colors.tertiary}
      {...props}
      style={[styles.textInput, frame, { color: theme.colors.text }, style]}
    />
  );
}

type NutritionPageProps = {
  center?: ReactNode;
  children: ReactNode;
  controls?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  right?: ReactNode;
  scroll?: boolean;
  sideWidth?: number;
  title?: string;
};

export function NutritionPage({
  center,
  children,
  controls,
  footer,
  onClose,
  right,
  scroll = true,
  sideWidth,
  title,
}: NutritionPageProps) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        center={center}
        onClose={onClose}
        right={right}
        sideWidth={sideWidth}
        title={title}
      />
      {controls}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.body}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
      {footer}
    </View>
  );
}

type ActionProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function NutritionActionBar({
  danger,
  left,
  right,
}: {
  danger?: ActionProps;
  left?: ActionProps;
  right: ActionProps;
}) {
  const { theme } = useAppTheme();
  const dangerColors = useDangerColors();

  return (
    <NutritionFooter>
      {left ? (
        <PressOpacity
          accessibilityLabel={left.accessibilityLabel}
          disabled={left.disabled}
          onPress={left.onPress}
          style={[
            styles.actionSlot,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[styles.actionLabel, { color: theme.colors.text }]}
          >
            {left.label}
          </Text>
        </PressOpacity>
      ) : null}
      <PressOpacity
        accessibilityLabel={right.accessibilityLabel}
        disabled={right.disabled}
        onPress={right.onPress}
        style={[styles.actionSlot, { backgroundColor: theme.colors.tertiary }]}
      >
        <Text
          numberOfLines={2}
          style={[
            styles.actionLabel,
            { color: readableTextColor(theme.colors.tertiary) },
          ]}
        >
          {right.label}
        </Text>
      </PressOpacity>
      {danger ? (
        <PressOpacity
          accessibilityLabel={danger.accessibilityLabel}
          disabled={danger.disabled}
          onPress={danger.onPress}
          style={[
            styles.actionSlot,
            styles.dangerAction,
            {
              backgroundColor: dangerColors.background,
              borderColor: dangerColors.border,
            },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[styles.actionLabel, { color: dangerColors.text }]}
          >
            {danger.label}
          </Text>
        </PressOpacity>
      ) : null}
    </NutritionFooter>
  );
}

export function FoodMacroLine({
  nutrients,
  partial = false,
}: {
  nutrients: NutrientSnapshot | null;
  partial?: boolean;
}) {
  const values = nutrients ?? {
    energyKcal: null,
    proteinG: null,
    carbohydratesG: null,
    fatG: null,
  };

  return (
    <Text style={styles.macroLine}>
      <Text style={{ color: NUTRITION_COLORS.energyKcal, fontWeight: "800" }}>
        {formatAmount(
          values.energyKcal,
          0,
          partial && values.energyKcal !== null,
        )}{" "}
        kcal
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.proteinG, fontWeight: "700" }}>
        P {formatAmount(values.proteinG, 1, partial && values.proteinG !== null)} g
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.carbohydratesG, fontWeight: "700" }}>
        C{" "}
        {formatAmount(
          values.carbohydratesG,
          1,
          partial && values.carbohydratesG !== null,
        )}{" "}
        g
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.fatG, fontWeight: "700" }}>
        F {formatAmount(values.fatG, 1, partial && values.fatG !== null)} g
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  actionSlot: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 90,
    paddingHorizontal: tokens.spacing.xs,
  },
  dangerAction: {
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  textInput: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  iconTextInput: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingVertical: 0,
  },
  bareTextInput: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    minHeight: 46,
    paddingVertical: 0,
  },
  macroLine: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    lineHeight: 16,
  },
});
