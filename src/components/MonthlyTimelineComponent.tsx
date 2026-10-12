import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
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

  function showMonth(amount: number) {
    onMonthChange(shiftMonth(year, monthIndex, amount));
  }

  function showToday() {
    const parsedToday = today.split("-");
    onMonthChange({
      monthIndex: Number(parsedToday[1]) - 1,
      year: Number(parsedToday[0]),
    });
    onSelectDate(today);
  }

  return (
    <View>
      <View style={styles.header}>
        <PressOpacity
          accessibilityLabel="Previous month"
          onPress={() => showMonth(-1)}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name="chevron-back" size={22} />
        </PressOpacity>
        <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
          {monthLabel(year, monthIndex, resolvedLocale ?? "en-US")}
        </Text>
        <PressOpacity
          accessibilityLabel="Next month"
          onPress={() => showMonth(1)}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name="chevron-forward" size={22} />
        </PressOpacity>
      </View>
      <PressOpacity
        accessibilityLabel="Show today"
        onPress={showToday}
        style={styles.todayButton}
      >
        <Text style={[styles.todayText, { color: theme.colors.tertiary }]}>Today</Text>
      </PressOpacity>
      <View style={styles.weekdays}>
        {grid.weekdayLabels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[styles.weekday, { color: theme.colors.textMuted }]}
          >
            {label}
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
              onPress={() => onSelectDate(cell.isoDate)}
              style={[
                styles.day,
                cell.isSelected && {
                  borderColor: theme.colors.text,
                  borderWidth: 1,
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
                      ? theme.colors.background
                      : cell.inMonth
                        ? theme.colors.text
                        : theme.colors.textMuted,
                    fontSize: 13,
                    fontWeight: cell.inMonth ? "700" : "500",
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
      <View style={styles.eventList}>
        {selectedEvents.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
            {emptyLabel}
          </Text>
        ) : (
          selectedEvents.map((event) => (
            <PressOpacity
              accessibilityLabel={`${event.title}, ${event.status}`}
              key={event.id}
              onPress={() => onEventPress?.(event)}
              style={[
                styles.eventRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.eventMarker,
                  event.status === "logged"
                    ? { backgroundColor: event.color }
                    : { borderColor: event.color, borderWidth: 1.5 },
                ]}
              />
              <View style={styles.eventCopy}>
                <Text style={[styles.eventTitle, { color: theme.colors.text }]}>
                  {event.title}
                </Text>
                <Text style={[styles.eventStatus, { color: theme.colors.textMuted }]}>
                  {event.status === "logged" ? "Logged" : event.status === "planned" ? "Planned" : event.status}
                </Text>
              </View>
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  monthLabel: {
    flex: 1,
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
  todayButton: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  todayText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
  },
  weekdays: {
    flexDirection: "row",
  },
  weekday: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  day: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    minHeight: 48,
    paddingVertical: 2,
    width: `${100 / 7}%`,
  },
  dayNumber: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  markers: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    minHeight: 12,
  },
  marker: {
    borderRadius: tokens.radius.pill,
    height: 7,
    width: 7,
  },
  overflow: {
    fontSize: 9,
    fontWeight: "700",
  },
  eventList: {
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.md,
  },
  empty: {
    fontSize: tokens.typography.body.fontSize,
  },
  eventRow: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 44,
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
  },
  eventTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  eventStatus: {
    fontSize: tokens.typography.label.fontSize,
    textTransform: "capitalize",
  },
});
