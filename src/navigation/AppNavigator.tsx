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
import { initialRoute, type RouteKey } from "./routes";

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

  const selectRoute = useCallback((route: RouteKey) => {
    setActiveRoute(route);
    setSidebarOpen(false);
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
  }, [activeRoute, conditioning, nutrition, sidebarOpen, skill, strength]);

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
        onClose={() => setSidebarOpen(false)}
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
