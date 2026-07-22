import type { RouteKey } from "../navigation/routes";
import { AccountInfoScreen } from "./AccountInfoScreen";
import { AthleteInfoScreen } from "./AthleteInfoScreen";
import { ConditioningScreen } from "./ConditioningScreen";
import { HomeScreen } from "./HomeScreen";
import { NutritionScreen } from "./NutritionScreen";
import { SettingsScreen } from "./SettingsScreen";
import { SkillTrainingScreen } from "./SkillScreen";
import { StrengthTrainingScreen } from "./StrengthTrainingScreen";

type ScreenForRouteProps = {
  route: RouteKey;
};

export function ScreenForRoute({ route }: ScreenForRouteProps) {
  switch (route) {
    case "nutrition":
      return <NutritionScreen />;
    case "skill":
      return <SkillTrainingScreen />;
    case "strength":
      return <StrengthTrainingScreen />;
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
