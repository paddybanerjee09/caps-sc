import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

const DAYS_PER_WEEK = 7;
const MINIMUM_WEEK_COUNT = 5;
const MAX_VISIBLE_EVENT_DOTS = 3;
const DAY_CELL_MIN_HEIGHT = 58;
const MINIMUM_TOUCH_SIZE = 44;

const weekdayLabels = Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
  const sunday = new Date(2026, 0, 4, 12);

  sunday.setDate(sunday.getDate() + index);

  return sunday.toLocaleDateString([], { weekday: "short" });
});

export type MonthTimelineEvent = {
  accessibilityLabel: string;
  activityIcon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  activityLabel: string;
  adaptationLabel: string;
  color: string;
  contentColor: string;
  dateKey: string;
  endAt: number;
  id: string;
  startAt: number;
  timelineEntryId: number;
  title: string;
};

export type MonthTimelineProps = {
  displayedMonth: Date;
  error: string | null;
  events: readonly MonthTimelineEvent[];
  loading: boolean;
  onDisplayedMonthChange: (monthStart: Date) => void;
  onEventPress: (event: MonthTimelineEvent) => void;
  onRetry: () => void;
  onSelectedDateChange: (date: Date) => void;
  selectedDate: Date;
};

export function MonthTimeline({
  displayedMonth,
  error,
  events,
  loading,
  onDisplayedMonthChange,
  onEventPress,
  onRetry,
  onSelectedDateChange,
  selectedDate,
}: MonthTimelineProps) {
  const { theme } = useAppTheme();
  const monthStart = createLocalNoon(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth(),
    1,
  );
  const selectedDateAtNoon = createLocalNoon(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  const selectedDateKey = getMonthTimelineDateKey(selectedDateAtNoon);
  const today = new Date();
  const todayKey = getMonthTimelineDateKey(today);

  const calendarDates = createCalendarDates(monthStart);
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = useMemo(
    () =>
      [...(eventsByDate.get(selectedDateKey) ?? [])].sort(
        (firstEvent, secondEvent) =>
          firstEvent.startAt - secondEvent.startAt ||
          firstEvent.timelineEntryId - secondEvent.timelineEntryId,
      ),
    [eventsByDate, selectedDateKey],
  );

  function changeMonth(offset: number) {
    const nextMonth = createLocalNoon(
      monthStart.getFullYear(),
      monthStart.getMonth() + offset,
      1,
    );

    onDisplayedMonthChange(nextMonth);
  }

  function selectDate(date: Date) {
    const selectedDateCopy = createLocalNoon(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    onSelectedDateChange(selectedDateCopy);

    if (!isSameLocalMonth(selectedDateCopy, monthStart)) {
      onDisplayedMonthChange(
        createLocalNoon(
          selectedDateCopy.getFullYear(),
          selectedDateCopy.getMonth(),
          1,
        ),
      );
    }
  }

  const previousMonth = createLocalNoon(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1,
  );
  const nextMonth = createLocalNoon(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.monthHeader}>
        <PressOpacity
          accessibilityLabel={`Show ${formatMonth(previousMonth)}`}
          onPress={() => changeMonth(-1)}
          style={styles.monthButton}
        >
          <Ionicons
            accessible={false}
            color={theme.colors.text}
            name="chevron-back"
            size={22}
          />
        </PressOpacity>

        <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
          {formatMonth(monthStart)}
        </Text>

        <PressOpacity
          accessibilityLabel={`Show ${formatMonth(nextMonth)}`}
          onPress={() => changeMonth(1)}
          style={styles.monthButton}
        >
          <Ionicons
            accessible={false}
            color={theme.colors.text}
            name="chevron-forward"
            size={22}
          />
        </PressOpacity>
      </View>

      <View
        accessible={false}
        style={[
          styles.weekdayRow,
          { borderColor: theme.colors.border },
        ]}
      >
        {weekdayLabels.map((weekday, index) => (
          <Text
            key={`${weekday}-${index}`}
            style={[styles.weekdayLabel, { color: theme.colors.textMuted }]}
          >
            {weekday}
          </Text>
        ))}
      </View>

      {loading ? (
        <View
          accessibilityLabel="Loading conditioning calendar"
          accessibilityLiveRegion="polite"
          style={styles.calendarState}
        >
          <ActivityIndicator color={theme.colors.tertiary} />
        </View>
      ) : error !== null ? (
        <View accessibilityLiveRegion="polite" style={styles.calendarState}>
          <Text style={[styles.stateText, { color: theme.colors.text }]}>
            {error}
          </Text>

          <PressOpacity
            accessibilityLabel="Retry loading conditioning calendar"
            onPress={onRetry}
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.retryText, { color: theme.colors.text }]}>
              Retry
            </Text>
          </PressOpacity>
        </View>
      ) : (
        <>
          <View style={styles.calendarGrid}>
            {calendarDates.map((date, index) => {
              const dateKey = getMonthTimelineDateKey(date);
              const dateEvents = eventsByDate.get(dateKey) ?? [];
              const selected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;
              const outsideMonth = !isSameLocalMonth(date, monthStart);
              const remainingEventCount = Math.max(
                0,
                dateEvents.length - MAX_VISIBLE_EVENT_DOTS,
              );
              const lastColumn = (index + 1) % DAYS_PER_WEEK === 0;
              const lastRow =
                index >= calendarDates.length - DAYS_PER_WEEK;

              return (
                <Pressable
                  accessibilityLabel={formatDateAccessibilityLabel(
                    date,
                    selected,
                    isToday,
                    dateEvents.length,
                  )}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={dateKey}
                  onPress={() => selectDate(date)}
                  style={({ pressed }) => [
                    styles.dayCell,
                    {
                      backgroundColor: selected
                        ? theme.colors.surfaceMuted
                        : theme.colors.surface,
                      borderBottomColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.border,
                      borderBottomWidth: selected
                        ? 2
                        : lastRow
                          ? 0
                          : StyleSheet.hairlineWidth,
                      borderLeftColor: theme.colors.tertiary,
                      borderLeftWidth: selected ? 2 : 0,
                      borderRightColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.border,
                      borderRightWidth: selected
                        ? 2
                        : lastColumn
                          ? 0
                          : StyleSheet.hairlineWidth,
                      borderTopColor: theme.colors.tertiary,
                      borderTopWidth: selected ? 2 : 0,
                      opacity: pressed
                        ? tokens.opacity.pressed
                        : outsideMonth
                          ? tokens.opacity.subdued
                          : 1,
                    },
                  ]}
                >
                  <View
                    accessible={false}
                    style={[
                      styles.dayNumberContainer,
                      isToday && {
                        borderColor: theme.colors.tertiary,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      accessible={false}
                      style={[
                        styles.dayNumber,
                        {
                          color: outsideMonth
                            ? theme.colors.textMuted
                            : selected || isToday
                              ? theme.colors.tertiary
                              : theme.colors.text,
                        },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>

                  <View accessible={false} style={styles.eventDots}>
                    {dateEvents
                      .slice(0, MAX_VISIBLE_EVENT_DOTS)
                      .map((event) => (
                        <View
                          key={event.id}
                          style={[
                            styles.eventDot,
                            { backgroundColor: event.color },
                          ]}
                        />
                      ))}

                    {remainingEventCount > 0 ? (
                      <Text
                        style={[
                          styles.moreEventsLabel,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        +{remainingEventCount}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.selectedDaySection,
              { borderColor: theme.colors.border },
            ]}
          >
            <Text
              style={[styles.selectedDayLabel, { color: theme.colors.text }]}
            >
              {formatFullDate(selectedDateAtNoon)}
            </Text>

            {selectedEvents.length === 0 ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.emptyText, { color: theme.colors.textMuted }]}
              >
                No conditioning sessions on this date
              </Text>
            ) : (
              <View style={styles.eventList}>
                {selectedEvents.map((event) => (
                  <PressOpacity
                    accessibilityLabel={`Open ${event.accessibilityLabel}`}
                    key={event.id}
                    onPress={() => onEventPress(event)}
                    style={[
                      styles.eventRow,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      accessible={false}
                      style={[
                        styles.activityIcon,
                        { backgroundColor: event.color },
                      ]}
                    >
                      <MaterialCommunityIcons
                        color={event.contentColor}
                        name={event.activityIcon}
                        size={18}
                      />
                    </View>

                    <View accessible={false} style={styles.eventTextColumn}>
                      <Text
                        numberOfLines={1}
                        style={[styles.eventTitle, { color: theme.colors.text }]}
                      >
                        {event.title}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.eventDetails,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {formatEventTime(event, selectedDateAtNoon)} /{" "}
                        {event.activityLabel}
                      </Text>
                    </View>

                    <Text
                      accessible={false}
                      numberOfLines={2}
                      style={[
                        styles.adaptationLabel,
                        { color: event.color },
                      ]}
                    >
                      {event.adaptationLabel}
                    </Text>

                    <Ionicons
                      accessible={false}
                      color={theme.colors.textMuted}
                      name="chevron-forward"
                      size={16}
                    />
                  </PressOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

export function getMonthTimelineDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createCalendarDates(monthStart: Date) {
  const firstDay = createLocalNoon(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1,
  );
  const gridStart = new Date(firstDay);

  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const daysInMonth = createLocalNoon(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
  ).getDate();
  const requiredCellCount = firstDay.getDay() + daysInMonth;
  const weekCount = Math.max(
    MINIMUM_WEEK_COUNT,
    Math.ceil(requiredCellCount / DAYS_PER_WEEK),
  );

  return Array.from({ length: weekCount * DAYS_PER_WEEK }, (_, index) => {
    const date = new Date(gridStart);

    date.setDate(date.getDate() + index);

    return date;
  });
}

function groupEventsByDate(events: readonly MonthTimelineEvent[]) {
  const eventsByDate = new Map<string, MonthTimelineEvent[]>();

  for (const event of events) {
    const dateEvents = eventsByDate.get(event.dateKey);

    if (dateEvents) {
      dateEvents.push(event);
    } else {
      eventsByDate.set(event.dateKey, [event]);
    }
  }

  for (const dateEvents of eventsByDate.values()) {
    dateEvents.sort(
      (firstEvent, secondEvent) =>
        firstEvent.startAt - secondEvent.startAt ||
        firstEvent.timelineEntryId - secondEvent.timelineEntryId,
    );
  }

  return eventsByDate;
}

function createLocalNoon(year: number, month: number, date: number) {
  return new Date(year, month, date, 12, 0, 0, 0);
}

function formatMonth(date: Date) {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

function formatDateAccessibilityLabel(
  date: Date,
  selected: boolean,
  today: boolean,
  eventCount: number,
) {
  const parts = [formatFullDate(date)];

  if (today) {
    parts.push("Today");
  }

  if (selected) {
    parts.push("Selected");
  }

  parts.push(
    eventCount === 1
      ? "1 conditioning session"
      : `${eventCount} conditioning sessions`,
  );

  return parts.join(", ");
}

function formatEventTime(event: MonthTimelineEvent, selectedDate: Date) {
  const dayStart = new Date(selectedDate);
  const dayEnd = new Date(selectedDate);

  dayStart.setHours(0, 0, 0, 0);
  dayEnd.setDate(dayEnd.getDate() + 1);
  dayEnd.setHours(0, 0, 0, 0);

  if (event.startAt < dayStart.getTime() && event.endAt > dayEnd.getTime()) {
    return "All day";
  }

  if (event.startAt < dayStart.getTime()) {
    return `Until ${formatTime(event.endAt)}`;
  }

  if (event.endAt > dayEnd.getTime()) {
    return `${formatTime(event.startAt)} onward`;
  }

  return `${formatTime(event.startAt)} - ${formatTime(event.endAt)}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameLocalMonth(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth()
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  monthButton: {
    alignItems: "center",
    height: MINIMUM_TOUCH_SIZE,
    justifyContent: "center",
    width: MINIMUM_TOUCH_SIZE,
  },
  monthLabel: {
    flex: 1,
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
    textAlign: "center",
  },
  weekdayRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    paddingVertical: tokens.spacing.xs,
  },
  weekdayLabel: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
    width: `${100 / DAYS_PER_WEEK}%`,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: DAY_CELL_MIN_HEIGHT,
    paddingBottom: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs,
    width: `${100 / DAYS_PER_WEEK}%`,
  },
  dayNumberContainer: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  dayNumber: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 15,
    textAlign: "center",
  },
  eventDots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    height: 18,
    justifyContent: "center",
    marginTop: 2,
    maxWidth: "100%",
    paddingHorizontal: 2,
  },
  eventDot: {
    borderRadius: tokens.radius.pill,
    height: 5,
    width: 5,
  },
  moreEventsLabel: {
    fontSize: 8,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 10,
  },
  calendarState: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: DAY_CELL_MIN_HEIGHT * MINIMUM_WEEK_COUNT,
    padding: tokens.spacing.lg,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: MINIMUM_TOUCH_SIZE,
    minWidth: 84,
    paddingHorizontal: tokens.spacing.md,
  },
  retryText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  selectedDaySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  selectedDayLabel: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  emptyText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: tokens.typography.body.fontWeight,
    lineHeight: tokens.typography.body.lineHeight,
    minHeight: MINIMUM_TOUCH_SIZE,
    paddingVertical: tokens.spacing.md,
    textAlign: "center",
  },
  eventList: {
    gap: tokens.spacing.sm,
  },
  eventRow: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: MINIMUM_TOUCH_SIZE,
    padding: tokens.spacing.sm,
  },
  activityIcon: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  eventTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  eventDetails: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  adaptationLabel: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    maxWidth: 88,
    textAlign: "right",
  },
});
