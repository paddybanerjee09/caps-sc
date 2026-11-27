import { StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackWarn } from "../../utils/feedback";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { StrengthAdaptationsScreen } from "./StrengthAdaptationsScreen";
import { StrengthSessionDetailScreen } from "./StrengthSessionDetailScreen";
import { WorkoutBuilderScreen } from "./WorkoutBuilderScreen";

const tokens = themes.dark;

function StrengthConfirm() {
  const { confirm, dismissConfirm } = useStrengthWorkspace();
  const { theme } = useAppTheme();
  if (!confirm) {
    return null;
  }
  return (
    <View
      accessibilityViewIsModal
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
        <Text style={[styles.tag, { color: theme.colors.tertiary }]}>CONFIRM ACTION</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{confirm.title}</Text>
        <Text style={[styles.message, { color: theme.colors.textMuted }]}>
          {confirm.message}
        </Text>
        <View style={styles.actions}>
          <PressOpacity
            accessibilityLabel="Keep editing"
            onPress={dismissConfirm}
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>Keep editing</Text>
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
                backgroundColor: "rgba(211, 21, 22, 0.14)",
                borderColor: theme.colors.tertiary,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]}>
              {confirm.confirmLabel}
            </Text>
          </PressOpacity>
        </View>
      </View>
    </View>
  );
}

function Cover() {
  const { stack } = useStrengthWorkspace();
  const { theme } = useAppTheme();
  const top = stack.at(-1);
  if (!top || top.name === "builder") {
    return null;
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.cover,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {top.name === "emphasis" ? (
        <StrengthAdaptationsScreen sessionId={top.sessionId} />
      ) : null}
      {top.name === "detail" ? (
        <StrengthSessionDetailScreen sessionId={top.sessionId} />
      ) : null}
    </View>
  );
}

export function StrengthStack() {
  const { confirm, stack } = useStrengthWorkspace();
  const builder = stack.find((entry) => entry.name === "builder");
  if (stack.length === 0 && !confirm) {
    return null;
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      {builder ? <WorkoutBuilderScreen key={builder.key} completingPlan={builder.completingPlan} /> : null}
      <Cover />
      <StrengthConfirm />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: "transparent",
  },
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
