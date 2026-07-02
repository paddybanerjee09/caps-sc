export const tabs = [
  { key: "nutrition", title: "Nutrition" },
  { key: "sportTraining", title: "Sport" },
  { key: "home", title: "Home" },
  { key: "strengthConditioning", title: "S&C" },
  { key: "progress", title: "Progress" },
] as const;

export const sidebarItems = [
  { key: "settings", title: "Settings" },
  { key: "accountInfo", title: "Account Info" },
  { key: "athleteInfo", title: "Athlete Info" },
] as const;

export type TabRoute = (typeof tabs)[number]["key"];
export type SidebarRoute = (typeof sidebarItems)[number]["key"];
export type RouteKey = TabRoute | SidebarRoute;

export const initialRoute: TabRoute = "home";
