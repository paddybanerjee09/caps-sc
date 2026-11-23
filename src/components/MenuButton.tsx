import { StyleSheet, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

/** The same sidebar trigger in the main header and settings headers. */
export function MenuButton({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity
      accessibilityLabel="Open sidebar"
      onPress={onPress}
      style={[styles.button, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
    >
      <View style={[styles.line, { backgroundColor: theme.colors.text }]} />
      <View style={[styles.line, styles.shortLine, { backgroundColor: theme.colors.tertiary }]} />
      <View style={[styles.line, { backgroundColor: theme.colors.text }]} />
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: themes.dark.radius.md, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  line: { borderRadius: 999, height: 2, marginVertical: 2.5, width: 18 },
  shortLine: { width: 14 },
});
