import type { ReactNode } from "react";
import type { AccessibilityState, StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";

import { themes } from "../theme/theme";
import { feedbackSelection } from "../utils/feedback";

type PressOpacityProps = {
  children?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  pressedOpacity?: number;
  silent?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "tab";
  accessibilityState?: AccessibilityState;
};

export function PressOpacity({
  children,
  disabled,
  onPress,
  pressedOpacity = themes.dark.opacity.pressed,
  silent = false,
  style,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
}: PressOpacityProps) {
  function handlePress() {
    if (!onPress) {
      return;
    }
    if (!silent) {
      feedbackSelection();
    }
    onPress();
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      disabled={disabled}
      onPress={onPress ? handlePress : undefined}
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
