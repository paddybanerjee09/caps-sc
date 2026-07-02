import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;
const thumbTravel = 20;

type SimpleSwitchProps = {
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function SimpleSwitch({ onValueChange, value }: SimpleSwitchProps) {
  const { colorScheme, theme } = useAppTheme();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, {
      duration: 120,
      easing: Easing.out(Easing.quad),
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

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: trackColor }]}
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
    height: 28,
    justifyContent: "center",
    padding: 3,
    width: 48,
  },
  thumb: {
    borderRadius: tokens.radius.pill,
    height: 22,
    width: 22,
  },
});
