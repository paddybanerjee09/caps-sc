import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { readableTextColor, themes } from "../theme/theme";
import { feedbackConfirm, feedbackToggle, feedbackWarn } from "../utils/feedback";
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

  if (!visible) {
    return null;
  }

  const primaryText = readableTextColor(theme.colors.tertiary);
  const startMinute = getMinuteOfDay(startTime);
  const endMinute = getMinuteOfDay(endTime);
  const durationMinutes =
    startMinute <= endMinute
      ? endMinute - startMinute
      : 24 * 60 - startMinute + endMinute;
  const durationHours = (durationMinutes / 60).toFixed(1);

  function closeCard() {
    setUseEveryNight(false);
    onClose();
  }

  async function saveSleep() {
    if (startMinute === endMinute) {
      feedbackWarn();
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

      feedbackConfirm();
      await onSaved?.();
      closeCard();
    } catch {
      Alert.alert("Couldn’t save sleep", "Please try again.");
    }
  }

  async function disableNightlyDefault() {
    try {
      await disableSleepScheduleFromWakeDate(db, wakeDate);
      feedbackWarn();
      await onSaved?.();
      closeCard();
    } catch {
      Alert.alert("Couldn’t disable nightly default", "Please try again.");
    }
  }

  function confirmDisableNightlyDefault() {
    feedbackWarn();
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
    <View
      style={[
        styles.inlineCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.tertiary,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View>
          <View style={styles.titleRow}>
            <Ionicons color={theme.colors.tertiary} name="moon-outline" size={18} />
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.text }]}>
              SLEEP WINDOW · {durationHours} HRS
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Night ending {formatWakeDate(wakeDate)}
          </Text>
        </View>
        <PressOpacity
          accessibilityLabel="Close sleep logger"
          onPress={closeCard}
          style={[
            styles.closeButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons color={theme.colors.text} name="close" size={18} />
        </PressOpacity>
      </View>

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
            <Text style={{ color: theme.colors.tertiary, fontWeight: "800" }}>
              Retry
            </Text>
          </PressOpacity>
        </View>
      ) : (
        <>
          <LogTimeChanger
            label="Bedtime / Lights out"
            onChange={setStartTime}
            value={startTime}
          />
          <LogTimeChanger
            label="Wake-up time"
            onChange={setEndTime}
            value={endTime}
          />

          <Pressable
            accessibilityLabel="Use this time for every night"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: useEveryNight }}
            onPress={() => {
              const next = !useEveryNight;
              feedbackToggle(next);
              setUseEveryNight(next);
            }}
            style={[
              styles.checkboxRow,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: useEveryNight
                  ? theme.colors.tertiary
                  : theme.colors.borderStrong,
              },
            ]}
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
                <Ionicons color={primaryText} name="checkmark" size={17} />
              ) : null}
            </View>
            <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>
              Use this schedule for every night
            </Text>
          </Pressable>

          {hasNightlyDefault ? (
            <PressOpacity
              accessibilityLabel="Disable nightly default"
              onPress={confirmDisableNightlyDefault}
              silent
              style={[
                styles.disableButton,
                { borderColor: theme.colors.borderStrong },
              ]}
            >
              <Text style={{ color: theme.colors.tertiary, fontWeight: "800" }}>
                Disable nightly default
              </Text>
            </PressOpacity>
          ) : null}
        </>
      )}

      <View style={styles.actions}>
        <PressOpacity
          onPress={closeCard}
          style={[
            styles.cancelButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.cancelText, { color: theme.colors.text }]}>
            Cancel
          </Text>
        </PressOpacity>
        <PressOpacity
          disabled={loading || loadError}
          onPress={() => void saveSleep()}
          silent
          style={[
            styles.saveButton,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <Ionicons color={primaryText} name="checkmark-circle" size={20} />
          <Text style={[styles.saveText, { color: primaryText }]}>
            Save Sleep ({durationHours}h)
          </Text>
        </PressOpacity>
      </View>
    </View>
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  inlineCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  cardHeaderLabel: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  subtitle: {
    fontSize: 11,
    paddingTop: 2,
  },
  closeButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  state: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 80,
  },
  checkboxRow: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  checkbox: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1.5,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: tokens.spacing.sm,
  },
  disableButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  actions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.lg,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "800",
  },
  saveButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  saveText: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
});
