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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { PressOpacity } from "../PressOpacity";
import { NUTRITION_COLORS } from "../../constants/nutrition";
import { formatAmount } from "../../nutrition/calculations";
import { useAppTheme } from "../../theme/ThemeContext";
import { appColorPalette, readableTextColor, themes } from "../../theme/theme";
import type { NutrientSnapshot } from "../../types/nutrition";

const tokens = themes.dark;
const SIDE_WIDTH = 72;

export function useDangerColors() {
  const { colorScheme } = useAppTheme();

  return colorScheme === "dark"
    ? {
        background: "rgba(211, 21, 22, 0.18)",
        border: "rgba(211, 21, 22, 0.6)",
        text: "#FF8A8A",
      }
    : {
        background: "rgba(211, 21, 22, 0.1)",
        border: "rgba(211, 21, 22, 0.45)",
        text: "#A30F10",
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
      <View style={[styles.textInput, styles.iconTextInput, frame, containerStyle]}>
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

type WorkflowHeaderProps = {
  center?: ReactNode;
  onClose: () => void;
  right?: ReactNode;
  sideWidth?: number;
  title?: string;
};

export function WorkflowHeader({
  center,
  onClose,
  right,
  sideWidth = SIDE_WIDTH,
  title,
}: WorkflowHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={[styles.side, { width: sideWidth }]}>
        <PressOpacity
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name="close" size={22} />
        </PressOpacity>
      </View>
      <View style={styles.center}>
        {center ?? (
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[styles.title, { color: theme.colors.text }]}
          >
            {title}
          </Text>
        )}
      </View>
      <View style={[styles.side, styles.sideRight, { width: sideWidth }]}>{right}</View>
    </View>
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
  left: ActionProps;
  right: ActionProps;
}) {
  const { theme } = useAppTheme();
  const dangerColors = useDangerColors();

  return (
    <View
      style={[
        styles.actionBar,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      <PressOpacity
        accessibilityLabel={left.accessibilityLabel}
        disabled={left.disabled}
        onPress={left.onPress}
        style={styles.actionSlot}
      >
        <Text
          numberOfLines={2}
          style={[styles.actionLabel, { color: theme.colors.text }]}
        >
          {left.label}
        </Text>
      </PressOpacity>
      <PressOpacity
        accessibilityLabel={right.accessibilityLabel}
        disabled={right.disabled}
        onPress={right.onPress}
        style={[styles.actionSlot, { backgroundColor: theme.colors.tertiary }]}
      >
        <Text
          numberOfLines={2}
          style={[styles.actionLabel, { color: readableTextColor(theme.colors.tertiary) }]}
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
          <Text numberOfLines={2} style={[styles.actionLabel, { color: dangerColors.text }]}>
            {danger.label}
          </Text>
        </PressOpacity>
      ) : null}
    </View>
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
      <Text style={{ color: NUTRITION_COLORS.energyKcal }}>
        {formatAmount(values.energyKcal, 0, partial && values.energyKcal !== null)} kcal
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.proteinG }}>
        P {formatAmount(values.proteinG, 1, partial && values.proteinG !== null)} g
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.carbohydratesG }}>
        C {formatAmount(values.carbohydratesG, 1, partial && values.carbohydratesG !== null)} g
      </Text>
      <Text> · </Text>
      <Text style={{ color: NUTRITION_COLORS.fatG }}>
        F {formatAmount(values.fatG, 1, partial && values.fatG !== null)} g
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: tokens.spacing.sm,
  },
  side: {
    alignItems: "flex-start",
    width: SIDE_WIDTH,
  },
  sideRight: {
    alignItems: "flex-end",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  title: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  actionBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
  },
  actionSlot: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.xs,
  },
  dangerAction: {
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
  textInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
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
    minHeight: 42,
    paddingVertical: 0,
  },
  macroLine: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    lineHeight: 16,
  },
});
