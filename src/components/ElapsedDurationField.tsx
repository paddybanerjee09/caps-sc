import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import {
  elapsedDurationPartsToSeconds,
  formatElapsedDuration,
  MAX_ELAPSED_DURATION_SECONDS,
  secondsToElapsedDurationParts,
} from "../utils/conditioningMeasurements";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type DurationDraft = {
  hours: string;
  minutes: string;
  seconds: string;
};

type ElapsedDurationFieldProps = {
  allowZero?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  label: string;
  maximumSeconds?: number;
  onChange: (valueSeconds: number) => void;
  valueSeconds: number | null;
};

export function ElapsedDurationField({
  allowZero = false,
  disabled = false,
  hideLabel = false,
  label,
  maximumSeconds = MAX_ELAPSED_DURATION_SECONDS,
  onChange,
  valueSeconds,
}: ElapsedDurationFieldProps) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DurationDraft>(() =>
    createDraft(valueSeconds),
  );
  const [draftChanged, setDraftChanged] = useState(false);
  const effectiveMaximum = Math.min(
    Math.max(0, Math.floor(maximumSeconds)),
    MAX_ELAPSED_DURATION_SECONDS,
  );
  const draftSeconds = elapsedDurationPartsToSeconds(
    draft.hours,
    draft.minutes,
    draft.seconds,
    effectiveMaximum,
  );
  const validationMessage = getValidationMessage(
    draft,
    draftSeconds,
    allowZero,
    effectiveMaximum,
  );

  function openPicker() {
    Keyboard.dismiss();
    setDraft(createDraft(valueSeconds));
    setDraftChanged(false);
    setOpen(true);
  }

  function closePicker() {
    Keyboard.dismiss();
    setOpen(false);
  }

  function updateDraft(part: keyof DurationDraft, value: string) {
    if (!/^\d{0,2}$/.test(value)) {
      return;
    }

    setDraft((current) => ({ ...current, [part]: value }));
    setDraftChanged(true);
  }

  function saveDuration() {
    if (draftSeconds === null || (!allowZero && draftSeconds === 0)) {
      return;
    }

    // Opening an old fractional value rounds only its presentation. Unless a
    // control was edited, leave the original canonical value untouched.
    if (draftChanged || valueSeconds === null) {
      onChange(draftSeconds);
    }

    closePicker();
  }

  const displayedValue = formatElapsedDuration(valueSeconds);

  return (
    <View style={styles.field}>
      {!hideLabel ? (
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      ) : null}

      <PressOpacity
        accessibilityLabel={`${label}, ${displayedValue === "--:--:--" ? "not set" : displayedValue}`}
        disabled={disabled}
        onPress={openPicker}
        style={[
          styles.valueButton,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
            opacity: disabled ? tokens.opacity.disabled : 1,
          },
        ]}
      >
        <Text
          style={[styles.value, { color: theme.colors.text }]}
        >
          {displayedValue}
        </Text>
      </PressOpacity>

      <Modal
        animationType="fade"
        onRequestClose={closePicker}
        presentationStyle="overFullScreen"
        transparent
        visible={open}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <PressOpacity
            accessibilityLabel={`Cancel changing ${label.toLowerCase()}`}
            onPress={closePicker}
            style={StyleSheet.absoluteFill}
          >
            <View />
          </PressOpacity>

          <View
            accessibilityViewIsModal
            style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {label}
            </Text>

            <View style={styles.controls}>
              <DurationInput
                label="Hours"
                onChangeText={(value) => updateDraft("hours", value)}
                parentLabel={label}
                value={draft.hours}
              />
              <Text style={[styles.separator, { color: theme.colors.textMuted }]}>:</Text>
              <DurationInput
                label="Minutes"
                onChangeText={(value) => updateDraft("minutes", value)}
                parentLabel={label}
                value={draft.minutes}
              />
              <Text style={[styles.separator, { color: theme.colors.textMuted }]}>:</Text>
              <DurationInput
                label="Seconds"
                onChangeText={(value) => updateDraft("seconds", value)}
                parentLabel={label}
                value={draft.seconds}
              />
            </View>

            <Text
              accessibilityLiveRegion="polite"
              style={[
                styles.validation,
                {
                  color: validationMessage
                    ? theme.colors.tertiary
                    : theme.colors.textMuted,
                },
              ]}
            >
              {validationMessage ?? `Maximum ${formatElapsedDuration(effectiveMaximum)}`}
            </Text>

            <View style={styles.actions}>
              <PressOpacity onPress={closePicker} style={styles.action}>
                <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>Cancel</Text>
              </PressOpacity>
              <PressOpacity
                disabled={validationMessage !== null}
                onPress={saveDuration}
                style={styles.action}
              >
                <Text style={[styles.actionText, { color: theme.colors.tertiary }]}>Done</Text>
              </PressOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

type DurationInputProps = {
  label: string;
  onChangeText: (value: string) => void;
  parentLabel: string;
  value: string;
};

function DurationInput({
  label,
  onChangeText,
  parentLabel,
  value,
}: DurationInputProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.control}>
      <Text style={[styles.controlLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={`${parentLabel} ${label.toLowerCase()}`}
        keyboardType="number-pad"
        maxLength={2}
        onChangeText={onChangeText}
        selectTextOnFocus
        selectionColor={theme.colors.tertiary}
        style={[
          styles.input,
          {
            borderColor: theme.colors.borderStrong,
            color: theme.colors.text,
          },
        ]}
        value={value}
      />
    </View>
  );
}

function createDraft(valueSeconds: number | null): DurationDraft {
  const parts = secondsToElapsedDurationParts(valueSeconds);

  return {
    hours: String(parts.hours).padStart(2, "0"),
    minutes: String(parts.minutes).padStart(2, "0"),
    seconds: String(parts.seconds).padStart(2, "0"),
  };
}

function getValidationMessage(
  draft: DurationDraft,
  draftSeconds: number | null,
  allowZero: boolean,
  maximumSeconds: number,
) {
  if (Object.values(draft).some((value) => value === "")) {
    return "Enter hours, minutes, and seconds.";
  }

  if (Number(draft.minutes) > 59 || Number(draft.seconds) > 59) {
    return "Minutes and seconds must be between 00 and 59.";
  }

  if (draftSeconds === null) {
    return `Duration cannot exceed ${formatElapsedDuration(maximumSeconds)}.`;
  }

  if (!allowZero && draftSeconds === 0) {
    return "Duration must be greater than zero.";
  }

  return null;
}

const styles = StyleSheet.create({
  field: { gap: tokens.spacing.sm },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  valueButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  value: {
    fontSize: tokens.typography.body.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.body.lineHeight,
  },
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    maxWidth: 360,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  controls: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    paddingTop: tokens.spacing.lg,
  },
  control: { alignItems: "center", gap: tokens.spacing.xs },
  controlLabel: {
    fontSize: 10,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: 14,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: 20,
    fontVariant: ["tabular-nums"],
    minHeight: 48,
    paddingHorizontal: tokens.spacing.sm,
    textAlign: "center",
    width: 64,
  },
  separator: {
    fontSize: 20,
    lineHeight: 48,
  },
  validation: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    minHeight: tokens.typography.label.lineHeight,
    paddingTop: tokens.spacing.md,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.sm,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  actionText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
});
