import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { convertWeightToKilograms } from "../utils/weight";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type WeightLogModalProps = {
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  visible: boolean;
};

export function WeightLogModal({
  onClose,
  onSaved,
  visible,
}: WeightLogModalProps) {
  const { theme } = useAppTheme();
  const { logWeight, unitSettings } = useAppState();
  const [draftWeight, setDraftWeight] = useState("");

  function closeModal() {
    setDraftWeight("");
    onClose();
  }

  async function saveWeight() {
    const enteredWeight = Number(draftWeight);

    if (!Number.isFinite(enteredWeight) || enteredWeight <= 0) {
      return;
    }

    const weightKg = convertWeightToKilograms(
      enteredWeight,
      unitSettings.weight,
    );

    await logWeight(weightKg);
    await onSaved?.();
    closeModal();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <View
          style={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Weight
          </Text>

          <View style={styles.weightInputRow}>
            <TextInput
              accessibilityLabel={`Weight in ${
                unitSettings.weight === "metric" ? "kilograms" : "pounds"
              }`}
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                if (/^\d*\.?\d*$/.test(value)) {
                  setDraftWeight(value);
                }
              }}
              placeholder="0.0"
              placeholderTextColor={theme.colors.textMuted}
              selectionColor={theme.colors.tertiary}
              style={[
                styles.weightInput,
                {
                  borderColor: theme.colors.borderStrong,
                  color: theme.colors.text,
                },
              ]}
              value={draftWeight}
            />

            <Text style={[styles.weightUnit, { color: theme.colors.text }]}>
              {unitSettings.weight === "metric" ? "kg" : "lbs"}
            </Text>
          </View>

          <View style={styles.modalActions}>
            <PressOpacity onPress={closeModal}>
              <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
            </PressOpacity>

            <PressOpacity onPress={saveWeight}>
              <Text style={{ color: theme.colors.tertiary }}>Save</Text>
            </PressOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: "center",
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
  weightInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    paddingTop: tokens.spacing.xl,
  },
  weightInput: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    textAlign: "center",
    width: 100,
  },
  weightUnit: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.lg,
  },
});
