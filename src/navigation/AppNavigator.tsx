import { useCallback, useEffect, useRef, useState } from "react";
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
import { ConditioningStack } from "../screens/conditioning/ConditioningStack";
import { SkillStack } from "../screens/skill/SkillStack";
import { StrengthStack } from "../screens/strength/StrengthStack";
import { useConditioningWorkspace } from "../state/ConditioningWorkspaceContext";
import { useSkillWorkspace } from "../state/SkillWorkspaceContext";
import { useStrengthWorkspace } from "../state/StrengthWorkspaceContext";
import { useNutritionWorkspace } from "../state/NutritionWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { initialRoute, sidebarItems, tabs, type RouteKey, type TabRoute } from "./routes";

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colorScheme, theme } = useAppTheme();
  const nutrition = useNutritionWorkspace();
  const { setNutritionTabHandler } = nutrition;
  const conditioning = useConditioningWorkspace();
  const strength = useStrengthWorkspace();
  const skill = useSkillWorkspace();
  const [activeRoute, setActiveRoute] = useState<RouteKey>(initialRoute);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const previousRoute = useRef<RouteKey>(initialRoute);
  const mainRoute = useRef<TabRoute>(initialRoute);
  const sidebarCloseHandler = useRef<(() => void) | null>(null);
  const sidebarActive = sidebarItems.some((item) => item.key === activeRoute);

  const routeExitGuard = useRef<((proceed: () => void) => void) | null>(null);
  const registerRouteExitGuard = useCallback((guard: ((proceed: () => void) => void) | null) => { routeExitGuard.current = guard; }, []);
  const applyRoute = useCallback((route: RouteKey) => {
    if (tabs.some((tab) => tab.key === route)) mainRoute.current = route as TabRoute;
    setActiveRoute(route);
    setSidebarOpen(false);
  }, []);

  const selectRoute = useCallback((route: RouteKey) => {
    if (route !== activeRoute && routeExitGuard.current) routeExitGuard.current(() => applyRoute(route));
    else applyRoute(route);
  }, [activeRoute, applyRoute]);

  const closeSidebarScreen = useCallback(() => {
    setActiveRoute(mainRoute.current);
    setSidebarOpen(false);
  }, []);

  const registerCloseHandler = useCallback((handler: (() => void) | null) => {
    sidebarCloseHandler.current = handler;
  }, []);

  useEffect(() => {
    setNutritionTabHandler(() => selectRoute("nutrition"));
  }, [selectRoute, setNutritionTabHandler]);

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

      if (sidebarActive) {
        (sidebarCloseHandler.current ?? closeSidebarScreen)();
        return true;
      }

      if (activeRoute === "nutrition") {
        return nutrition.handleHardwareBack();
      }

      if (activeRoute === "conditioning") {
        return conditioning.handleHardwareBack();
      }

      if (activeRoute === "strength") {
        return strength.handleHardwareBack();
      }

      if (activeRoute === "skill") {
        return skill.handleHardwareBack();
      }

      return false;
    });

    return () => subscription.remove();
  }, [activeRoute, closeSidebarScreen, conditioning, nutrition, sidebarActive, sidebarOpen, skill, strength]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View style={styles.workspace}>
        {!sidebarActive ? <Header
          onMenuPress={() => setSidebarOpen((open) => !open)}
          topInset={insets.top}
        /> : null}
        <View style={styles.content}>
          <ScreenForRoute registerExitGuard={registerRouteExitGuard} route={activeRoute} onClose={closeSidebarScreen} onMenu={() => setSidebarOpen(true)} registerCloseHandler={registerCloseHandler} />
        </View>
        {activeRoute === "nutrition" ? <NutritionStack /> : null}
        {activeRoute === "conditioning" ? <ConditioningStack /> : null}
        {activeRoute === "strength" ? <StrengthStack /> : null}
        {activeRoute === "skill" ? <SkillStack /> : null}
      </View>
      <BottomTabs
        activeRoute={activeRoute}
        bottomInset={keyboardVisible ? 0 : insets.bottom}
        onSelect={selectRoute}
      />
      <Sidebar
        activeRoute={activeRoute}
        bottomInset={keyboardVisible ? 0 : insets.bottom}
        onClose={() => {
          setSidebarOpen(false);
          if (sidebarActive) (sidebarCloseHandler.current ?? closeSidebarScreen)();
        }}
        onDismiss={() => setSidebarOpen(false)}
        onSelect={selectRoute}
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
