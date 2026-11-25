import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { StructuredFormat } from "../../conditioning/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { ActionButton } from "../ActionButton";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;
const options: {
  format: "free" | StructuredFormat;
  title: string;
  description: string;
  icon: "walk-outline" | "timer-outline" | "flash-outline" | "repeat-outline";
}[] = [
  { format: "free", title: "Free Session", description: "Run / bike", icon: "walk-outline" },
  { format: "time_interval", title: "Time Interval", description: "Work / rest timer", icon: "timer-outline" },
  { format: "sprint", title: "Sprints", description: "Distance repeats", icon: "flash-outline" },
  { format: "circuit", title: "Circuit", description: "Station rounds", icon: "repeat-outline" },
];

export function ConditioningSessionChooser({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (format: "free" | StructuredFormat) => void;
}) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>Log Session</Text>
          <ScrollView contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled" style={styles.scroller}>
            {options.map((option) => (
              <PressOpacity accessibilityLabel={option.title} key={option.format} onPress={() => onSelect(option.format)} style={[styles.option, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
                <Ionicons name={option.icon} color={theme.colors.text} size={24} />
                <View style={styles.copy}>
                  <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{option.title}</Text>
                  <Text style={[styles.description, { color: theme.colors.textMuted }]}>{option.description}</Text>
                </View>
                <Ionicons name="chevron-forward" color={theme.colors.textMuted} size={20} />
              </PressOpacity>
            ))}
          </ScrollView>
          <View style={styles.footer}><ActionButton label="Cancel" onPress={onClose} tone="secondary" /></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: tokens.spacing.lg },
  dialog: { borderWidth: 1, borderRadius: tokens.radius.lg, maxWidth: 440, maxHeight: "100%", width: "100%", overflow: "hidden" },
  title: { fontSize: 20, fontWeight: "800", padding: tokens.spacing.lg, textAlign: "center" },
  scroller: { flexShrink: 1 },
  options: { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.md },
  option: { flexDirection: "row", alignItems: "center", minHeight: 68, borderWidth: 1, borderRadius: 12, padding: tokens.spacing.md, gap: tokens.spacing.md },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  optionTitle: { fontSize: 15, fontWeight: "700" },
  description: { fontSize: 12 },
  footer: { padding: tokens.spacing.lg },
});
