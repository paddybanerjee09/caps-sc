import { StyleSheet, Text, View } from "react-native";

import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;

export function ConfirmDialog() {
  const { confirm, dismissConfirm } = useConditioningWorkspace();
  const { theme } = useAppTheme();

  if (!confirm) {
    return null;
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: theme.colors.overlay },
      ]}
    >
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{confirm.title}</Text>
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          {confirm.message}
        </Text>
        <View style={styles.actions}>
          <PressOpacity accessibilityLabel={confirm.cancelLabel ?? "Cancel"} onPress={dismissConfirm}>
            <Text style={{ color: theme.colors.textMuted }}>
              {confirm.cancelLabel ?? "Cancel"}
            </Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel={confirm.confirmLabel}
            onPress={() => {
              const action = confirm.onConfirm;
              dismissConfirm();
              action();
            }}
          >
            <Text style={{ color: theme.colors.tertiary, fontWeight: "700" }}>
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
    maxWidth: 360,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  title: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
  },
  message: {
    marginTop: tokens.spacing.sm,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.lg,
    justifyContent: "flex-end",
    marginTop: tokens.spacing.lg,
  },
});
