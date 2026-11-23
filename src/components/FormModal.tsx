import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, readableTextColor, themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type FormModalProps = {
  children: ReactNode;
  error?: string | null;
  footer?: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  title: string;
  visible?: boolean;
};

/** Shared biometric form presentation; drafts and persistence stay with the form. */
export function FormModal({ children, error, footer, onClose, onSave, saving = false, saveDisabled = false, title, visible = true }: FormModalProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="none" onRequestClose={() => { if (!saving) onClose(); }} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.backdrop, { backgroundColor: theme.colors.overlay, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <ScrollView bounces={false} style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
            {error ? <Text accessibilityRole="alert" style={{ color: appColorPalette.red }}>{error}</Text> : null}
          </ScrollView>
          <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
            <PressOpacity accessibilityLabel={`Cancel ${title}`} disabled={saving} onPress={onClose} style={[styles.action, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
              <Text style={[styles.actionText, { color: theme.colors.text }]}>Cancel</Text>
            </PressOpacity>
            {footer}
            <PressOpacity accessibilityLabel={`Save ${title}`} disabled={saving || saveDisabled} onPress={onSave} style={[styles.action, { backgroundColor: theme.colors.tertiary, borderColor: theme.colors.tertiary }]}>
              <Text style={[styles.actionText, { color: readableTextColor(theme.colors.tertiary) }]}>{saving ? "Saving…" : "Save"}</Text>
            </PressOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: tokens.spacing.lg },
  dialog: { borderRadius: tokens.radius.lg, borderWidth: 1, maxHeight: "100%", maxWidth: 440, width: "100%", overflow: "hidden" },
  title: { fontSize: 20, fontWeight: "800", padding: tokens.spacing.lg, textAlign: "center" },
  body: { padding: tokens.spacing.lg, paddingTop: 0, gap: tokens.spacing.md },
  actions: { borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm, padding: tokens.spacing.md },
  action: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: tokens.radius.md, borderWidth: 1, minHeight: 52, minWidth: 72, paddingHorizontal: tokens.spacing.sm },
  actionText: { fontSize: 14, fontWeight: "700" },
});
