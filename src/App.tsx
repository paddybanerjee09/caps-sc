import { SQLiteProvider } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrateDatabase } from "./data/database";

import { AppNavigator } from "./navigation/AppNavigator";
import { AppStateProvider } from "./state/AppStateContext";
import { AppThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="caps.db" onInit={migrateDatabase}>
        <AppThemeProvider>
          <AppStateProvider>
            <AppNavigator />
          </AppStateProvider>
        </AppThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
