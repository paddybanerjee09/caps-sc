import { StyleSheet, View } from "react-native";

import { themes } from "../../theme/theme";
import { ActionButton } from "../ActionButton";

export function TrainingSessionActions({ onFreeSession, label = "Log Session" }: {
  onFreeSession: () => void;
  label?: string;
}) {
  return (
    <View style={styles.actions}>
      <ActionButton label={label} onPress={onFreeSession} />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: themes.dark.spacing.md },
});
