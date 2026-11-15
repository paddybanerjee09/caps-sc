import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { feedbackToggle } from "../utils/feedback";

const tokens = themes.dark;
const thumbTravel = 24;

type SimpleSwitchProps = {
  accessibilityLabel?: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function SimpleSwitch({ accessibilityLabel, onValueChange, value }: SimpleSwitchProps) {
  const { colorScheme, theme } = useAppTheme();
  const [position] = useState(() => new Animated.Value(value ? 1 : 0));

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
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={toggle}
      style={styles.hit}
    >
      <View
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
  },
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
