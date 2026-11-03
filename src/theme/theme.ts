export type ColorScheme = "dark" | "light";

export const appColorPalette = {
  red: "#E11D24",
  blue: "#2563EB",
  green: "#22C55E",
  purple: "#A855F7",
  turquoise: "#14B8A6",
  yellow: "#EAB308",
  orange: "#F97316",
  pink: "#EC4899",
} as const;

export const tertiaryColorOptions = [
  { hex: appColorPalette.red, key: "red", label: "Red" },
  { hex: appColorPalette.blue, key: "blue", label: "Blue" },
  { hex: appColorPalette.green, key: "green", label: "Green" },
  { hex: appColorPalette.purple, key: "purple", label: "Purple" },
  {
    hex: appColorPalette.turquoise,
    key: "turquoise",
    label: "Turquoise",
  },
  { hex: appColorPalette.yellow, key: "yellow", label: "Yellow" },
  { hex: appColorPalette.orange, key: "orange", label: "Orange" },
  { hex: appColorPalette.pink, key: "pink", label: "Pink" },
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
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "800",
    },
    sectionTitle: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "700",
    },
    body: {
      fontSize: 15,
      lineHeight: 21,
      fontWeight: "600",
    },
    label: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
    },
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    pill: 999,
  },
  opacity: {
    pressed: 0.62,
    subdued: 0.76,
    disabled: 0.38,
  },
} as const;

export const themes = {
  dark: {
    ...shared,
    colors: {
      background: "#060709",
      surface: "#101216",
      surfaceMuted: "#181B22",
      text: "#FAFAFC",
      textMuted: "#9EA4B0",
      border: "rgba(250, 250, 252, 0.16)",
      borderStrong: "rgba(250, 250, 252, 0.34)",
      accent: "#FAFAFC",
      accentMuted: "rgba(250, 250, 252, 0.12)",
      tertiary: appColorPalette.red,
      switchTrackOff: "#262A34",
      switchTrackOn: appColorPalette.red,
      switchThumb: "#FFFFFF",
      overlay: "rgba(0, 0, 0, 0.74)",
    },
  },
  light: {
    ...shared,
    colors: {
      background: "#F3F4F6",
      surface: "#FFFFFF",
      surfaceMuted: "#E5E7EB",
      text: "#090A0D",
      textMuted: "#4B505B",
      border: "rgba(9, 10, 13, 0.16)",
      borderStrong: "rgba(9, 10, 13, 0.32)",
      accent: "#090A0D",
      accentMuted: "rgba(9, 10, 13, 0.08)",
      tertiary: appColorPalette.red,
      switchTrackOff: "#CBD0D8",
      switchTrackOn: appColorPalette.red,
      switchThumb: "#FFFFFF",
      overlay: "rgba(9, 10, 13, 0.52)",
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
    },
  };
}

export type AppTheme = ReturnType<typeof createAppTheme>;

const DARK_TEXT = "#060709";
const LIGHT_TEXT = "#FFFFFF";

/** Picks near-black or white text for a #RRGGBB fill, whichever contrasts more. */
export function readableTextColor(background: string) {
  const fill = relativeLuminance(background);

  if (fill === null) {
    return LIGHT_TEXT;
  }

  const lightTextContrast = 1.05 / (fill + 0.05);
  const darkTextContrast = (fill + 0.05) / (relativeLuminance(DARK_TEXT)! + 0.05);
  return lightTextContrast >= darkTextContrast ? LIGHT_TEXT : DARK_TEXT;
}

function relativeLuminance(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!match) {
    return null;
  }

  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
