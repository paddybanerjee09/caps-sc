export type ColorScheme = "dark" | "light";

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
      fontSize: 13,
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
      tertiary: "#ca1415",
      switchTrackOff: "#2A2B2F",
      switchTrackOn: "#ca1415",
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
      tertiary: "#ca1415",
      switchTrackOff: "#D7D9DB",
      switchTrackOn: "#ca1415",
      switchThumb: "#FFFFFF",
      overlay: "rgba(17, 18, 20, 0.34)",
    },
  },
} as const;

export type AppTheme = (typeof themes)[ColorScheme];
