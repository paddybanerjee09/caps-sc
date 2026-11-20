import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
const tokens = themes.dark;
type ScreenTitleCardProps = { title: string; subtitle?: string };
export function ScreenTitleCard({ title, subtitle }: ScreenTitleCardProps) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: theme.colors.tertiary }]} />
      <View style={styles.bannerText}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    overflow: "hidden",
  },
  accent: {
    alignSelf: "stretch",
    width: 6,
  },
  bannerText: {
    flex: 1,
    gap: 2,
    paddingVertical: tokens.spacing.lg,
    paddingRight: tokens.spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
