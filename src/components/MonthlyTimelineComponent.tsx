import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackStep } from "../utils/feedback";
import {
  buildMonthGrid,
  eventsOnDate,
  monthLabel,
  shiftMonth,
  type MonthEvent,
} from "./monthGrid";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type MonthlyTimelineComponentProps = {
  emptyLabel?: string;
  events: MonthEvent[];
  locale?: string;
  monthIndex: number;
  onEventPress?: (event: MonthEvent) => void;
  onMonthChange: (month: { monthIndex: number; year: number }) => void;
  onSelectDate: (isoDate: string) => void;
  selectedDate: string;
  today: string;
  weekStartsOn?: number;
  year: number;
};

export function MonthlyTimelineComponent({
  emptyLabel = "Nothing on this date",
  events,
  locale,
  monthIndex,
  onEventPress,
  onMonthChange,
  onSelectDate,
  selectedDate,
  today,
  weekStartsOn = 1,
  year,
}: MonthlyTimelineComponentProps) {
  const { theme } = useAppTheme();
  const grid = buildMonthGrid({
    events,
    locale,
    monthIndex,
    selectedDate,
    today,
    weekStartsOn,
    year,
  });
  const selectedEvents = eventsOnDate(grid, selectedDate);
  const resolvedLocale = locale ?? undefined;
  const todayTextColor = readableTextColor(theme.colors.tertiary);

  function showMonth(amount: number) {
    feedbackStep(amount > 0 ? "up" : "down");
    onMonthChange(shiftMonth(year, monthIndex, amount));
  }

  function showToday() {
    feedbackStep("up");
    const parsedToday = today.split("-");
    onMonthChange({
      monthIndex: Number(parsedToday[1]) - 1,
      year: Number(parsedToday[0]),
    });
    onSelectDate(today);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressOpacity
          accessibilityLabel="Previous month"
          onPress={() => showMonth(-1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Ionicons color={theme.colors.text} name="chevron-back" size={20} />
        </PressOpacity>

        <View style={styles.monthTitleWrap}>
          <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
            {monthLabel(year, monthIndex, resolvedLocale ?? "en-US")}
          </Text>
          <PressOpacity
            accessibilityLabel="Show today"
            onPress={showToday}
            silent
            style={[
              styles.todayPill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.todayText, { color: theme.colors.tertiary }]}>
              TODAY
            </Text>
          </PressOpacity>
        </View>

        <PressOpacity
          accessibilityLabel="Next month"
          onPress={() => showMonth(1)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Ionicons color={theme.colors.text} name="chevron-forward" size={20} />
        </PressOpacity>
      </View>

      <View
        style={[
          styles.calendarWell,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={[styles.weekdays, { borderBottomColor: theme.colors.border }]}>
          {grid.weekdayLabels.map((label, index) => (
            <Text
              key={`${label}-${index}`}
              style={[styles.weekday, { color: theme.colors.textMuted }]}
            >
              {label.toUpperCase()}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.cells.map((cell) => {
            const statusSummary = summarizeStatuses(cell.events);
            return (
              <PressOpacity
                accessibilityLabel={`${cell.isoDate}${cell.isToday ? ", today" : ""}${
                  cell.isSelected ? ", selected" : ""
                }${statusSummary ? `, ${statusSummary}` : ""}`}
                accessibilityState={{ selected: cell.isSelected }}
                key={cell.isoDate}
                onPress={() => {
                  feedbackStep("up");
                  onSelectDate(cell.isoDate);
                }}
                silent
                style={[
                  styles.day,
                  cell.isSelected && {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.text,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dayNumber,
                    cell.isToday && { backgroundColor: theme.colors.tertiary },
                  ]}
                >
                  <Text
                    style={{
                      color: cell.isToday
                        ? todayTextColor
                        : cell.inMonth
                          ? theme.colors.text
                          : theme.colors.textMuted,
                      fontSize: 13,
                      fontVariant: ["tabular-nums"],
                      fontWeight: cell.inMonth || cell.isToday ? "800" : "500",
                    }}
                  >
                    {cell.dayNumber}
                  </Text>
                </View>
                <View style={styles.markers}>
                  {cell.markers.map((event) => (
                    <View
                      key={event.id}
                      style={[
                        styles.marker,
                        event.status === "logged"
                          ? { backgroundColor: event.color }
                          : { borderColor: event.color, borderWidth: 1.5 },
                      ]}
                    />
                  ))}
                  {cell.overflow > 0 ? (
                    <Text style={[styles.overflow, { color: theme.colors.textMuted }]}>
                      +{cell.overflow}
                    </Text>
                  ) : null}
                </View>
              </PressOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.eventList}>
        <View style={styles.selectedDateBar}>
          <Text style={[styles.selectedDateHeader, { color: theme.colors.textMuted }]}>
            SELECTED DATE: {selectedDate}
          </Text>
          <Text style={[styles.selectedDateCount, { color: theme.colors.text }]}>
            {selectedEvents.length}{" "}
            {selectedEvents.length === 1 ? "SESSION" : "SESSIONS"}
          </Text>
        </View>

        {selectedEvents.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
              {emptyLabel}
            </Text>
          </View>
        ) : (
          selectedEvents.map((event) => (
            <PressOpacity
              accessibilityLabel={`${event.title}, ${event.status}`}
              key={event.id}
              onPress={() => onEventPress?.(event)}
              style={[
                styles.eventRow,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View
                style={[
                  styles.eventMarker,
                  event.status === "logged"
                    ? { backgroundColor: event.color }
                    : { borderColor: event.color, borderWidth: 2 },
                ]}
              />
              <View style={styles.eventCopy}>
                <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                  {event.title}
                </Text>
                <Text style={[styles.eventStatus, { color: theme.colors.textMuted }]}>
                  {event.status === "logged"
                    ? "Logged"
                    : event.status === "planned"
                      ? "Planned"
                      : event.status}
                </Text>
              </View>
              <Ionicons
                color={theme.colors.textMuted}
                name="chevron-forward"
                size={18}
              />
            </PressOpacity>
          ))
        )}
      </View>
    </View>
  );
}

function summarizeStatuses(events: MonthEvent[]) {
  if (events.length === 0) {
    return "";
  }

  const planned = events.filter((event) => event.status === "planned").length;
  const logged = events.filter((event) => event.status === "logged").length;
  const other = events.length - planned - logged;
  return [
    planned ? `${planned} planned` : "",
    logged ? `${logged} logged` : "",
    other ? `${other} other` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  stepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  monthTitleWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  todayPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: tokens.spacing.sm,
  },
  todayText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  calendarWell: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    padding: tokens.spacing.xs,
  },
  weekdays: {
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingBottom: 6,
    paddingTop: 4,
  },
  weekday: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: 4,
  },
  day: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    justifyContent: "center",
    minHeight: 50,
    paddingVertical: 4,
    width: `${100 / 7}%`,
  },
  dayNumber: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  markers: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    minHeight: 12,
  },
  marker: {
    borderRadius: tokens.radius.pill,
    height: 7,
    width: 7,
  },
  overflow: {
    fontSize: 9,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  eventList: {
    gap: tokens.spacing.sm,
  },
  selectedDateBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  selectedDateHeader: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  selectedDateCount: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  empty: {
    fontSize: 13,
    fontWeight: "600",
  },
  eventRow: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 54,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  eventMarker: {
    borderRadius: tokens.radius.pill,
    height: 12,
    width: 12,
  },
  eventCopy: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "800",
  },
  eventStatus: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
