import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomTabs } from "../components/BottomTabs";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { NutritionStack } from "../screens/NutritionScreens/NutritionStack";
import { ScreenForRoute } from "../screens/Screens";
import { useNutritionWorkspace } from "../state/NutritionWorkspaceContext";
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
  const nutrition = useNutritionWorkspace();
  const [activeRoute, setActiveRoute] = useState<RouteKey>(initialRoute);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const selectTabRef = useRef<(route: TabRoute) => void>(() => {});
  const previousRoute = useRef<RouteKey>(initialRoute);

  const selectTab = (route: TabRoute) => {
    if (route !== activeRoute) {
      void Haptics.selectionAsync();
    }

    setActiveRoute(route);
    setSidebarOpen(false);
  };

  useEffect(() => {
    selectTabRef.current = selectTab;
  });

  useEffect(() => {
    nutrition.setNutritionTabHandler(() => selectTabRef.current("nutrition"));
  }, [nutrition]);

  useEffect(() => {
    if (previousRoute.current === "nutrition" && activeRoute !== "nutrition") {
      nutrition.dismissTransient();
    }

    previousRoute.current = activeRoute;
  }, [activeRoute, nutrition]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }

      if (activeRoute === "nutrition") {
        return nutrition.handleHardwareBack();
      }

      return false;
    });

    return () => subscription.remove();
  }, [activeRoute, nutrition, sidebarOpen]);

  const selectSidebarRoute = (route: SidebarRoute) => {
    setActiveRoute(route);
    setSidebarOpen(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar
        backgroundColor={theme.colors.background}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.workspace}>
        <Header
          onMenuPress={() => setSidebarOpen((open) => !open)}
          topInset={insets.top}
        />
        <View style={styles.content}>
          <ScreenForRoute route={activeRoute} />
        </View>
        {activeRoute === "nutrition" ? <NutritionStack /> : null}
      </View>
      <BottomTabs
        activeRoute={activeRoute}
        bottomInset={keyboardVisible ? 0 : insets.bottom}
        onSelect={selectTab}
      />
      <Sidebar
        activeRoute={activeRoute}
        bottomInset={keyboardVisible ? 0 : insets.bottom}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectSidebarRoute}
        open={sidebarOpen}
        topInset={insets.top}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  workspace: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
