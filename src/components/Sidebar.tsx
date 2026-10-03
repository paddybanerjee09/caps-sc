import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  sidebarItems,
  type RouteKey,
  type SidebarRoute,
} from "../navigation/routes";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
type SidebarIconName = ComponentProps<typeof Ionicons>["name"];

const sidebarIcons: Record<SidebarRoute, SidebarIconName> = {
  settings: "settings-outline",
  accountInfo: "person-circle-outline",
  athleteInfo: "fitness-outline",
};

type SidebarProps = {
  activeRoute: RouteKey;
  bottomInset: number;
  onClose: () => void;
  onSelect: (route: SidebarRoute) => void;
  open: boolean;
  topInset: number;
};

export function Sidebar({
  activeRoute,
  bottomInset,
  onClose,
  onSelect,
  open,
  topInset,
}: SidebarProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const progress = useSharedValue(open ? 1 : 0);
  const panelWidth = Math.round(width * 0.55);

  useEffect(() => {
    progress.set(
      withTiming(open ? 1 : 0, {
        duration: 300,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [open, progress]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.get(), [0, 1], [-panelWidth, 0]),
      },
    ],
  }));

  return (
    <View
      accessibilityViewIsModal={open}
      importantForAccessibility={open ? "yes" : "no-hide-descendants"}
      pointerEvents={open ? "auto" : "none"}
      style={styles.overlay}
    >
      <Animated.View
        style={[
          styles.scrim,
          {
            backgroundColor: theme.colors.overlay,
          },
          scrimStyle,
        ]}
      >
        <Pressable
          accessibilityLabel="Close sidebar"
          onPress={onClose}
          style={styles.scrimPress}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.background,
            borderRightColor: theme.colors.border,
            paddingBottom: bottomInset + theme.spacing.xl,
            paddingTop: topInset + theme.spacing.xl,
            width: panelWidth,
          },
          panelStyle,
        ]}
      >
        {sidebarItems.map((item) => {
          const isActive = activeRoute === item.key;

          return (
            <PressOpacity
              accessibilityLabel={item.title}
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={[styles.item, { borderBottomColor: theme.colors.border }]}
            >
              <Ionicons
                color={isActive ? theme.colors.text : theme.colors.textMuted}
                name={sidebarIcons[item.key]}
                size={21}
              />
              <Text
                style={[
                  styles.itemText,
                  {
                    color: isActive
                      ? theme.colors.text
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {item.title}
              </Text>
            </PressOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    flexDirection: "row",
    elevation: 1000,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  scrim: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scrimPress: {
    flex: 1,
  },
  panel: {
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 1001,
    height: "100%",
    paddingHorizontal: tokens.spacing.lg,
    zIndex: 1,
  },
  item: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.md,
    minHeight: 52,
    paddingVertical: tokens.spacing.md,
  },
  itemText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
