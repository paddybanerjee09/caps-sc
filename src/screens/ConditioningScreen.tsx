import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { StyleSheet, Text, View } from "react-native";

import { ConditioningLogModal } from "../components/ConditioningLogModal";
import { ConditioningSessionDetailModal } from "../components/ConditioningSessionDetailModal";
import { CreateConditioningSessionModal } from "../components/CreateConditioningSessionModal";
import {
  getMonthTimelineDateKey,
  MonthTimeline,
  type MonthTimelineEvent,
} from "../components/MonthTimeline";
import { PressOpacity } from "../components/PressOpacity";
import { Screen } from "../components/Screen";
import {
  conditioningActivityOptions,
  conditioningAdaptations,
} from "../constants/conditioning";
import { getConditioningSessionsForRange } from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  ConditioningActivity,
  ConditioningCalendarRecord,
} from "../types/conditioning";

const tokens = themes.dark;

export function ConditioningScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [selectedDate, setSelectedDate] = useState(() => atLocalNoon(new Date()));
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    firstOfLocalMonth(new Date()),
  );
  const [sessions, setSessions] = useState<ConditioningCalendarRecord[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailTimelineEntryId, setDetailTimelineEntryId] = useState<
    number | null
  >(null);
  const calendarRequestIdRef = useRef(0);

  const { rangeStart, rangeEnd } = useMemo(
    () => getVisibleMonthBounds(displayedMonth),
    [displayedMonth],
  );

  const loadCalendar = useCallback(async () => {
    const requestId = ++calendarRequestIdRef.current;
    setCalendarLoading(true);
    setCalendarError(null);

    try {
      const nextSessions = await getConditioningSessionsForRange(
        db,
        rangeStart.getTime(),
        rangeEnd.getTime(),
      );

      if (requestId === calendarRequestIdRef.current) {
        setSessions(nextSessions);
      }
    } catch {
      if (requestId === calendarRequestIdRef.current) {
        setCalendarError("Couldn’t load conditioning sessions.");
      }
    } finally {
      if (requestId === calendarRequestIdRef.current) {
        setCalendarLoading(false);
      }
    }
  }, [db, rangeEnd, rangeStart]);

  useEffect(() => {
    void loadCalendar();

    return () => {
      calendarRequestIdRef.current += 1;
    };
  }, [loadCalendar]);

  const calendarEvents = useMemo(
    () => mapCalendarEvents(sessions, rangeStart, rangeEnd),
    [rangeEnd, rangeStart, sessions],
  );
  const selectedDateIsFuture = isFutureLocalDate(selectedDate);

  function changeDisplayedMonth(nextMonth: Date) {
    const normalizedMonth = firstOfLocalMonth(nextMonth);
    setDisplayedMonth(normalizedMonth);
    setSelectedDate((currentDate) =>
      isSameLocalMonth(currentDate, normalizedMonth)
        ? currentDate
        : atLocalNoon(normalizedMonth),
    );
  }

  return (
    <Screen centerTitle title="Conditioning">
      <View style={styles.content}>
        <MonthTimeline
          displayedMonth={displayedMonth}
          error={calendarError}
          events={calendarEvents}
          loading={calendarLoading}
          onDisplayedMonthChange={changeDisplayedMonth}
          onEventPress={(event) =>
            setDetailTimelineEntryId(event.timelineEntryId)
          }
          onRetry={() => void loadCalendar()}
          onSelectedDateChange={setSelectedDate}
          selectedDate={selectedDate}
        />

        <View style={styles.actions}>
          <PressOpacity
            accessibilityLabel={`Log conditioning session for ${formatFullDate(selectedDate)}`}
            disabled={selectedDateIsFuture}
            onPress={() => setLogModalOpen(true)}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.tertiary },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.tertiaryContent },
              ]}
            >
              Log Conditioning Session
            </Text>
          </PressOpacity>

          {selectedDateIsFuture ? (
            <Text style={[styles.futureHelp, { color: theme.colors.textMuted }]}>
              Completed sessions can only be logged for today or an earlier date.
            </Text>
          ) : null}

          <PressOpacity
            accessibilityLabel="Create conditioning session template"
            onPress={() => setCreateModalOpen(true)}
            style={[
              styles.secondaryButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.secondaryButtonText,
                { color: theme.colors.text },
              ]}
            >
              Create Conditioning Session
            </Text>
          </PressOpacity>
        </View>
      </View>

      <ConditioningLogModal
        onClose={() => setLogModalOpen(false)}
        onSaved={async () => {
          await loadCalendar();
        }}
        selectedDate={selectedDate}
        visible={logModalOpen}
      />

      <CreateConditioningSessionModal
        onClose={() => setCreateModalOpen(false)}
        visible={createModalOpen}
      />

      <ConditioningSessionDetailModal
        onClose={() => setDetailTimelineEntryId(null)}
        timelineEntryId={detailTimelineEntryId}
        visible={detailTimelineEntryId !== null}
      />
    </Screen>
  );
}

function getVisibleMonthBounds(month: Date) {
  const firstDay = new Date(
    month.getFullYear(),
    month.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
  const rangeStart = new Date(firstDay);
  rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay());

  const daysInMonth = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
    12,
  ).getDate();
  const weekCount = Math.max(
    5,
    Math.ceil((firstDay.getDay() + daysInMonth) / 7),
  );
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + weekCount * 7);

  return { rangeEnd, rangeStart };
}

function mapCalendarEvents(
  sessions: readonly ConditioningCalendarRecord[],
  rangeStart: Date,
  rangeEnd: Date,
): MonthTimelineEvent[] {
  const events: MonthTimelineEvent[] = [];

  for (const session of sessions) {
    const activity = getActivityPresentation(session.activity);
    const adaptation = conditioningAdaptations[session.primaryAdaptation];
    const firstVisibleTimestamp = Math.max(session.startAt, rangeStart.getTime());
    const lastVisibleTimestamp = Math.min(session.endAt, rangeEnd.getTime());
    const cursor = startOfLocalDay(new Date(firstVisibleTimestamp));

    while (cursor.getTime() < lastVisibleTimestamp) {
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);

      if (
        session.startAt < nextDay.getTime() &&
        session.endAt > cursor.getTime()
      ) {
        const dateKey = getMonthTimelineDateKey(cursor);

        events.push({
          accessibilityLabel: `${session.title}, ${activity.label}, ${adaptation.label}`,
          activityIcon:
            activity.icon as ComponentProps<
              typeof MaterialCommunityIcons
            >["name"],
          activityLabel: activity.label,
          adaptationLabel: adaptation.label,
          color: adaptation.color,
          contentColor: adaptation.contentColor,
          dateKey,
          endAt: session.endAt,
          id: `${session.timelineEntryId}:${dateKey}`,
          startAt: session.startAt,
          timelineEntryId: session.timelineEntryId,
          title: session.title,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return events;
}

function getActivityPresentation(activity: ConditioningActivity) {
  const presentation = conditioningActivityOptions.find(
    (option) => option.key === activity,
  );

  if (!presentation) {
    throw new Error("Conditioning activity presentation is missing.");
  }

  return presentation;
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function atLocalNoon(date: Date) {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  return result;
}

function firstOfLocalMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function isFutureLocalDate(date: Date) {
  return startOfLocalDay(date).getTime() > startOfLocalDay(new Date()).getTime();
}

function isSameLocalMonth(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth()
  );
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  content: {
    gap: tokens.spacing.lg,
  },
  actions: {
    gap: tokens.spacing.md,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.lg,
  },
  primaryButtonText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  futureHelp: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    marginTop: -tokens.spacing.sm,
    textAlign: "center",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.lg,
  },
  secondaryButtonText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
});
