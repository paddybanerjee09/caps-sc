import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackStep } from "../utils/feedback";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

const QUICK_HOURS = [6, 8, 12, 15, 18, 20, 22] as const;

type LogTimeChangerProps = {
  compact?: boolean;
  iconOnly?: boolean;
  inline?: boolean;
  label?: string;
  maximumDate?: Date;
  onChange: (date: Date) => void;
  value: Date;
};

export function LogTimeChanger({
  compact = false,
  iconOnly = false,
  inline = false,
  label,
  maximumDate,
  onChange,
  value,
}: LogTimeChangerProps) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const activeText = readableTextColor(theme.colors.tertiary);

  function clampDate(candidate: Date) {
    if (maximumDate && candidate.getTime() > maximumDate.getTime()) {
      return new Date(maximumDate);
    }
    return candidate;
  }

  function shiftMinutes(deltaMinutes: number) {
    feedbackStep(deltaMinutes > 0 ? "up" : "down");
    const updated = new Date(value.getTime() + deltaMinutes * 60_000);
    onChange(clampDate(updated));
  }

  function selectHourPreset(hour: number) {
    feedbackStep("up");
    const updated = new Date(value);
    updated.setHours(hour, 0, 0, 0);
    onChange(clampDate(updated));
  }

  function setNow() {
    feedbackStep("up");
    onChange(clampDate(new Date()));
  }

  if (inline || compact || iconOnly) {
    return (
      <View
        style={[
          styles.inlineContainer,
          compact && styles.inlineContainerCompact,
        ]}
      >
        <View style={styles.inlineStepBar}>
          <PressOpacity
            accessibilityLabel="Subtract 15 minutes"
            onPress={() => shiftMinutes(-15)}
            silent
            style={[
              styles.inlineMiniStep,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.inlineMiniStepText, { color: theme.colors.text }]}>
              -15m
            </Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel={`Change log time. Currently ${formatFullDateTime(
              value,
            )}`}
            onPress={() => setExpanded((current) => !current)}
            style={[
              styles.labelPill,
              compact && styles.labelPillCompact,
              {
                backgroundColor: expanded
                  ? theme.colors.tertiary
                  : theme.colors.surfaceMuted,
                borderColor: expanded
                  ? theme.colors.tertiary
                  : theme.colors.borderStrong,
              },
            ]}
          >
            <Ionicons
              color={expanded ? activeText : theme.colors.tertiary}
              name="time-outline"
              size={compact ? 14 : 16}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.labelText,
                compact && styles.labelTextCompact,
                { color: expanded ? activeText : theme.colors.text },
              ]}
            >
              {formatTime(value)}
            </Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel="Add 15 minutes"
            onPress={() => shiftMinutes(15)}
            silent
            style={[
              styles.inlineMiniStep,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.inlineMiniStepText, { color: theme.colors.text }]}>
              +15m
            </Text>
          </PressOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLabelGroup}>
          <Ionicons color={theme.colors.tertiary} name="time-outline" size={16} />
          <Text style={[styles.cardLabel, { color: theme.colors.textMuted }]}>
            {(label ?? "LOG TIME").toUpperCase()}
          </Text>
        </View>
        <PressOpacity
          accessibilityLabel="Set time to now"
          onPress={setNow}
          silent
          style={[
            styles.nowBadge,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.nowBadgeText, { color: theme.colors.tertiary }]}>
            NOW
          </Text>
        </PressOpacity>
      </View>

      <View style={styles.stepperRow}>
        <PressOpacity
          accessibilityLabel="Subtract 1 hour"
          onPress={() => shiftMinutes(-60)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>-1h</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel="Subtract 15 minutes"
          onPress={() => shiftMinutes(-15)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>-15m</Text>
        </PressOpacity>

        <View
          style={[
            styles.timeReadout,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.timeValue, { color: theme.colors.text }]}>
            {formatTime(value)}
          </Text>
        </View>

        <PressOpacity
          accessibilityLabel="Add 15 minutes"
          onPress={() => shiftMinutes(15)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>+15m</Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel="Add 1 hour"
          onPress={() => shiftMinutes(60)}
          silent
          style={[
            styles.stepButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepText, { color: theme.colors.text }]}>+1h</Text>
        </PressOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.presetStrip}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {QUICK_HOURS.map((hour) => {
          const isSelected =
            value.getHours() === hour && Math.abs(value.getMinutes()) < 10;
          return (
            <PressOpacity
              accessibilityLabel={`Set time to ${formatHourChip(hour)}`}
              key={hour}
              onPress={() => selectHourPreset(hour)}
              silent
              style={[
                styles.presetChip,
                {
                  backgroundColor: isSelected
                    ? theme.colors.tertiary
                    : theme.colors.surface,
                  borderColor: isSelected
                    ? theme.colors.tertiary
                    : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  { color: isSelected ? activeText : theme.colors.text },
                ]}
              >
                {formatHourChip(hour)}
              </Text>
            </PressOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function formatHourChip(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDateTime(date: Date) {
  return date.toLocaleString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    padding: tokens.spacing.sm,
    width: "100%",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLabelGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  nowBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: tokens.spacing.sm,
  },
  nowBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 46,
    paddingHorizontal: 6,
  },
  stepText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  timeReadout: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.xs,
  },
  timeValue: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  presetStrip: {
    gap: 6,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: tokens.spacing.sm,
  },
  presetChipText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  inlineContainer: {
    alignSelf: "flex-end",
  },
  inlineContainerCompact: {
    marginVertical: 2,
  },
  inlineStepBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  inlineMiniStep: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    minWidth: 38,
    paddingHorizontal: 4,
  },
  inlineMiniStepText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  labelPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 38,
    paddingHorizontal: tokens.spacing.sm,
  },
  labelPillCompact: {
    minHeight: 38,
    paddingHorizontal: 6,
  },
  labelText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  labelTextCompact: {
    fontSize: 10,
  },
});
