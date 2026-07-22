export const tabs = [
  { key: "nutrition", title: "Nutrition" },
  { key: "skill", title: "Skills Training" },
  { key: "home", title: "Home" },
  { key: "strength", title: "Strength" },
  { key: "conditioning", title: "Conditioning" },
] as const;

export const sidebarItems = [
  { key: "settings", title: "Settings" },
  { key: "accountInfo", title: "Account Information" },
  { key: "athleteInfo", title: "Athlete Information" },
] as const;

export type TabRoute = (typeof tabs)[number]["key"];
export type SidebarRoute = (typeof sidebarItems)[number]["key"];
export type RouteKey = TabRoute | SidebarRoute;

export const initialRoute: TabRoute = "home";
