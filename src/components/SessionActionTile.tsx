import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { PressOpacity } from "./PressOpacity";

export type SessionActionTileProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size: number;
  primary?: boolean;
};

export function SessionActionTile({
  label,
  icon,
  onPress,
  disabled = false,
  accessibilityLabel,
  size,
  primary = false,
}: SessionActionTileProps) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: primary
            ? theme.colors.tertiary
            : theme.colors.surface,
          borderColor: primary
            ? theme.colors.tertiary
            : theme.colors.borderStrong,
          height: size,
          width: size,
        },
      ]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text
        numberOfLines={2}
        style={[
          styles.label,
          {
            color: primary
              ? theme.colors.tertiaryContent
              : theme.colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
});
