import { StyleSheet, View } from "react-native";

import { themes } from "../../theme/theme";
import { ActionButton } from "../ActionButton";

export function TrainingSessionActions({ onFreeSession, onCreateSession }: {
  onFreeSession: () => void;
  onCreateSession: () => void;
}) {
  return (
    <View style={styles.actions}>
      <ActionButton label="Free Session" onPress={onFreeSession} />
      <ActionButton label="Create Session" onPress={onCreateSession} tone="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: themes.dark.spacing.md },
});
