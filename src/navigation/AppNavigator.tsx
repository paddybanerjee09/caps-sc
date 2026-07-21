import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomTabs } from "../components/BottomTabs";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { ScreenForRoute } from "../screens/Screens";
import { useAppTheme } from "../theme/ThemeContext";
import {
  initialRoute,
  type RouteKey,
  type SidebarRoute,
  type TabRoute,
} from "./routes";

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colorScheme, theme } = useAppTheme();
  const [activeRoute, setActiveRoute] = useState<RouteKey>(initialRoute);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectTab = (route: TabRoute) => {
    if (route !== activeRoute) {
      void Haptics.selectionAsync();
    }

    setActiveRoute(route);
    setSidebarOpen(false);
  };

  const selectSidebarRoute = (route: SidebarRoute) => {
    setActiveRoute(route);
    setSidebarOpen(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        backgroundColor={theme.colors.background}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <Header
        onMenuPress={() => setSidebarOpen((open) => !open)}
        topInset={insets.top}
      />
      <View style={styles.content}>
        <ScreenForRoute route={activeRoute} />
      </View>
      <BottomTabs
        activeRoute={activeRoute}
        bottomInset={insets.bottom}
        onSelect={selectTab}
      />
      <Sidebar
        activeRoute={activeRoute}
        bottomInset={insets.bottom}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectSidebarRoute}
        open={sidebarOpen}
        topInset={insets.top}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
