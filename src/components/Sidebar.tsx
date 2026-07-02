import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { sidebarItems, type RouteKey, type SidebarRoute } from "../navigation/routes";
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
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const panelWidth = Math.min(width * 0.78, 304);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }

    Animated.timing(progress, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
      toValue: open ? 1 : 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) {
        setMounted(false);
      }
    });
  }, [open, progress]);

  if (!mounted) {
    return null;
  }

  const scrimOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-panelWidth, 0],
  });

  return (
    <View pointerEvents={open ? "auto" : "none"} style={styles.overlay}>
      <Animated.View
        style={[
          styles.scrim,
          {
            backgroundColor: theme.colors.overlay,
            opacity: scrimOpacity,
          },
        ]}
      >
        <Pressable accessibilityLabel="Close sidebar" onPress={onClose} style={styles.scrimPress} />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.background,
            borderRightColor: theme.colors.border,
            paddingBottom: bottomInset + theme.spacing.xl,
            paddingTop: topInset + theme.spacing.xl,
            transform: [{ translateX }],
            width: panelWidth,
          },
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
                  { color: isActive ? theme.colors.text : theme.colors.textMuted },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  styles.chevron,
                  { color: isActive ? theme.colors.tertiary : theme.colors.textMuted },
                ]}
              >
                {">"}
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
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 10,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimPress: {
    flex: 1,
  },
  panel: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: tokens.spacing.lg,
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
  chevron: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 22,
  },
});
