import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { ScreenTitleCard } from "./ScreenTitleCard";
import { themes } from "../theme/theme";

const tokens = themes.dark;

type ScreenProps = {
  children?: ReactNode;
  subtitle?: string;
  title: string;
};

export function Screen({ children, subtitle, title }: ScreenProps) {
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
      <ScreenTitleCard title={title} subtitle={subtitle} />
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
  content: {
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.md,
  },
});
