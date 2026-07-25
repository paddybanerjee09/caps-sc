import type { TimelineKind } from "../data/timelineRepository";
import { appColorPalette } from "../theme/theme";

export type TimelineCategoryPresentation = {
  label: string;
  color: string;
  contentColor: string;
  icon: string;
  iconSet: "ionicons" | "materialCommunity";
};

export const timelineCategories = {
  strength: {
    label: "Strength Training",
    color: appColorPalette.red,
    contentColor: "#FFFFFF",
    icon: "barbell-outline",
    iconSet: "ionicons",
  },
  conditioning: {
    label: "Conditioning",
    color: appColorPalette.yellow,
    contentColor: "#111214",
    icon: "run-fast",
    iconSet: "materialCommunity",
  },
  skill: {
    label: "Skills Training",
    color: appColorPalette.green,
    contentColor: "#111214",
    icon: "boxing-glove",
    iconSet: "materialCommunity",
  },
  meal: {
    label: "Meal",
    color: appColorPalette.orange,
    contentColor: "#111214",
    icon: "restaurant-outline",
    iconSet: "ionicons",
  },
  weight: {
    label: "Weight",
    color: appColorPalette.blue,
    contentColor: "#FFFFFF",
    icon: "scale-outline",
    iconSet: "ionicons",
  },
  sleep: {
    label: "Sleep",
    color: appColorPalette.purple,
    contentColor: "#FFFFFF",
    icon: "moon-outline",
    iconSet: "ionicons",
  },
} as const satisfies Record<TimelineKind, TimelineCategoryPresentation>;
