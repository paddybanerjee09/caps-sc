import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "./navigation/AppNavigator";
import { AppStateProvider } from "./state/AppStateContext";
import { AppThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppStateProvider>
          <AppNavigator />
        </AppStateProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
