import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, View } from "react-native";

import type { TimelineEntry } from "../data/timelineRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, themes } from "../theme/theme";
import {
  convertKilogramsToWeight,
  convertWeightToKilograms,
} from "../utils/weight";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type WeightLogModalProps = {
  entryToEdit?: TimelineEntry;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

export function WeightLogModal({
  entryToEdit,
  onClose,
  onDeleted,
  onSaved,
  visible,
}: WeightLogModalProps) {
  const { theme } = useAppTheme();
  const { deleteWeightLog, logWeight, unitSettings, updateWeightLog } =
    useAppState();
  const [draftWeight, setDraftWeight] = useState("");
  const [draftLoggedAt, setDraftLoggedAt] = useState(() => new Date());

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null) {
      setDraftWeight(
        convertKilogramsToWeight(
          entryToEdit.weightKg,
          unitSettings.weight,
        ).toFixed(1),
      );
      setDraftLoggedAt(new Date(entryToEdit.startAt));
      return;
    }

    setDraftWeight("");
    setDraftLoggedAt(new Date());
  }, [entryToEdit, unitSettings.weight, visible]);

  function closeModal() {
    setDraftWeight("");
    onClose();
  }

  async function saveWeight() {
    const enteredWeight = Number(draftWeight);
    const loggedAt = draftLoggedAt.getTime();

    if (
      !Number.isFinite(enteredWeight) ||
      enteredWeight <= 0 ||
      !Number.isFinite(loggedAt) ||
      loggedAt > Date.now()
    ) {
      return;
    }

    let weightKg = convertWeightToKilograms(enteredWeight, unitSettings.weight);

    try {
      if (entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null) {
        const originalDisplayedWeight = convertKilogramsToWeight(
          entryToEdit.weightKg,
          unitSettings.weight,
        ).toFixed(1);

        if (draftWeight === originalDisplayedWeight) {
          weightKg = entryToEdit.weightKg;
        }

        await updateWeightLog(entryToEdit.id, weightKg, loggedAt);
      } else {
        await logWeight(weightKg, loggedAt);
      }

      await onSaved?.(loggedAt);
      closeModal();
    } catch {
      Alert.alert("Couldn't save weight log", "Please try again.");
    }
  }

  async function deleteExistingWeightLog() {
    if (entryToEdit?.kind !== "weight" || entryToEdit.weightKg === null) {
      return;
    }

    try {
      await deleteWeightLog(entryToEdit.id);
      await onDeleted?.();
      closeModal();
    } catch {
      Alert.alert("Couldn't delete weight log", "Please try again.");
    }
  }

  function confirmDeleteWeightLog() {
    Alert.alert("Delete weight log?", "This cannot be undone.", [
      {
        style: "cancel",
        text: "Cancel",
      },
      {
        onPress: () => {
          void deleteExistingWeightLog();
        },
        style: "destructive",
        text: "Delete",
      },
    ]);
  }

  const editingExistingWeight =
    entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <View
        style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.modalHeader}>
            {editingExistingWeight ? (
              <PressOpacity
                accessibilityLabel="Delete weight log"
                onPress={confirmDeleteWeightLog}
                style={styles.deleteButton}
              >
                <View
                  style={[
                    styles.deleteButtonPill,
                    { borderColor: appColorPalette.red },
                  ]}
                >
                  <Text
                    style={[
                      styles.deleteButtonText,
                      { color: appColorPalette.red },
                    ]}
                  >
                    Delete log
                  </Text>
                </View>
              </PressOpacity>
            ) : null}

            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Weight
            </Text>
          </View>

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

          {visible ? (
            <LogTimeChanger
              maximumDate={new Date()}
              onChange={setDraftLoggedAt}
              value={draftLoggedAt}
            />
          ) : null}

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
    alignSelf: "center",
    borderRadius: tokens.radius.lg,
    maxWidth: 280,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  deleteButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    justifyContent: "center",
    minHeight: 44,
    transform: [{ translateY: -8 }],
  },
  deleteButtonPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.sm,
  },
  deleteButtonText: {
    fontSize: 10,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: 14,
  },
  weightInputRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: tokens.spacing.lg,
    position: "relative",
    width: "100%",
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
    bottom: 11,
    fontSize: tokens.typography.body.fontSize,
    left: "50%",
    lineHeight: tokens.typography.body.lineHeight,
    marginLeft: 58,
    position: "absolute",
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.md,
  },
});
