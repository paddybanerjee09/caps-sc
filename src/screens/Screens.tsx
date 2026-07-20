import type { RouteKey } from "../navigation/routes";
import { AccountInfoScreen } from "./AccountInfoScreen";
import { AthleteInfoScreen } from "./AthleteInfoScreen";
import { ConditioningScreen } from "./ConditioningScreen";
import { HomeScreen } from "./HomeScreen";
import { NutritionScreen } from "./NutritionScreen";
import { SettingsScreen } from "./SettingsScreen";
import { SportScreen } from "./SportScreen";
import { StrengthConditioningScreen } from "./StrengthConditioningScreen";

type ScreenForRouteProps = {
  route: RouteKey;
};

export function ScreenForRoute({ route }: ScreenForRouteProps) {
  switch (route) {
    case "nutrition":
      return <NutritionScreen />;
    case "sport":
      return <SportScreen />;
    case "strength":
      return <StrengthConditioningScreen />;
    case "conditioning":
      return <ConditioningScreen />;
    case "settings":
      return <SettingsScreen />;
    case "accountInfo":
      return <AccountInfoScreen />;
    case "athleteInfo":
      return <AthleteInfoScreen />;
    case "home":
    default:
      return <HomeScreen />;
  }
}
