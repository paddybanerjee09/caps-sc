import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getAthleteConditioningBaselines,
  saveAthleteConditioningBaselines,
} from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { AthleteConditioningBaselines } from "../types/conditioning";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type ConditioningBaselinesModalProps = {
  onClose: () => void;
  onSaved?: (baselines: AthleteConditioningBaselines) => Promise<void> | void;
  visible: boolean;
};

export function ConditioningBaselinesModal({
  onClose,
  onSaved,
  visible,
}: ConditioningBaselinesModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [maximumHeartRateInput, setMaximumHeartRateInput] = useState("");
  const [thresholdPaceInput, setThresholdPaceInput] = useState("");
  const [maximumAerobicSpeedInput, setMaximumAerobicSpeedInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requestIdRef = useRef(0);
  const savingRef = useRef(false);

  const loadBaselines = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const baselines = await getAthleteConditioningBaselines(db);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setMaximumHeartRateInput(
        baselines.maximumHeartRateBpm === null
          ? ""
          : String(baselines.maximumHeartRateBpm),
      );
      setThresholdPaceInput(
        baselines.thresholdPaceSecondsPerKm === null
          ? ""
          : formatThresholdPace(baselines.thresholdPaceSecondsPerKm),
      );
      setMaximumAerobicSpeedInput(
        baselines.maximumAerobicSpeedKph === null
          ? ""
          : String(baselines.maximumAerobicSpeedKph),
      );
    } catch {
      if (requestId === requestIdRef.current) {
        setLoadError("Couldn't load conditioning baselines.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [db]);

  useEffect(() => {
    if (!visible) {
      requestIdRef.current += 1;
      return;
    }

    void loadBaselines();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadBaselines, visible]);

  function closeModal() {
    if (savingRef.current) {
      return;
    }

    requestIdRef.current += 1;
    onClose();
  }

  async function saveBaselines() {
    if (savingRef.current) {
      return;
    }

    const parsedBaselines = parseBaselines({
      maximumAerobicSpeedInput,
      maximumHeartRateInput,
      thresholdPaceInput,
    });

    if (!parsedBaselines.ok) {
      Alert.alert("Check conditioning baselines", parsedBaselines.message);
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const savedBaselines = await saveAthleteConditioningBaselines(
        db,
        parsedBaselines.baselines,
      );
      await onSaved?.(savedBaselines);
      onClose();
    } catch {
      Alert.alert(
        "Couldn't save conditioning baselines",
        "Please try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.modalOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Conditioning baselines
          </Text>

          {loading ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator color={theme.colors.tertiary} />
              <Text style={{ color: theme.colors.textMuted }}>
                Loading baselines…
              </Text>
            </View>
          ) : loadError ? (
            <View style={styles.statusContainer}>
              <Text style={{ color: theme.colors.textMuted }}>{loadError}</Text>
              <PressOpacity
                accessibilityLabel="Retry loading conditioning baselines"
                onPress={() => void loadBaselines()}
                style={styles.statusButton}
              >
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.colors.tertiary },
                  ]}
                >
                  Retry
                </Text>
              </PressOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              style={styles.formScroll}
            >
              <Text
                style={[styles.explanation, { color: theme.colors.textMuted }]}
              >
                These values help CAPS interpret conditioning intensity. Maximum
                heart rate is entered by you and is not estimated from age.
              </Text>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                  Maximum heart rate
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel="Maximum heart rate in beats per minute"
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={(value) => {
                      if (/^\d*$/.test(value)) {
                        setMaximumHeartRateInput(value);
                      }
                    }}
                    placeholder="Optional"
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.tertiary}
                    style={[
                      styles.input,
                      {
                        borderColor: theme.colors.borderStrong,
                        color: theme.colors.text,
                      },
                    ]}
                    value={maximumHeartRateInput}
                  />
                  <Text style={[styles.unit, { color: theme.colors.textMuted }]}>
                    BPM
                  </Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                  Threshold pace
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel="Threshold pace in minutes and seconds per kilometer"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    onChangeText={(value) => {
                      if (/^\d{0,2}:?\d{0,2}$/.test(value)) {
                        setThresholdPaceInput(value);
                      }
                    }}
                    placeholder="m:ss"
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.tertiary}
                    style={[
                      styles.input,
                      {
                        borderColor: theme.colors.borderStrong,
                        color: theme.colors.text,
                      },
                    ]}
                    value={thresholdPaceInput}
                  />
                  <Text style={[styles.unit, { color: theme.colors.textMuted }]}>
                    / km
                  </Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                  Maximum aerobic speed
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel="Maximum aerobic speed in kilometers per hour"
                    keyboardType="decimal-pad"
                    maxLength={5}
                    onChangeText={(value) => {
                      if (/^\d*\.?\d*$/.test(value)) {
                        setMaximumAerobicSpeedInput(value);
                      }
                    }}
                    placeholder="Optional"
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.tertiary}
                    style={[
                      styles.input,
                      {
                        borderColor: theme.colors.borderStrong,
                        color: theme.colors.text,
                      },
                    ]}
                    value={maximumAerobicSpeedInput}
                  />
                  <Text style={[styles.unit, { color: theme.colors.textMuted }]}>
                    km/h
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          <View
            style={[
              styles.modalActions,
              { borderTopColor: theme.colors.border },
            ]}
          >
            <PressOpacity
              disabled={saving}
              onPress={closeModal}
              style={styles.actionButton}
            >
              <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>
                Cancel
              </Text>
            </PressOpacity>

            <PressOpacity
              disabled={loading || loadError !== null || saving}
              onPress={() => void saveBaselines()}
              style={styles.actionButton}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.tertiary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.colors.tertiary },
                  ]}
                >
                  Save
                </Text>
              )}
            </PressOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type BaselineDraft = {
  maximumHeartRateInput: string;
  thresholdPaceInput: string;
  maximumAerobicSpeedInput: string;
};

type ParsedBaselines =
  | { ok: true; baselines: AthleteConditioningBaselines }
  | { ok: false; message: string };

function parseBaselines(draft: BaselineDraft): ParsedBaselines {
  const maximumHeartRateBpm = parseOptionalNumber(
    draft.maximumHeartRateInput,
  );

  if (
    maximumHeartRateBpm !== null &&
    (!Number.isInteger(maximumHeartRateBpm) ||
      maximumHeartRateBpm < 60 ||
      maximumHeartRateBpm > 260)
  ) {
    return {
      message: "Maximum heart rate must be between 60 and 260 BPM.",
      ok: false,
    };
  }

  const thresholdPaceResult = parseThresholdPace(draft.thresholdPaceInput);

  if (!thresholdPaceResult.ok) {
    return thresholdPaceResult;
  }

  const maximumAerobicSpeedKph = parseOptionalNumber(
    draft.maximumAerobicSpeedInput,
  );

  if (
    maximumAerobicSpeedKph !== null &&
    (!Number.isFinite(maximumAerobicSpeedKph) ||
      maximumAerobicSpeedKph <= 0 ||
      maximumAerobicSpeedKph > 60)
  ) {
    return {
      message: "Maximum aerobic speed must be greater than 0 and at most 60 km/h.",
      ok: false,
    };
  }

  return {
    baselines: {
      maximumAerobicSpeedKph,
      maximumHeartRateBpm,
      thresholdPaceSecondsPerKm: thresholdPaceResult.seconds,
    },
    ok: true,
  };
}

function parseThresholdPace(
  value: string,
): { ok: true; seconds: number | null } | { ok: false; message: string } {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return { ok: true, seconds: null };
  }

  const match = /^(\d{1,2}):([0-5]\d)$/.exec(trimmedValue);

  if (!match) {
    return {
      message: "Threshold pace must use the m:ss format, such as 4:30.",
      ok: false,
    };
  }

  const seconds = Number(match[1]) * 60 + Number(match[2]);

  if (seconds < 30 || seconds > 3600) {
    return {
      message: "Threshold pace must be between 0:30 and 60:00 per kilometer.",
      ok: false,
    };
  }

  return { ok: true, seconds };
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function formatThresholdPace(secondsPerKm: number) {
  const roundedSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
    maxHeight: "84%",
    maxWidth: 420,
    padding: tokens.spacing.xl,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  statusContainer: {
    alignItems: "center",
    gap: tokens.spacing.md,
    minHeight: 220,
    justifyContent: "center",
  },
  statusButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  form: {
    gap: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  formScroll: {
    flexShrink: 1,
  },
  explanation: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  field: {
    gap: tokens.spacing.sm,
  },
  fieldLabel: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    textAlign: "center",
    width: 112,
  },
  unit: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  modalActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  actionButton: {
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
