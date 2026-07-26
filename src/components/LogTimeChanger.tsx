import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Keyboard, Platform, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type LogTimeChangerProps = {
  maximumDate?: Date;
  onChange: (date: Date) => void;
  value: Date;
};

export function LogTimeChanger({
  maximumDate,
  onChange,
  value,
}: LogTimeChangerProps) {
  const { colorScheme, theme } = useAppTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const latestAllowedDate = maximumDate ?? new Date();

  function togglePicker() {
    Keyboard.dismiss();
    setPickerOpen((current) => !current);
  }

  function changeTime(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      setPickerOpen(false);
      return;
    }

    const updatedDate = new Date(value);
    updatedDate.setHours(
      selectedDate.getHours(),
      selectedDate.getMinutes(),
      0,
      0,
    );

    if (updatedDate.getTime() <= latestAllowedDate.getTime()) {
      onChange(updatedDate);
    }

    if (Platform.OS === "android") {
      setPickerOpen(false);
    }
  }

  return (
    <View style={styles.container}>
      <PressOpacity
        accessibilityLabel={`Change log time. Currently ${formatFullDateTime(
          value,
        )}`}
        onPress={togglePicker}
        style={styles.button}
      >
        <View
          style={[
            styles.buttonPill,
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

          <Text style={[styles.time, { color: theme.colors.text }]}>
            {formatTime(value)}
          </Text>
        </View>
      </PressOpacity>

      {pickerOpen && (
        <View style={Platform.OS === "ios" ? styles.pickerFrame : undefined}>
          <DateTimePicker
            display={Platform.OS === "ios" ? "spinner" : "default"}
            mode="time"
            onChange={changeTime}
            style={Platform.OS === "ios" ? styles.picker : undefined}
            textColor={theme.colors.text}
            themeVariant={colorScheme}
            value={value}
          />
        </View>
      )}
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
    alignItems: "center",
    paddingTop: tokens.spacing.sm,
    width: "100%",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  buttonPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    height: 28,
    paddingHorizontal: tokens.spacing.sm,
  },
  time: {
    fontSize: 10,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: 14,
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
});
