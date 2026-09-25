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
import { StyleSheet, View } from "react-native";

import { ConditioningLogModal } from "../components/ConditioningLogModal";
import { ConditioningSessionDetailModal } from "../components/ConditioningSessionDetailModal";
import {
  getMonthTimelineDateKey,
  MonthTimeline,
  type MonthTimelineEvent,
} from "../components/MonthTimeline";
import { Screen } from "../components/Screen";
import { SavedConditioningSessionsDropdown } from "../components/SavedConditioningSessionsDropdown";
import { SessionActionMenu } from "../components/SessionActionMenu";
import { StrengthMessage } from "../components/StrengthFormPrimitives";
import {
  conditioningActivityOptions,
  conditioningAdaptations,
} from "../constants/conditioning";
import { getConditioningSessionsForRange } from "../data/conditioningRepository";
import { getConditioningMonthPresentation } from "../utils/timelinePresentation";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  ConditioningActivity,
  ConditioningCalendarRecord,
  StoredConditioningSession,
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
  const [entryToEdit, setEntryToEdit] =
    useState<StoredConditioningSession | null>(null);
  const [sourceTemplate, setSourceTemplate] = useState<import("../types/conditioning").StoredConditioningTemplate | undefined>();
  const [savedSessionsOpen, setSavedSessionsOpen] = useState(false);
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

  function openCreateLog() {
    setEntryToEdit(null);
    setSourceTemplate(undefined);
    setLogModalOpen(true);
  }

  function closeLogModal() {
    setLogModalOpen(false);
    setEntryToEdit(null);
    setSourceTemplate(undefined);
  }

  function editSession(session: StoredConditioningSession) {
    setDetailTimelineEntryId(null);
    setEntryToEdit(session);
    setSourceTemplate(undefined);
    setLogModalOpen(true);
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
          <SessionActionMenu
            items={[
              {
                key: "log-conditioning",
                label: "Log Session",
                accessibilityLabel: `Log conditioning session for ${formatFullDate(selectedDate)}`,
                icon: (
                  <MaterialCommunityIcons
                    color={theme.colors.tertiaryContent}
                    name="run-fast"
                    size={28}
                  />
                ),
                primary: true,
                disabled: selectedDateIsFuture,
                onPress: openCreateLog,
              },
              {
                key: "saved-conditioning",
                label: savedSessionsOpen ? "Hide Saved Sessions" : "Saved Sessions",
                accessibilityLabel: "Toggle saved conditioning sessions",
                icon: <MaterialCommunityIcons color={theme.colors.text} name="bookmark-outline" size={28} />,
                onPress: () => setSavedSessionsOpen((open) => !open),
              },
            ]}
          />

          <SavedConditioningSessionsDropdown
            onSelect={(template) => {
              setSourceTemplate(template);
              setEntryToEdit(null);
              setSavedSessionsOpen(false);
              setLogModalOpen(true);
            }}
            visible={savedSessionsOpen}
          />

          {selectedDateIsFuture ? (
            <StrengthMessage>
              Completed sessions can only be logged for today or an earlier date.
            </StrengthMessage>
          ) : null}
        </View>
      </View>

      <ConditioningLogModal
        entryToEdit={entryToEdit ?? undefined}
        onClose={closeLogModal}
        onSaved={async () => {
          await loadCalendar();
        }}
        selectedDate={selectedDate}
        sourceTemplate={sourceTemplate}
        visible={logModalOpen}
      />

      <ConditioningSessionDetailModal
        onClose={() => setDetailTimelineEntryId(null)}
        onEdit={editSession}
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
    const adaptation = getConditioningMonthPresentation(session.primaryAdaptation);
    const adaptationLabel = conditioningAdaptations[session.primaryAdaptation]?.label ?? adaptation.label;
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
          accessibilityLabel: `${session.title}, ${activity.label}, ${adaptationLabel}`,
          activityIcon:
            activity.icon as ComponentProps<
              typeof MaterialCommunityIcons
            >["name"],
          activityLabel: activity.label,
          adaptationLabel,
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
});
