import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { themes, type AppTheme, type ColorScheme } from "./theme";

type AppThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (colorScheme: ColorScheme) => void;
  theme: AppTheme;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>("dark");

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      theme: themes[colorScheme],
    }),
    [colorScheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);

  if (!value) {
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  }

  return value;
}
