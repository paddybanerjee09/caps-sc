import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";
const t = themes.dark;
export const strengthStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: t.spacing.lg },
  modal: { maxHeight: "92%", width: "100%", maxWidth: 620, alignSelf: "center", borderRadius: t.radius.md, overflow: "hidden" },
  body: { padding: t.spacing.lg, gap: t.spacing.md },
  header: { padding: t.spacing.lg, gap: t.spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, flexWrap: "wrap" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  controlRow: { flexDirection: "row", alignItems: "stretch", gap: t.spacing.sm },
  title: { ...t.typography.sectionTitle, flexShrink: 1 },
  actions: { flexDirection: "row", gap: t.spacing.sm, padding: t.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: 1, borderRadius: t.radius.sm, padding: t.spacing.md, gap: t.spacing.sm },
  button: { borderWidth: 1, borderRadius: t.radius.sm, minHeight: 44, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, justifyContent: "center", alignItems: "center" },
  input: { borderWidth: 1, borderRadius: t.radius.sm, minHeight: 44, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, ...t.typography.body },
});
export function StrengthModalFrame({ children, onClose, visible }: { children: ReactNode; onClose: () => void; visible: boolean }) {
  const { theme } = useAppTheme();
  if (!visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[strengthStyles.overlay, { backgroundColor: theme.colors.overlay }]}>
      <View style={[strengthStyles.modal, { backgroundColor: theme.colors.surface }]}>{children}</View>
    </KeyboardAvoidingView>
  </Modal>;
}
export function StrengthButton({ label, onPress, disabled, primary, accessibilityLabel, style }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useAppTheme();
  return <PressOpacity accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress}
    style={[strengthStyles.button, { backgroundColor: primary ? theme.colors.tertiary : theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }, style]}>
    <Text style={{ color: primary ? theme.colors.tertiaryContent : theme.colors.text, fontWeight: "700" }}>{label}</Text>
  </PressOpacity>;
}
export function StrengthField({ label, accessory, ...props }: TextInputProps & { label: string; accessory?: ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={{ gap: t.spacing.xs }}><Text style={{ color: theme.colors.textMuted }}>{label}</Text>
    <View style={strengthStyles.controlRow}>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.colors.textMuted}
        style={[strengthStyles.input, { flex: 1, minWidth: 0, color: theme.colors.text, borderColor: theme.colors.borderStrong }, props.style]} />
      {accessory}
    </View>
  </View>;
}
export function StrengthMessage({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted }}>{children}</Text>;
}
