import type { ReactNode } from "react";
import type {
  AccessibilityState,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Pressable } from "react-native";

import { themes } from "../theme/theme";

type PressOpacityProps = {
  children: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  pressedOpacity?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "tab";
  accessibilityState?: AccessibilityState;
};

export function PressOpacity({
  children,
  disabled,
  onPress,
  pressedOpacity = themes.dark.opacity.pressed,
  style,
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
}: PressOpacityProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
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
