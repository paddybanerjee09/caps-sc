import { StyleSheet, Text } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { PressOpacity } from "./PressOpacity";

type AdaptationStatusButtonProps = {
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
  disabled?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  contentColor?: string;
};

export function AdaptationStatusButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  backgroundColor,
  borderColor,
  contentColor,
}: AdaptationStatusButtonProps) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityHint="Shows how this session is expected to affect training"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: backgroundColor ?? theme.colors.surfaceMuted,
          borderColor: borderColor ?? theme.colors.borderStrong,
          minWidth: 112,
        },
      ]}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={2}
        style={[
          theme.typography.caption,
          styles.label,
          { color: contentColor ?? theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  label: {
    textAlign: "center",
  },
});
