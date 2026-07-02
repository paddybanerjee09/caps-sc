import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";

import { themes } from "../theme/theme";

type PressOpacityProps = {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "tab";
};

export function PressOpacity({
  children,
  disabled,
  onPress,
  pressedOpacity = themes.dark.opacity.pressed,
  style,
  accessibilityLabel,
  accessibilityRole = "button",
}: PressOpacityProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        disabled && { opacity: themes.dark.opacity.disabled },
        pressed && !disabled && { opacity: pressedOpacity },
      ]}
    >
      {children}
    </Pressable>
  );
}
