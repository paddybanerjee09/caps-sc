import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { tabs, type RouteKey, type TabRoute } from "../navigation/routes";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

type TabIconName = ComponentProps<typeof Ionicons>["name"];

const tokens = themes.dark;

const tabIcons: Record<
  Exclude<TabRoute, "skill" | "conditioning">,
  TabIconName
> = {
  nutrition: "restaurant-outline",
  home: "home-outline",
  strength: "barbell-outline",
};

type BottomTabsProps = {
  activeRoute: RouteKey;
  bottomInset: number;
  onSelect: (route: TabRoute) => void;
};

export function BottomTabs({
  activeRoute,
  bottomInset,
  onSelect,
}: BottomTabsProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderStrong,
          paddingBottom: Math.max(bottomInset, theme.spacing.xs),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeRoute === tab.key;
        const color = isActive ? theme.colors.text : theme.colors.textMuted;

        return (
          <PressOpacity
            accessibilityLabel={tab.title}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[
              styles.tab,
              isActive && {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <View
              style={[
                styles.activeLine,
                {
                  backgroundColor: isActive
                    ? theme.colors.tertiary
                    : "transparent",
                },
              ]}
            />
            <TabIcon
              color={isActive ? theme.colors.tertiary : color}
              route={tab.key}
            />
            <View style={styles.labelFrame}>
              <Text
                numberOfLines={2}
                style={[
                  styles.tabText,
                  { color, fontWeight: isActive ? "800" : "700" },
                ]}
              >
                {tab.title}
              </Text>
            </View>
          </PressOpacity>
        );
      })}
    </View>
  );
}

function TabIcon({ color, route }: { color: string; route: TabRoute }) {
  if (route === "skill") {
    return (
      <MaterialCommunityIcons color={color} name="boxing-glove" size={22} />
    );
  }

  if (route === "conditioning") {
    return <MaterialCommunityIcons color={color} name="run-fast" size={22} />;
  }

  return <Ionicons color={color} name={tabIcons[route]} size={22} />;
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
  },
  tab: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 62,
    paddingHorizontal: 2,
  },
  labelFrame: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: "100%",
  },
  tabText: {
    fontSize: 10,
    letterSpacing: 0.2,
    lineHeight: 12,
    textAlign: "center",
  },
  activeLine: {
    borderRadius: 999,
    height: 3,
    marginBottom: 2,
    width: 24,
  },
});
