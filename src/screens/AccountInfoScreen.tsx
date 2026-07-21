import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";

import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";

const tokens = themes.dark;

export function AccountInfoScreen() {
  const { username, setUsername } = useAppState();
  const { theme } = useAppTheme();
  const [draftUsername, setDraftUsername] = useState("");
  const [usernameEditorOpen, setUsernameEditorOpen] = useState(false);

  function openUsernameEditor() {
    setDraftUsername(username);
    setUsernameEditorOpen(true);
  }

  function saveUsername() {
    setUsername(draftUsername.trim());
    setUsernameEditorOpen(false);
  }

  return (
    <Screen title="Account Information">
      <InfoRow
        label="Username"
        onPress={openUsernameEditor}
        value={username || "Not selected"}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setUsernameEditorOpen(false)}
        transparent
        visible={usernameEditorOpen}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Username
            </Text>

            <View style={styles.modalContainer}>
              <TextInput
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                onChangeText={setDraftUsername}
                placeholder="Enter username"
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={theme.colors.tertiary}
                style={[
                  styles.usernameInput,
                  {
                    borderColor: theme.colors.borderStrong,
                    color: theme.colors.text,
                  },
                ]}
                value={draftUsername}
              />
            </View>

            <View style={styles.modalActions}>
              <PressOpacity onPress={() => setUsernameEditorOpen(false)}>
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </PressOpacity>

              <PressOpacity onPress={saveUsername}>
                <Text style={{ color: theme.colors.tertiary }}>Save</Text>
              </PressOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  onPress?: () => void;
};

function InfoRow({ label, value, onPress }: InfoRowProps) {
  const { theme } = useAppTheme();

  return (
    <PressOpacity
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={[styles.row, { borderColor: theme.colors.border }]}
    >
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>

      <View style={styles.value}>
        <Text style={[styles.valueText, { color: theme.colors.textMuted }]}>
          {value}
        </Text>

        <Ionicons
          color={theme.colors.textMuted}
          name="chevron-forward"
          size={18}
        />
      </View>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: tokens.spacing.md,
  },
  value: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  valueText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  label: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.xl,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.xl,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.lg,
  },
  modalContainer: {
    alignItems: "center",
    paddingTop: tokens.spacing.xl,
    width: "100%",
  },
  usernameInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    width: "100%",
  },
});
