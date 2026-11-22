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
  onClose?: () => void;
  registerCloseHandler?: (handler: (() => void) | null) => void;
  registerExitGuard?: (guard: ((proceed: () => void) => void) | null) => void;
  route: RouteKey;
};

export function ScreenForRoute({ onClose, registerCloseHandler, registerExitGuard, route }: ScreenForRouteProps) {
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
      return <SettingsScreen onClose={onClose} />;
    case "accountInfo":
      return <AccountInfoScreen onClose={onClose} registerCloseHandler={registerCloseHandler} />;
    case "athleteInfo":
      return <AthleteInfoScreen onClose={onClose} registerCloseHandler={registerCloseHandler} />;
    case "home":
    default:
      return <HomeScreen registerExitGuard={registerExitGuard} />;
  }
}
