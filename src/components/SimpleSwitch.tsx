import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { feedbackToggle } from "../utils/feedback";

const tokens = themes.dark;
const thumbTravel = 24;

type SimpleSwitchProps = {
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function SimpleSwitch({ onValueChange, value }: SimpleSwitchProps) {
  const { colorScheme, theme } = useAppTheme();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: value ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [position, value]);

  const thumbColor =
    value && colorScheme === "dark" ? theme.colors.background : theme.colors.switchThumb;
  const trackColor = value ? theme.colors.switchTrackOn : theme.colors.switchTrackOff;
  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbTravel],
  });

  function toggle() {
    const next = !value;
    feedbackToggle(next);
    onValueChange(next);
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={toggle}
      style={[
        styles.track,
        {
          backgroundColor: trackColor,
          borderColor: value ? theme.colors.tertiary : theme.colors.borderStrong,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbColor,
            transform: [{ translateX }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    padding: 3,
    width: 56,
  },
  thumb: {
    borderRadius: tokens.radius.pill,
    height: 24,
    width: 24,
  },
});
