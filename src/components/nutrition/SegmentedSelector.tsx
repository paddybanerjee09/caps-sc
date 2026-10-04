import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { PressOpacity } from "../PressOpacity";
import { SELECTOR_MOTION } from "../../nutrition/motion";
import { useAppTheme } from "../../theme/ThemeContext";

type SelectorOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedSelectorProps<T extends string> = {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly SelectorOption<T>[];
  value: T;
};

export function SegmentedSelector<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: SegmentedSelectorProps<T>) {
  const { theme } = useAppTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.set(withTiming(index, SELECTOR_MOTION));
  }, [index, progress]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          options.length === 0 ? 0 : (progress.get() * width) / options.length,
      },
    ],
  }));

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  const segmentWidth = options.length === 0 ? 0 : width / options.length;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      onLayout={handleLayout}
      style={[
        styles.selector,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            indicatorStyle,
            {
              backgroundColor: theme.colors.surfaceMuted,
              width: segmentWidth,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <PressOpacity
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={styles.option}
          >
            <Text
              style={[
                styles.label,
                {
                  color: selected ? theme.colors.tertiary : theme.colors.textMuted,
                },
              ]}
            >
              {option.label}
            </Text>
          </PressOpacity>
        );
      })}
    </View>
  );
}

type SlidingPanelsProps = {
  children: ReactNode[];
  index: number;
};

export function SlidingPanels({ children, index }: SlidingPanelsProps) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.set(withTiming(index, SELECTOR_MOTION));
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.get() * width }],
  }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.clip}
    >
      <Animated.View style={[styles.row, { width: width * children.length }, style]}>
        {children.map((child, childIndex) => (
          <View key={childIndex} style={{ width }}>
            {child}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  selector: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 44,
    overflow: "hidden",
  },
  indicator: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
  },
  option: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
  clip: {
    overflow: "hidden",
    width: "100%",
  },
  row: {
    flexDirection: "row",
  },
});
