import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "./navigation/AppNavigator";
import { AppThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <AppNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
