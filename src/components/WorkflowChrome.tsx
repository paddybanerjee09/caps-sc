import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/ThemeContext";
import { PressOpacity } from "./PressOpacity";

/** Shared chrome for a branch of screens. X exits the branch; footer navigates it. */
export function WorkflowHeader({
  title,
  center,
  onClose,
  right,
  sideWidth,
  topInset,
}: {
  title?: string;
  center?: ReactNode;
  onClose: () => void;
  right?: ReactNode;
  sideWidth?: number;
  topInset?: number;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reservedWidth = sideWidth ?? (right ? 100 : 48);
  return (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderStrong, paddingTop: topInset ?? insets.top }]}>
      <View style={[styles.side, { width: reservedWidth }]}>
        <PressOpacity accessibilityLabel="Close logging flow" onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </PressOpacity>
      </View>
      <View style={styles.center}>
        {center ?? <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>{title}</Text>}
      </View>
      <View style={[styles.side, styles.right, { width: reservedWidth }]}>{right}</View>
    </View>
  );
}

export function WorkflowFooter({
  onBack,
  backLabel = "Cancel",
  children,
  disabled = false,
}: {
  onBack: () => void;
  backLabel?: "Cancel" | "Back";
  children?: ReactNode;
  disabled?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.borderStrong }]}>
      <PressOpacity accessibilityLabel={backLabel} disabled={disabled} onPress={onBack} style={[styles.back, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
        <Text style={[styles.action, { color: theme.colors.text }]}>{backLabel}</Text>
      </PressOpacity>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", flexShrink: 0, minHeight: 64, paddingHorizontal: 8, paddingBottom: 8 },
  side: { flexShrink: 0, justifyContent: "center", minHeight: 48 },
  right: { alignItems: "flex-end" },
  close: { alignItems: "center", justifyContent: "center", minHeight: 48, width: 48 },
  center: { alignItems: "center", flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  footer: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", flexShrink: 0, gap: 8, padding: 12 },
  back: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, minWidth: 72, paddingHorizontal: 12 },
  actions: { alignItems: "stretch", flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, minWidth: 0 },
  action: { fontSize: 14, fontWeight: "700" },
});
