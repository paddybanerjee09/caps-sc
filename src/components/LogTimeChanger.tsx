import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type LogTimeChangerProps = {
  inline?: boolean;
  maximumDate?: Date;
  onChange: (date: Date) => void;
  value: Date;
};

export function LogTimeChanger({
  inline = false,
  maximumDate,
  onChange,
  value,
}: LogTimeChangerProps) {
  const { colorScheme, theme } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(() => new Date(value));
  const draftTimeRef = useRef(new Date(value));

  function openPicker() {
    Keyboard.dismiss();
    const initialTime = new Date(value);
    draftTimeRef.current = initialTime;
    setDraftTime(initialTime);

    if (Platform.OS === "android") {
      openAndroidTimePicker(initialTime);
      return;
    }

    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function openAndroidTimePicker(initialDate: Date) {
    DateTimePickerAndroid.open({
      mode: "time",
      onChange: changeTime,
      value: initialDate,
    });
  }

  function changeTime(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      closePicker();
      return;
    }

    const updatedDate = new Date(draftTimeRef.current);
    updatedDate.setHours(
      selectedDate.getHours(),
      selectedDate.getMinutes(),
      0,
      0,
    );
    const acceptedDate =
      maximumDate && updatedDate.getTime() > maximumDate.getTime()
        ? new Date(maximumDate)
        : updatedDate;

    draftTimeRef.current = acceptedDate;

    if (Platform.OS === "android") {
      onChange(new Date(acceptedDate));
    } else {
      setDraftTime(acceptedDate);
    }

    if (Platform.OS === "android") {
      closePicker();
    }
  }

  function saveTime() {
    onChange(new Date(draftTimeRef.current));
    closePicker();
  }

  return (
    <View style={[styles.container, inline && styles.inlineContainer]}>
      <PressOpacity
        accessibilityLabel={`Change log time. Currently ${formatFullDateTime(
          value,
        )}`}
        onPress={openPicker}
        style={[
            styles.button,
            inline && styles.inlineButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
      >
          <Ionicons
            color={theme.colors.textMuted}
            name="time-outline"
            size={15}
          />

          <Text
            numberOfLines={1}
            style={[styles.time, { color: theme.colors.text }]}
          >
            {formatTime(value)}
          </Text>
      </PressOpacity>

      {Platform.OS === "ios" ? (
        <Modal
          animationType="fade"
          onRequestClose={closePicker}
          presentationStyle="overFullScreen"
          transparent
          visible={pickerOpen}
        >
          <View
            style={[
              styles.modalOverlay,
              { backgroundColor: theme.colors.overlay },
            ]}
          >
            <View
              accessibilityViewIsModal
              style={[
                styles.pickerModal,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Log time
              </Text>

              <View style={styles.pickerFrame}>
                {pickerOpen ? (
                  <DateTimePicker
                    display="spinner"
                    maximumDate={maximumDate}
                    mode="time"
                    onChange={changeTime}
                    style={styles.picker}
                    textColor={theme.colors.text}
                    themeVariant={colorScheme}
                    value={draftTime}
                  />
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <PressOpacity
                  accessibilityLabel="Cancel changing log time"
                  onPress={closePicker}
                  style={styles.modalAction}
                >
                  <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
                </PressOpacity>

                <PressOpacity
                  accessibilityLabel="Save log time"
                  onPress={saveTime}
                  style={styles.modalAction}
                >
                  <Text style={{ color: theme.colors.tertiary }}>Done</Text>
                </PressOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDateTime(date: Date) {
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    paddingTop: tokens.spacing.sm,
  },
  inlineContainer: {
    alignSelf: "stretch",
    flexShrink: 0,
    paddingTop: 0,
    width: "auto",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },
  inlineButton: {
    flex: 1,
    minWidth: 72,
  },
  time: {
    fontSize: 13,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: 18,
  },
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  pickerModal: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    maxWidth: 300,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  picker: {
    height: 180,
    transform: [{ scale: 0.75 }],
    width: 240,
  },
  pickerFrame: {
    alignItems: "center",
    height: 135,
    justifyContent: "center",
    overflow: "hidden",
    width: 180,
  },
  modalActions: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.sm,
    width: "100%",
  },
  modalAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
});
