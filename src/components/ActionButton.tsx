import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

export function ActionButton({
  disabled = false,
  label,
  onPress,
  style,
  tone = "primary",
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: "primary" | "secondary" | "quiet";
}) {
  const { theme } = useAppTheme();
  const backgroundColor = tone === "primary"
    ? theme.colors.tertiary
    : tone === "secondary" ? theme.colors.surfaceMuted : "transparent";
  const color = tone === "primary"
    ? readableTextColor(theme.colors.tertiary)
    : theme.colors.text;

  return (
    <PressOpacity
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.action,
        tone === "primary" && styles.primary,
        {
          backgroundColor,
          borderColor: tone === "secondary" ? theme.colors.borderStrong : theme.colors.border,
          borderWidth: tone === "primary" ? 0 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 90,
    paddingHorizontal: tokens.spacing.md,
  },
  primary: { minHeight: 52 },
  label: { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
});
