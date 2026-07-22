import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  createAppTheme,
  type AppTheme,
  type ColorScheme,
  type TertiaryColor,
} from "./theme";

type AppThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setTertiaryColor: (tertiaryColor: TertiaryColor) => void;
  tertiaryColor: TertiaryColor;
  theme: AppTheme;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
};

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>("dark");
  const [tertiaryColor, setTertiaryColor] =
    useState<TertiaryColor>("red");

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      setTertiaryColor,
      tertiaryColor,
      theme: createAppTheme(colorScheme, tertiaryColor),
    }),
    [colorScheme, tertiaryColor],
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
