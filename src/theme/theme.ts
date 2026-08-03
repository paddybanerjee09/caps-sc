export type ColorScheme = "dark" | "light";

export const appColorPalette = {
  red: "#D31516",
  blue: "#1545D3",
  green: "#2DC020",
  purple: "#9620C0",
  turquoise: "#20C0B2",
  yellow: "#D3C615",
  orange: "#D35915",
  pink: "#C868BF",
} as const;

export const tertiaryColorOptions = [
  {
    content: "#FFFFFF",
    hex: appColorPalette.red,
    key: "red",
    label: "Red",
  },
  {
    content: "#FFFFFF",
    hex: appColorPalette.blue,
    key: "blue",
    label: "Blue",
  },
  {
    content: "#111214",
    hex: appColorPalette.green,
    key: "green",
    label: "Green",
  },
  {
    content: "#FFFFFF",
    hex: appColorPalette.purple,
    key: "purple",
    label: "Purple",
  },
  {
    content: "#111214",
    hex: appColorPalette.turquoise,
    key: "turquoise",
    label: "Turquoise",
  },
  {
    content: "#111214",
    hex: appColorPalette.yellow,
    key: "yellow",
    label: "Yellow",
  },
  {
    content: "#111214",
    hex: appColorPalette.orange,
    key: "orange",
    label: "Orange",
  },
  {
    content: "#111214",
    hex: appColorPalette.pink,
    key: "pink",
    label: "Pink",
  },
] as const;

export type TertiaryColor = (typeof tertiaryColorOptions)[number]["key"];

const shared = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  typography: {
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: "700",
    },
    sectionTitle: {
      fontSize: 16,
      lineHeight: 18,
      fontWeight: "700",
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "500",
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
    },
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  opacity: {
    pressed: 0.62,
    subdued: 0.72,
    disabled: 0.42,
  },
} as const;

export const themes = {
  dark: {
    ...shared,
    colors: {
      background: "#0B0B0C",
      surface: "#111214",
      surfaceMuted: "#1A1B1E",
      text: "#F4F4F5",
      textMuted: "#A7A9AD",
      border: "rgba(244, 244, 245, 0.14)",
      borderStrong: "rgba(244, 244, 245, 0.28)",
      accent: "#F4F4F5",
      accentMuted: "rgba(244, 244, 245, 0.14)",
      tertiary: appColorPalette.red,
      tertiaryContent: "#FFFFFF",
      switchTrackOff: "#2A2B2F",
      switchTrackOn: appColorPalette.red,
      switchThumb: "#FFFFFF",
      overlay: "rgba(0, 0, 0, 0.58)",
    },
  },
  light: {
    ...shared,
    colors: {
      background: "#F7F7F8",
      surface: "#FFFFFF",
      surfaceMuted: "#ECEDEF",
      text: "#111214",
      textMuted: "#62656A",
      border: "rgba(17, 18, 20, 0.14)",
      borderStrong: "rgba(17, 18, 20, 0.26)",
      accent: "#111214",
      accentMuted: "rgba(17, 18, 20, 0.1)",
      tertiary: appColorPalette.red,
      tertiaryContent: "#FFFFFF",
      switchTrackOff: "#D7D9DB",
      switchTrackOn: appColorPalette.red,
      switchThumb: "#FFFFFF",
      overlay: "rgba(17, 18, 20, 0.34)",
    },
  },
} as const;

export function createAppTheme(
  colorScheme: ColorScheme,
  tertiaryColor: TertiaryColor,
) {
  const baseTheme = themes[colorScheme];
  const selectedColor = tertiaryColorOptions.find(
    (option) => option.key === tertiaryColor,
  )!;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      switchTrackOn: selectedColor.hex,
      tertiary: selectedColor.hex,
      tertiaryContent: selectedColor.content,
    },
  };
}

export type AppTheme = ReturnType<typeof createAppTheme>;
