import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";

export function ListRowSeparator() {
  const { theme } = useAppTheme();
  return <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />;
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
});
