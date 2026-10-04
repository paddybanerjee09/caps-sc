import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  NUTRITION_TRANSITION,
  NUTRITION_TRANSITION_MS,
} from "../../nutrition/motion";
import {
  useNutritionWorkspace,
  type StackEntry,
} from "../../state/NutritionWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { BarcodeScanScreen } from "./BarcodeScanScreen";
import { CreateCustomFoodScreen } from "./CreateCustomFoodScreen";
import { MealItemScreen } from "./MealItemScreen";
import { MealLogScreen } from "./MealLogScreen";
import { NutritionFactsScreen } from "./NutritionFactsScreen";
import { SavedMealsScreen } from "./SavedMealsScreen";

export function NutritionStack() {
  const { stack } = useNutritionWorkspace();
  const [height, setHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (stack.length === 0) {
    return null;
  }

  return (
    <View
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
      style={styles.host}
    >
      {stack.map((entry, index) => (
        <NutritionLayer
          active={index === stack.length - 1}
          entry={entry}
          height={height}
          key={entry.key}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}

function NutritionLayer({
  active,
  entry,
  height,
  reduceMotion,
}: {
  active: boolean;
  entry: StackEntry;
  height: number;
  reduceMotion: boolean;
}) {
  const { settleStack } = useNutritionWorkspace();
  const { theme } = useAppTheme();
  const progress = useSharedValue(entry.phase === "enter" ? 0 : 1);
  const heightValue = useSharedValue(height);
  const reduceValue = useSharedValue(reduceMotion ? 1 : 0);
  const settled = useRef(false);
  const finish = useCallback(() => {
    if (settled.current || entry.phase === "idle") {
      return;
    }

    settled.current = true;
    settleStack(entry.key);
  }, [entry.key, entry.phase, settleStack]);

  useEffect(() => {
    heightValue.set(height);
  }, [height, heightValue]);

  useEffect(() => {
    reduceValue.set(reduceMotion ? 1 : 0);
  }, [reduceMotion, reduceValue]);

  useEffect(() => {
    if (entry.phase === "idle" || height <= 0) {
      if (entry.phase === "idle") {
        progress.set(1);
      }
      return;
    }

    settled.current = false;
    const target = entry.phase === "exit" ? 0 : 1;
    progress.set(
      withTiming(target, NUTRITION_TRANSITION, (finished) => {
        if (finished) {
          runOnJS(finish)();
        }
      }),
    );
    const timer = setTimeout(finish, NUTRITION_TRANSITION_MS + 120);

    return () => clearTimeout(timer);
  }, [entry.phase, finish, height, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceValue.get() === 1) {
      return { opacity: progress.get() };
    }

    return {
      transform: [{ translateY: (1 - progress.get()) * heightValue.get() }],
    };
  });

  return (
    <Animated.View
      pointerEvents={active ? "auto" : "none"}
      style={[
        styles.layer,
        { backgroundColor: theme.colors.background },
        animatedStyle,
      ]}
    >
      <ScreenForEntry active={active && entry.phase !== "exit"} entry={entry} />
    </Animated.View>
  );
}

function ScreenForEntry({
  active,
  entry,
}: {
  active: boolean;
  entry: StackEntry;
}) {
  switch (entry.route.screen) {
    case "mealLog":
      return <MealLogScreen draftKey={entry.route.draftKey} />;
    case "savedMeals":
      return <SavedMealsScreen />;
    case "mealItem":
      return <MealItemScreen />;
    case "barcode":
      return <BarcodeScanScreen active={active} />;
    case "customFood":
      return <CreateCustomFoodScreen />;
    case "facts":
      return <NutritionFactsScreen />;
  }
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
});
