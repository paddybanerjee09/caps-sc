import { StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "../../theme/ThemeContext";

/** Keep raw text editable; each training form validates when its action is pressed. */
export function TrainingNumberField({
  label, value, onChangeText, placeholder = "", editable = true, maxLength = 6,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  maxLength?: number;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        keyboardType="number-pad"
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        selectTextOnFocus={value === "Mixed"}
        style={[styles.input, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexGrow: 1, flexBasis: "44%", gap: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, fontSize: 16, fontVariant: ["tabular-nums"] },
});
