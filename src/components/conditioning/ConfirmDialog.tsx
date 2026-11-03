import { StyleSheet, Text, View } from "react-native";

import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackWarn } from "../../utils/feedback";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;

export function ConfirmDialog() {
  const { confirm, dismissConfirm } = useConditioningWorkspace();
  const { theme } = useAppTheme();

  if (!confirm) {
    return null;
  }

  const activeText = readableTextColor(theme.colors.tertiary);

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: theme.colors.overlay },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.tag, { color: theme.colors.tertiary }]}>
          CONFIRM ACTION
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {confirm.title}
        </Text>
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          {confirm.message}
        </Text>
        <View style={styles.actions}>
          <PressOpacity
            accessibilityLabel={confirm.cancelLabel ?? "Cancel"}
            onPress={dismissConfirm}
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>
              {confirm.cancelLabel ?? "Cancel"}
            </Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel={confirm.confirmLabel}
            onPress={() => {
              feedbackWarn();
              const action = confirm.onConfirm;
              dismissConfirm();
              action();
            }}
            silent
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.tertiary,
                borderColor: theme.colors.tertiary,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: activeText }]}>
              {confirm.confirmLabel}
            </Text>
          </PressOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    maxWidth: 380,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  tag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  button: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
