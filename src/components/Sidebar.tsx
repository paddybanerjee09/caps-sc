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
import { feedbackSelection } from "../utils/feedback";
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
  const panelWidth = Math.min(340, Math.round(width * 0.76));

  useEffect(() => {
    progress.set(
      withTiming(open ? 1 : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
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

  function handleClose() {
    feedbackSelection();
    onClose();
  }

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
          onPress={handleClose}
          style={styles.scrimPress}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: theme.colors.surface,
            borderRightColor: theme.colors.borderStrong,
            paddingBottom: bottomInset + theme.spacing.xl,
            paddingTop: topInset + theme.spacing.lg,
            width: panelWidth,
          },
          panelStyle,
        ]}
      >
        <View style={[styles.panelHeader, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.panelTitle, { color: theme.colors.textMuted }]}>
            NAVIGATION & PROFILE
          </Text>
          <PressOpacity
            accessibilityLabel="Close sidebar"
            onPress={onClose}
            style={[
              styles.closeButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons color={theme.colors.text} name="close" size={20} />
          </PressOpacity>
        </View>
        <View style={styles.cardList}>
          {sidebarItems.map((item) => {
            const isActive = activeRoute === item.key;

            return (
              <PressOpacity
                accessibilityLabel={item.title}
                accessibilityState={{ selected: isActive }}
                key={item.key}
                onPress={() => onSelect(item.key)}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: isActive
                      ? theme.colors.surfaceMuted
                      : theme.colors.background,
                    borderColor: isActive
                      ? theme.colors.tertiary
                      : theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: isActive
                        ? theme.colors.tertiary
                        : theme.colors.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons
                    color={isActive ? "#FFFFFF" : theme.colors.text}
                    name={sidebarIcons[item.key]}
                    size={20}
                  />
                </View>
                <Text
                  style={[
                    styles.itemText,
                    {
                      color: theme.colors.text,
                      fontWeight: isActive ? "800" : "700",
                    },
                  ]}
                >
                  {item.title}
                </Text>
                <Ionicons
                  color={isActive ? theme.colors.tertiary : theme.colors.textMuted}
                  name="chevron-forward"
                  size={18}
                />
              </PressOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    bottom: 0,
    elevation: 1000,
    flexDirection: "row",
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
    borderRightWidth: 1,
    elevation: 1001,
    height: "100%",
    paddingHorizontal: tokens.spacing.md,
    zIndex: 1,
  },
  panelHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  cardList: {
    gap: tokens.spacing.sm,
  },
  itemCard: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    minHeight: 60,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  itemText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
