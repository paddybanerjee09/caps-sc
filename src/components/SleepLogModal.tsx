import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  addSleepLog,
  disableSleepScheduleFromWakeDate,
  getSleepScheduleForWakeDate,
  replaceSleepScheduleFromWakeDate,
} from "../data/timelineRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const DEFAULT_START_MINUTE = 22 * 60;
const DEFAULT_END_MINUTE = 6 * 60;

type SleepLogModalProps = {
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  visible: boolean;
  wakeDate: Date;
};

export function SleepLogModal({
  onClose,
  onSaved,
  visible,
  wakeDate,
}: SleepLogModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [startTime, setStartTime] = useState(() =>
    dateAtMinute(new Date(), DEFAULT_START_MINUTE),
  );
  const [endTime, setEndTime] = useState(() =>
    dateAtMinute(new Date(), DEFAULT_END_MINUTE),
  );
  const [useEveryNight, setUseEveryNight] = useState(false);
  const [hasNightlyDefault, setHasNightlyDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);

  const loadSchedule = useCallback(async () => {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setLoading(true);
    setLoadError(false);

    try {
      const schedule = await getSleepScheduleForWakeDate(db, wakeDate);

      if (requestId.current !== currentRequestId) {
        return;
      }

      const startMinute = schedule?.startMinute ?? DEFAULT_START_MINUTE;
      const endMinute = schedule?.endMinute ?? DEFAULT_END_MINUTE;
      setStartTime(dateAtMinute(wakeDate, startMinute));
      setEndTime(dateAtMinute(wakeDate, endMinute));
      setHasNightlyDefault(schedule !== null);
    } catch {
      if (requestId.current === currentRequestId) {
        setLoadError(true);
      }
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [db, wakeDate]);

  useEffect(() => {
    if (!visible) {
      requestId.current += 1;
      return;
    }

    setUseEveryNight(false);
    void loadSchedule();

    return () => {
      requestId.current += 1;
    };
  }, [loadSchedule, visible]);

  function closeModal() {
    setUseEveryNight(false);
    onClose();
  }

  async function saveSleep() {
    const startMinute = getMinuteOfDay(startTime);
    const endMinute = getMinuteOfDay(endTime);

    if (startMinute === endMinute) {
      Alert.alert("Invalid sleep time", "Start and end times must be different.");
      return;
    }

    try {
      if (useEveryNight) {
        await replaceSleepScheduleFromWakeDate(
          db,
          wakeDate,
          startMinute,
          endMinute,
        );
      } else {
        const { startAt, endAt } = getSleepBounds(
          wakeDate,
          startMinute,
          endMinute,
        );
        await addSleepLog(db, startAt, endAt);
      }

      await onSaved?.();
      closeModal();
    } catch {
      Alert.alert("Couldn’t save sleep", "Please try again.");
    }
  }

  async function disableNightlyDefault() {
    try {
      await disableSleepScheduleFromWakeDate(db, wakeDate);
      await onSaved?.();
      closeModal();
    } catch {
      Alert.alert("Couldn’t disable nightly default", "Please try again.");
    }
  }

  function confirmDisableNightlyDefault() {
    Alert.alert(
      "Disable nightly default?",
      "Earlier planned nights will remain.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            void disableNightlyDefault();
          },
          style: "destructive",
          text: "Disable",
        },
      ],
    );
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <View
        style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Sleep</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Night ending {formatWakeDate(wakeDate)}
          </Text>

          {loading ? (
            <View style={styles.state}>
              <ActivityIndicator color={theme.colors.tertiary} />
            </View>
          ) : loadError ? (
            <View style={styles.state}>
              <Text style={{ color: theme.colors.text }}>
                Couldn’t load sleep schedule
              </Text>
              <PressOpacity onPress={() => void loadSchedule()}>
                <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
              </PressOpacity>
            </View>
          ) : (
            <>
              <View style={styles.timeRow}>
                <View style={styles.timeControl}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    Start
                  </Text>
                  <LogTimeChanger
                    onChange={setStartTime}
                    value={startTime}
                  />
                </View>

                <View style={styles.timeControl}>
                  <Text style={[styles.label, { color: theme.colors.text }]}>
                    End
                  </Text>
                  <LogTimeChanger onChange={setEndTime} value={endTime} />
                </View>
              </View>

              <Pressable
                accessibilityLabel="Use this time for every night"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: useEveryNight }}
                onPress={() => setUseEveryNight((current) => !current)}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: useEveryNight
                        ? theme.colors.tertiary
                        : "transparent",
                      borderColor: useEveryNight
                        ? theme.colors.tertiary
                        : theme.colors.borderStrong,
                    },
                  ]}
                >
                  {useEveryNight ? (
                    <Ionicons
                      color={theme.colors.background}
                      name="checkmark"
                      size={17}
                    />
                  ) : null}
                </View>
                <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
                  Use this time for every night
                </Text>
              </Pressable>

              {hasNightlyDefault ? (
                <PressOpacity
                  accessibilityLabel="Disable nightly default"
                  onPress={confirmDisableNightlyDefault}
                  style={styles.disableButton}
                >
                  <Text style={{ color: theme.colors.tertiary }}>
                    Disable nightly default
                  </Text>
                </PressOpacity>
              ) : null}
            </>
          )}

          <View style={styles.actions}>
            <PressOpacity onPress={closeModal}>
              <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
            </PressOpacity>
            <PressOpacity
              disabled={loading || loadError}
              onPress={() => void saveSleep()}
            >
              <Text
                style={{
                  color:
                    loading || loadError
                      ? theme.colors.textMuted
                      : theme.colors.tertiary,
                }}
              >
                Save
              </Text>
            </PressOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function dateAtMinute(date: Date, minute: number) {
  const result = new Date(date);
  result.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return result;
}

function getSleepBounds(
  wakeDate: Date,
  startMinute: number,
  endMinute: number,
) {
  const endDate = dateAtMinute(wakeDate, endMinute);
  const startDate = dateAtMinute(wakeDate, startMinute);

  if (startMinute > endMinute) {
    startDate.setDate(startDate.getDate() - 1);
  }

  return {
    startAt: startDate.getTime(),
    endAt: endDate.getTime(),
  };
}

function formatWakeDate(date: Date) {
  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.xl,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    maxWidth: 280,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.typography.label.fontSize,
    paddingTop: tokens.spacing.xs,
    textAlign: "center",
  },
  state: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 120,
  },
  timeRow: {
    flexDirection: "row",
    gap: tokens.spacing.md,
    paddingTop: tokens.spacing.lg,
  },
  timeControl: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
  },
  checkboxRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingTop: tokens.spacing.md,
  },
  checkbox: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    marginLeft: tokens.spacing.sm,
  },
  disableButton: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.xl,
    justifyContent: "flex-end",
    paddingTop: tokens.spacing.md,
  },
});
