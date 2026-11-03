import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

type ScreenProps = {
  centerTitle?: boolean;
  children?: ReactNode;
  subtitle?: string;
  title: string;
};

export function Screen({ centerTitle, children, subtitle, title }: ScreenProps) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.headerBanner,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: theme.colors.tertiary }]} />
        <View style={[styles.headerTextWrap, centerTitle && styles.centerHeaderWrap]}>
          <Text
            style={[
              styles.title,
              centerTitle && styles.centerTitle,
              { color: theme.colors.text },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                centerTitle && styles.centerTitle,
                { color: theme.colors.textMuted },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  headerBanner: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    minHeight: 60,
    overflow: "hidden",
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  accentBar: {
    borderRadius: 999,
    height: 28,
    width: 4,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  centerHeaderWrap: {
    alignItems: "center",
    marginRight: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  centerTitle: {
    textAlign: "center",
  },
  content: {
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
});
