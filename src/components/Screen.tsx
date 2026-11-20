import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { ScreenTitleCard } from "./ScreenTitleCard";
import { themes } from "../theme/theme";
import { WorkflowFooter, WorkflowHeader } from "./WorkflowChrome";

const tokens = themes.dark;

type ScreenProps = {
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  right?: ReactNode;
  subtitle?: string;
  title: string;
};

export function Screen({ children, footer, onClose, right, subtitle, title }: ScreenProps) {
  const { theme } = useAppTheme();

  const body = (
    <ScrollView
      style={styles.scroller}
      contentContainerStyle={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {onClose ? (
        subtitle ? <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>{subtitle}</Text> : null
      ) : <ScreenTitleCard title={title} subtitle={subtitle} />}
      {children ? <View style={styles.content}>{children}</View> : null}
    </ScrollView>
  );

  if (!onClose) return body;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <WorkflowHeader title={title} onClose={onClose} right={right} />
      {body}
      <WorkflowFooter onBack={onClose}>{footer}</WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
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
