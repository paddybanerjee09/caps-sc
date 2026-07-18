import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

type ScreenProps = {
  children?: ReactNode;
  title: string;
};

export function Screen({ children, title }: ScreenProps) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <View
        style={[styles.titleLine, { backgroundColor: theme.colors.border }]}
      />
      {children ? <View style={styles.content}>{children}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxl,
  },
  title: {
    fontSize: tokens.typography.title.fontSize,
    fontWeight: tokens.typography.title.fontWeight,
    lineHeight: tokens.typography.title.lineHeight,
  },
  titleLine: {
    height: StyleSheet.hairlineWidth,
    marginTop: tokens.spacing.md,
  },
  content: {
    marginTop: tokens.spacing.xl,
  },
});
