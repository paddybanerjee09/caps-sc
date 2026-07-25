import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { timelineCategories } from "../constants/timelineCategories";
import type { TimelineEntry } from "../data/timelineRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

const TOTAL_HOURS = 24;
const VISIBLE_HOURS = 12;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = TOTAL_HOURS * MINUTES_PER_HOUR;
const INSTANT_DISPLAY_MINUTES = 15;
const MIN_EVENT_WIDTH = 72;
const EVENT_HEIGHT = 44;
const EVENT_FOOTPRINT_HEIGHT = 4;
const EVENT_TRACK_GAP = 4;
const EVENT_HORIZONTAL_GAP = 4;
const HOUR_HEADER_HEIGHT = 28;
const LANE_VERTICAL_PADDING = 8;

const hourDivisions = Array.from(
  { length: TOTAL_HOURS + 1 },
  (_, hour) => hour,
);
const labeledHours = Array.from(
  { length: TOTAL_HOURS / 2 },
  (_, index) => index * 2,
);

type DayTimelineProps = {
  dayStart: Date;
  dayEnd: Date;
  entries: TimelineEntry[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

type TimelineLayoutEvent = {
  accessibilityLabel: string;
  badgeLeft: number;
  badgeWidth: number;
  entry: TimelineEntry;
  track: number;
  trueLeft: number;
  trueWidth: number;
};

export function DayTimeline({
  dayStart,
  dayEnd,
  entries,
  loading,
  error,
  onRetry,
}: DayTimelineProps) {
  const { theme } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const initializedScrollKeyRef = useRef<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const dayStartTimestamp = dayStart.getTime();
  const dayEndTimestamp = dayEnd.getTime();
  const hourWidth = viewportWidth / VISIBLE_HOURS;
  const timelineWidth = hourWidth * TOTAL_HOURS;

  const { layoutEvents, trackCount } = useMemo(
    () =>
      createTimelineLayout(
        entries,
        dayStartTimestamp,
        dayEndTimestamp,
        hourWidth,
        timelineWidth,
      ),
    [
      dayEndTimestamp,
      dayStartTimestamp,
      entries,
      hourWidth,
      timelineWidth,
    ],
  );

  const eventTrackHeight =
    EVENT_HEIGHT + EVENT_FOOTPRINT_HEIGHT + EVENT_TRACK_GAP;
  const laneHeight =
    LANE_VERTICAL_PADDING * 2 +
    Math.max(1, trackCount) * eventTrackHeight -
    EVENT_TRACK_GAP;
  const timelineHeight = HOUR_HEADER_HEIGHT + laneHeight;

  useEffect(() => {
    if (viewportWidth <= 0 || timelineWidth <= viewportWidth) {
      return;
    }

    const scrollKey = `${dayStartTimestamp}:${Math.round(viewportWidth)}`;

    if (initializedScrollKeyRef.current === scrollKey) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      const maximumOffset = Math.max(0, timelineWidth - viewportWidth);
      const selectedDay = new Date(dayStartTimestamp);
      const now = new Date();
      let initialOffset = 0;

      if (isSameLocalDay(selectedDay, now)) {
        const currentWallMinutes =
          now.getHours() * MINUTES_PER_HOUR + now.getMinutes();
        const currentHourStart =
          Math.floor(currentWallMinutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
        const rawOffset =
          ((currentHourStart - MINUTES_PER_HOUR) / MINUTES_PER_HOUR) *
          hourWidth;

        initialOffset = clamp(rawOffset, 0, maximumOffset);
      }

      scrollViewRef.current?.scrollTo({
        animated: false,
        x: initialOffset,
        y: 0,
      });
      initializedScrollKeyRef.current = scrollKey;
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [dayStartTimestamp, hourWidth, timelineWidth, viewportWidth]);

  function handleLayout(event: LayoutChangeEvent) {
    const measuredWidth = event.nativeEvent.layout.width;

    setViewportWidth((currentWidth) =>
      Math.abs(currentWidth - measuredWidth) < 0.5
        ? currentWidth
        : measuredWidth,
    );
  }

  const showEvents = !loading && error === null;

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <ScrollView
        bounces={false}
        directionalLockEnabled
        horizontal
        nestedScrollEnabled
        onLayout={handleLayout}
        overScrollMode="never"
        ref={scrollViewRef}
        showsHorizontalScrollIndicator={false}
        style={{ height: timelineHeight }}
      >
        <View
          style={[
            styles.timelineContent,
            {
              backgroundColor: theme.colors.surface,
              height: timelineHeight,
              width: timelineWidth,
            },
          ]}
        >
          <View
            accessible={false}
            style={[
              styles.eventLaneBackground,
              {
                backgroundColor: theme.colors.surfaceMuted,
                height: laneHeight,
                top: HOUR_HEADER_HEIGHT,
              },
            ]}
          />

          <View
            accessible={false}
            style={[
              styles.headerRule,
              {
                backgroundColor: theme.colors.borderStrong,
                top: HOUR_HEADER_HEIGHT,
              },
            ]}
          />

          {hourDivisions.map((hour) => (
            <View
              accessible={false}
              key={`division-${hour}`}
              style={[
                styles.hourDivision,
                {
                  backgroundColor: theme.colors.border,
                  height: timelineHeight,
                  left: Math.min(hour * hourWidth, timelineWidth - 1),
                },
              ]}
            />
          ))}

          {labeledHours.map((hour) => (
            <Text
              accessible={false}
              key={`label-${hour}`}
              style={[
                styles.hourLabel,
                {
                  color: theme.colors.textMuted,
                  left: hour * hourWidth + tokens.spacing.xs,
                },
              ]}
            >
              {formatHour(hour)}
            </Text>
          ))}

          {showEvents &&
            layoutEvents.map((layoutEvent) => (
              <TimelineEventBar
                event={layoutEvent}
                key={layoutEvent.entry.id}
              />
            ))}
        </View>
      </ScrollView>

      {loading ? (
        <View
          accessibilityLabel="Loading timeline"
          accessibilityLiveRegion="polite"
          style={[
            styles.stateOverlay,
            { height: laneHeight, top: HOUR_HEADER_HEIGHT },
          ]}
        >
          <ActivityIndicator color={theme.colors.tertiary} />
        </View>
      ) : error !== null ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.stateOverlay,
            { height: laneHeight, top: HOUR_HEADER_HEIGHT },
          ]}
        >
          <Text style={[styles.stateText, { color: theme.colors.text }]}>
            {error}
          </Text>

          <PressOpacity
            accessibilityLabel="Retry loading timeline"
            onPress={onRetry}
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.retryText, { color: theme.colors.text }]}>
              Retry
            </Text>
          </PressOpacity>
        </View>
      ) : layoutEvents.length === 0 ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={[
            styles.stateOverlay,
            { height: laneHeight, top: HOUR_HEADER_HEIGHT },
          ]}
        >
          <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
            No entries for this date
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TimelineEventBar({ event }: { event: TimelineLayoutEvent }) {
  const category = timelineCategories[event.entry.kind];
  const top =
    HOUR_HEADER_HEIGHT +
    LANE_VERTICAL_PADDING +
    event.track *
      (EVENT_HEIGHT + EVENT_FOOTPRINT_HEIGHT + EVENT_TRACK_GAP);

  return (
    <>
      <View
        accessible={false}
        style={[
          styles.eventFootprint,
          {
            backgroundColor: category.color,
            left: event.trueLeft,
            top: top + EVENT_HEIGHT,
            width: event.trueWidth,
          },
        ]}
      />

      <View
        accessibilityLabel={event.accessibilityLabel}
        accessible
        style={[
          styles.eventBadge,
          {
            backgroundColor: category.color,
            left: event.badgeLeft,
            top,
            width: event.badgeWidth,
          },
        ]}
      >
        {category.iconSet === "materialCommunity" ? (
          <MaterialCommunityIcons
            color={category.contentColor}
            name={
              category.icon as ComponentProps<
                typeof MaterialCommunityIcons
              >["name"]
            }
            size={15}
          />
        ) : (
          <Ionicons
            color={category.contentColor}
            name={category.icon as ComponentProps<typeof Ionicons>["name"]}
            size={15}
          />
        )}

        <Text
          numberOfLines={2}
          style={[styles.eventLabel, { color: category.contentColor }]}
        >
          {category.label}
        </Text>
      </View>

      <View
        accessible={false}
        style={[
          styles.eventStartPin,
          {
            backgroundColor: category.contentColor,
            left: event.trueLeft,
            top,
          },
        ]}
      />
    </>
  );
}

function createTimelineLayout(
  entries: TimelineEntry[],
  dayStart: number,
  dayEnd: number,
  hourWidth: number,
  timelineWidth: number,
) {
  if (
    timelineWidth <= 0 ||
    !Number.isFinite(dayStart) ||
    !Number.isFinite(dayEnd) ||
    dayEnd <= dayStart
  ) {
    return {
      layoutEvents: [] as TimelineLayoutEvent[],
      trackCount: 0,
    };
  }

  const layoutEvents = entries
    .map((entry) =>
      createLayoutEvent(entry, dayStart, dayEnd, hourWidth, timelineWidth),
    )
    .filter((event): event is TimelineLayoutEvent => event !== null)
    .sort(
      (firstEvent, secondEvent) =>
        firstEvent.badgeLeft - secondEvent.badgeLeft ||
        firstEvent.entry.id - secondEvent.entry.id,
    );

  const trackEnds: number[] = [];

  for (const event of layoutEvents) {
    let track = trackEnds.findIndex(
      (trackEnd) => trackEnd + EVENT_HORIZONTAL_GAP <= event.badgeLeft,
    );

    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(0);
    }

    event.track = track;
    trackEnds[track] = event.badgeLeft + event.badgeWidth;
  }

  return {
    layoutEvents,
    trackCount: trackEnds.length,
  };
}

function createLayoutEvent(
  entry: TimelineEntry,
  dayStart: number,
  dayEnd: number,
  hourWidth: number,
  timelineWidth: number,
): TimelineLayoutEvent | null {
  const displayEnd =
    entry.endAt ??
    entry.startAt + INSTANT_DISPLAY_MINUTES * MINUTES_PER_HOUR * 1000;
  const visibleStart = Math.max(entry.startAt, dayStart);
  const visibleEnd = Math.min(displayEnd, dayEnd);

  if (
    !Number.isFinite(visibleStart) ||
    !Number.isFinite(visibleEnd) ||
    visibleEnd <= visibleStart
  ) {
    return null;
  }

  const startWallMinutes = getWallMinutes(visibleStart, dayStart, dayEnd);
  const endWallMinutes = getWallMinutes(visibleEnd, dayStart, dayEnd);
  const rawLeft = (startWallMinutes / MINUTES_PER_HOUR) * hourWidth;
  const rawRight = (endWallMinutes / MINUTES_PER_HOUR) * hourWidth;
  const trueLeft = clamp(rawLeft, 0, Math.max(0, timelineWidth - 1));
  const trueWidth = Math.max(
    1,
    Math.min(timelineWidth - trueLeft, rawRight - rawLeft),
  );
  const badgeWidth = Math.min(
    timelineWidth,
    Math.max(trueWidth, MIN_EVENT_WIDTH),
  );
  const badgeLeft = clamp(trueLeft, 0, timelineWidth - badgeWidth);

  return {
    accessibilityLabel: formatAccessibilityLabel(entry),
    badgeLeft,
    badgeWidth,
    entry,
    track: 0,
    trueLeft,
    trueWidth,
  };
}

function getWallMinutes(timestamp: number, dayStart: number, dayEnd: number) {
  if (timestamp <= dayStart) {
    return 0;
  }

  if (timestamp >= dayEnd) {
    return MINUTES_PER_DAY;
  }

  const date = new Date(timestamp);

  return (
    date.getHours() * MINUTES_PER_HOUR +
    date.getMinutes() +
    date.getSeconds() / MINUTES_PER_HOUR +
    date.getMilliseconds() / (MINUTES_PER_HOUR * 1000)
  );
}

function formatAccessibilityLabel(entry: TimelineEntry) {
  const category = timelineCategories[entry.kind];
  const startTime = formatTime(entry.startAt);

  if (entry.endAt === null) {
    return `${category.label}, logged at ${startTime}.`;
  }

  return `${category.label}, ${startTime} to ${formatTime(entry.endAt)}.`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHour(hour: number) {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  timelineContent: {
    position: "relative",
  },
  eventLaneBackground: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    left: 0,
    position: "absolute",
    right: 0,
  },
  hourDivision: {
    position: "absolute",
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  hourLabel: {
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 13,
    position: "absolute",
    top: tokens.spacing.xs,
  },
  eventFootprint: {
    height: EVENT_FOOTPRINT_HEIGHT,
    opacity: 0.72,
    position: "absolute",
  },
  eventStartPin: {
    height: EVENT_HEIGHT + EVENT_FOOTPRINT_HEIGHT,
    position: "absolute",
    width: 2,
  },
  eventBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    height: EVENT_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: tokens.spacing.xs,
    position: "absolute",
  },
  eventLabel: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    textAlign: "center",
  },
  stateOverlay: {
    alignItems: "center",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  stateText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: tokens.spacing.md,
  },
  retryText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
