import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { convertWeightToKilograms } from "../utils/weight";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type WeightLogModalProps = {
  onClose: () => void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

type PickerMode = "date" | "time" | "datetime";

export function WeightLogModal({
  onClose,
  onSaved,
  visible,
}: WeightLogModalProps) {
  const { colorScheme, theme } = useAppTheme();
  const { logWeight, unitSettings } = useAppState();
  const [draftWeight, setDraftWeight] = useState("");
  const [draftLoggedAt, setDraftLoggedAt] = useState(() => new Date());
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const androidPickerStartValue = useRef<Date | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftLoggedAt(new Date());
      setPickerMode(null);
      androidPickerStartValue.current = null;
    }
  }, [visible]);

  function closeModal() {
    setDraftWeight("");
    setPickerMode(null);
    androidPickerStartValue.current = null;
    onClose();
  }

  function toggleLoggedAtPicker() {
    if (pickerMode !== null) {
      setPickerMode(null);
      return;
    }

    Keyboard.dismiss();

    if (Platform.OS === "android") {
      androidPickerStartValue.current = new Date(draftLoggedAt);
    }

    setPickerMode(Platform.OS === "ios" ? "datetime" : "date");
  }

  function changeLoggedAt(
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) {
    if (event.type === "dismissed" || !selectedDate) {
      if (
        Platform.OS === "android" &&
        pickerMode === "time" &&
        androidPickerStartValue.current
      ) {
        setDraftLoggedAt(androidPickerStartValue.current);
      }

      androidPickerStartValue.current = null;
      setPickerMode(null);
      return;
    }

    if (Platform.OS === "android" && pickerMode === "date") {
      const updatedDate = new Date(draftLoggedAt);
      updatedDate.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );

      setDraftLoggedAt(updatedDate);
      setPickerMode("time");
      return;
    }

    if (Platform.OS === "android" && pickerMode === "time") {
      const updatedDate = new Date(draftLoggedAt);
      updatedDate.setHours(
        selectedDate.getHours(),
        selectedDate.getMinutes(),
        0,
        0,
      );

      if (updatedDate.getTime() > Date.now()) {
        if (androidPickerStartValue.current) {
          setDraftLoggedAt(androidPickerStartValue.current);
        }
      } else {
        setDraftLoggedAt(updatedDate);
      }

      androidPickerStartValue.current = null;
      setPickerMode(null);
      return;
    }

    setDraftLoggedAt(selectedDate);
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

    const weightKg = convertWeightToKilograms(
      enteredWeight,
      unitSettings.weight,
    );

    await logWeight(weightKg, loggedAt);
    await onSaved?.(loggedAt);
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
        style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
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

          <PressOpacity
            accessibilityLabel={`Change log time. Currently ${formatLoggedAt(
              draftLoggedAt,
            )}`}
            onPress={toggleLoggedAtPicker}
            style={[
              styles.loggedAtButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[styles.loggedAtLabel, { color: theme.colors.text }]}
            >
              Time
            </Text>

            <Text
              numberOfLines={1}
              style={[
                styles.loggedAtValue,
                { color: theme.colors.textMuted },
              ]}
            >
              {formatLoggedAt(draftLoggedAt)}
            </Text>
          </PressOpacity>

          {pickerMode !== null && (
            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              mode={pickerMode}
              onChange={changeLoggedAt}
              style={styles.loggedAtPicker}
              textColor={theme.colors.text}
              themeVariant={colorScheme}
              value={draftLoggedAt}
            />
          )}

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

function formatLoggedAt(date: Date) {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  loggedAtButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: tokens.spacing.lg,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  loggedAtLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  loggedAtValue: {
    flexShrink: 1,
    fontSize: tokens.typography.label.fontSize,
    marginLeft: tokens.spacing.md,
    textAlign: "right",
  },
  loggedAtPicker: {
    alignSelf: "center",
    maxWidth: 320,
    width: "100%",
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.lg,
  },
});
