import { SQLiteProvider } from "expo-sqlite";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { migrateDatabase } from "./data/database";

import { AppNavigator } from "./navigation/AppNavigator";
import { AppStateProvider } from "./state/AppStateContext";
import { ConditioningWorkspaceProvider } from "./state/ConditioningWorkspaceContext";
import { SkillWorkspaceProvider } from "./state/SkillWorkspaceContext";
import { StrengthWorkspaceProvider } from "./state/StrengthWorkspaceContext";
import { NutritionWorkspaceProvider } from "./state/NutritionWorkspaceContext";
import { AppThemeProvider } from "./theme/ThemeContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="caps.db" onInit={migrateDatabase}>
        <AppThemeProvider>
          <AppStateProvider>
            <NutritionWorkspaceProvider>
              <ConditioningWorkspaceProvider>
                <StrengthWorkspaceProvider>
                  <SkillWorkspaceProvider>
                    <AppNavigator />
                  </SkillWorkspaceProvider>
                </StrengthWorkspaceProvider>
              </ConditioningWorkspaceProvider>
            </NutritionWorkspaceProvider>
          </AppStateProvider>
        </AppThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
