import { useCallback, useEffect, useMemo, useRef, useState } from "react"; // React imports
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons"; // Style Imports
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { DayTimeline } from "../components/DayTimeline";
import { MealLogModal } from "../components/MealLogModal";
import { PressOpacity } from "../components/PressOpacity";
import { SleepLogModal } from "../components/SleepLogModal";
import { WeightLogModal } from "../components/WeightLogModal";

import { useSQLiteContext } from "expo-sqlite"; // Database imports

import {
  getTimelineEntriesForDay,
  type TimelineEntry,
  type TimelineKind,
} from "../data/timelineRepository";

import { Screen } from "../components/Screen"; // File imports
import { timelineCategories } from "../constants/timelineCategories";
import { useAppState, type UnitSystem } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { formatWeight } from "../utils/weight";

const tokens = themes.dark;

type HomeSection = "today" | "recovery" | "progress";

const homeSections: { key: HomeSection; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "recovery", label: "Recovery" },
  { key: "progress", label: "Progress" },
];

const quickLogKinds: TimelineKind[] = [
  "strength",
  "conditioning",
  "skill",
  "meal",
  "weight",
  "sleep",
];

export function HomeScreen() {
  const { theme } = useAppTheme();
  const { athleteProfile, unitSettings, username } = useAppState();

  const ageText =
    athleteProfile.age === null
      ? "Not selected"
      : `${athleteProfile.age} years old`;

  const heightText = formatHeight(athleteProfile.heightCm, unitSettings.height);
  const weightText = formatWeight(athleteProfile.weightKg, unitSettings.weight);
  const sportsText = formatSports(athleteProfile.sports);

  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const quickLogAnimation = useRef(new Animated.Value(0)).current;

  const [selectedHomeSection, setSelectedHomeSection] =
    useState<HomeSection>("today");

  function toggleQuickLogMenu() {
    const willOpen = !quickLogOpen;

    setQuickLogOpen(willOpen);

    Animated.timing(quickLogAnimation, {
      toValue: willOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  const db = useSQLiteContext();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [sleepModalOpen, setSleepModalOpen] = useState(false);
  const [selectedWeightEntry, setSelectedWeightEntry] =
    useState<TimelineEntry | null>(null);
  const timelineRequestId = useRef(0);

  const { dayStart, dayEnd } = useMemo(
    () => getLocalDayBounds(selectedDate),
    [selectedDate],
  );

  const loadSelectedDateEntries = useCallback(async () => {
    const requestId = timelineRequestId.current + 1;
    timelineRequestId.current = requestId;

    setTimelineLoading(true);
    setTimelineError(null);

    try {
      const entries = await getTimelineEntriesForDay(
        db,
        dayStart.getTime(),
        dayEnd.getTime(),
      );

      if (requestId === timelineRequestId.current) {
        setTimelineEntries(entries);
      }
    } catch {
      if (requestId === timelineRequestId.current) {
        setTimelineError("Couldn’t load this day");
      }
    } finally {
      if (requestId === timelineRequestId.current) {
        setTimelineLoading(false);
      }
    }
  }, [dayEnd, dayStart, db]);

  useEffect(() => {
    void loadSelectedDateEntries();

    return () => {
      timelineRequestId.current += 1;
    };
  }, [loadSelectedDateEntries]);

  const previousDate = shiftLocalDate(selectedDate, -1);
  const nextDate = shiftLocalDate(selectedDate, 1);

  async function handleLoggedEntrySaved(loggedAt: number) {
    const loggedDate = new Date(loggedAt);

    if (isSameLocalDay(selectedDate, loggedDate)) {
      await loadSelectedDateEntries();
      return;
    }

    setSelectedDate(loggedDate);
  }

  async function handleWeightDeleted() {
    await loadSelectedDateEntries();
  }

  function openNewWeightLog() {
    setSelectedWeightEntry(null);
    setWeightModalOpen(true);
  }

  function openWeightLog(entry: TimelineEntry) {
    if (entry.kind !== "weight" || entry.weightKg === null) {
      return;
    }

    setSelectedWeightEntry(entry);
    setWeightModalOpen(true);
  }

  function closeWeightModal() {
    setWeightModalOpen(false);
    setSelectedWeightEntry(null);
  }

  return (
    <Screen centerTitle title="Home">
      <View
        style={[
          styles.profile,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          Profile
        </Text>

        <View style={styles.profileContent}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Ionicons color={theme.colors.textMuted} name="person" size={40} />
          </View>

          <View style={styles.profileDetails}>
            <View style={styles.summaryRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.infoText,
                  styles.username,
                  { color: theme.colors.text },
                ]}
              >
                {username || "Not selected"}
              </Text>

              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                {weightText}
              </Text>
            </View>

            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {ageText}
            </Text>

            <Text style={[styles.infoText, { color: theme.colors.text }]}>
              {heightText}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.infoText, { color: theme.colors.text }]}
            >
              {sportsText}
            </Text>
          </View>
        </View>
      </View>

      <PressOpacity
        accessibilityLabel="Quick Log"
        style={[
          styles.quickLogButton,
          { backgroundColor: theme.colors.tertiary },
        ]}
        onPress={toggleQuickLogMenu}
      >
        <Text style={styles.quickLogButtonText}>Quick Log</Text>
      </PressOpacity>

      <Animated.View
        style={[
          styles.quickLogMenuWrapper,
          {
            height: quickLogAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 188],
            }),
            opacity: quickLogAnimation,
            transform: [
              {
                translateY: quickLogAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.quickLogMenu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.quickLogGrid}>
            {quickLogKinds.map((kind) => (
              <QuickLogOption
                key={kind}
                kind={kind}
                onPress={
                  kind === "weight"
                    ? openNewWeightLog
                    : kind === "meal"
                      ? () => setMealModalOpen(true)
                    : kind === "sleep"
                      ? () => setSleepModalOpen(true)
                      : undefined
                }
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <View
        style={[
          styles.homeSelector,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {homeSections.map((section) => {
          const isSelected = selectedHomeSection === section.key;

          return (
            <PressOpacity
              accessibilityLabel={`Show ${section.label}`}
              accessibilityRole="tab"
              key={section.key}
              onPress={() => setSelectedHomeSection(section.key)}
              style={[
                styles.homeSelectorOption,
                isSelected && {
                  backgroundColor: theme.colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.homeSelectorText,
                  {
                    color: isSelected
                      ? theme.colors.tertiary
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {section.label}
              </Text>
            </PressOpacity>
          );
        })}
      </View>

      <View
        style={[
          styles.homeSectionContent,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {selectedHomeSection === "today" && (
          <>
            <View style={styles.dateNavigator}>
              <PressOpacity
                accessibilityLabel={`Show previous day, ${formatFullDate(
                  previousDate,
                )}`}
                onPress={() =>
                  setSelectedDate((currentDate) =>
                    shiftLocalDate(currentDate, -1),
                  )
                }
                style={styles.dateArrow}
              >
                <Ionicons
                  color={theme.colors.text}
                  name="chevron-back"
                  size={22}
                />
              </PressOpacity>

              <Text
                numberOfLines={1}
                style={[styles.selectedDateText, { color: theme.colors.text }]}
              >
                {formatSelectedDate(selectedDate)}
              </Text>

              <PressOpacity
                accessibilityLabel={`Show next day, ${formatFullDate(
                  nextDate,
                )}`}
                onPress={() =>
                  setSelectedDate((currentDate) =>
                    shiftLocalDate(currentDate, 1),
                  )
                }
                style={styles.dateArrow}
              >
                <Ionicons
                  color={theme.colors.text}
                  name="chevron-forward"
                  size={22}
                />
              </PressOpacity>
            </View>

            <DayTimeline
              dayEnd={dayEnd}
              dayStart={dayStart}
              entries={timelineEntries}
              error={timelineError}
              loading={timelineLoading}
              onWeightEntryPress={openWeightLog}
              onRetry={loadSelectedDateEntries}
            />
          </>
        )}

        {selectedHomeSection === "recovery" && (
          <Text style={[styles.homeSectionText, { color: theme.colors.text }]}>
            Recovery information will go here
          </Text>
        )}

        {selectedHomeSection === "progress" && (
          <Text style={[styles.homeSectionText, { color: theme.colors.text }]}>
            Progress charts will go here
          </Text>
        )}
      </View>

      <WeightLogModal
        entryToEdit={selectedWeightEntry ?? undefined}
        onClose={closeWeightModal}
        onDeleted={handleWeightDeleted}
        onSaved={handleLoggedEntrySaved}
        visible={weightModalOpen}
      />

      <MealLogModal
        onClose={() => setMealModalOpen(false)}
        onSaved={handleLoggedEntrySaved}
        visible={mealModalOpen}
      />

      <SleepLogModal
        onClose={() => setSleepModalOpen(false)}
        onSaved={loadSelectedDateEntries}
        visible={sleepModalOpen}
        wakeDate={selectedDate}
      />
    </Screen>
  );
}

function getLocalDayBounds(date: Date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return {
    dayStart,
    dayEnd,
  };
}

function shiftLocalDate(date: Date, amount: number) {
  const shiftedDate = new Date(date);
  shiftedDate.setDate(shiftedDate.getDate() + amount);
  return shiftedDate;
}

function isSameLocalDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function formatSelectedDate(date: Date) {
  const today = new Date();

  if (isSameLocalDay(date, today)) {
    return `Today, ${date.toLocaleDateString([], {
      month: "long",
      day: "numeric",
    })}`;
  }

  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatHeight(heightCm: number | null, unit: UnitSystem) {
  if (heightCm === null) {
    return "Not selected";
  }

  if (unit === "metric") {
    return `${heightCm}cm`;
  }

  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}\"`;
}

function formatSports(sports: string[]) {
  if (sports.length === 0) {
    return "Not selected";
  }

  const displayedSports = sports.slice(0, 3).join(", ");
  return sports.length > 3 ? `${displayedSports}, ...` : displayedSports;
}

type QuickLogOptionProps = {
  kind: TimelineKind;
  onPress?: () => void;
};

function QuickLogOption({ kind, onPress }: QuickLogOptionProps) {
  const { theme } = useAppTheme();
  const presentation = timelineCategories[kind];

  return (
    <PressOpacity
      accessibilityLabel={presentation.label}
      onPress={onPress}
      style={[
        styles.quickLogOption,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.quickLogOptionIcon}>
        <View
          style={[
            styles.quickLogOptionIconBadge,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {presentation.iconSet === "materialCommunity" ? (
            <MaterialCommunityIcons
              color={presentation.color}
              name={presentation.icon}
              size={24}
            />
          ) : (
            <Ionicons
              color={presentation.color}
              name={presentation.icon}
              size={24}
            />
          )}
        </View>
      </View>

      <Text
        numberOfLines={2}
        style={[styles.quickLogOptionText, { color: theme.colors.text }]}
      >
        {presentation.label}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  profile: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.lg,
  },
  profileContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  profileImage: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  profileDetails: {
    flex: 1,
    gap: tokens.spacing.xs,
    minWidth: 0,
  },
  summaryRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
  },
  infoText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  username: {
    fontWeight: "700",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  quickLogButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    marginTop: tokens.spacing.lg,
    minHeight: 25,
    width: "100%",
  },
  quickLogButtonText: {
    color: "#FFFFFF",
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "600",
    lineHeight: tokens.typography.body.lineHeight,
  },
  quickLogMenuWrapper: {
    overflow: "hidden",
  },
  quickLogMenu: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  quickLogOption: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    height: 76,
    padding: tokens.spacing.xs,
    width: "31%",
  },
  quickLogOptionIcon: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  quickLogOptionIconBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  quickLogOptionText: {
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 12,
    minHeight: 16,
    textAlign: "center",
  },
  quickLogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  homeSelector: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: tokens.spacing.lg,
    overflow: "hidden",
    width: "100%",
  },
  homeSelectorOption: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 25,
  },
  homeSelectorText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
  },
  homeSectionContent: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    marginTop: tokens.spacing.lg,
    minHeight: 160,
    padding: tokens.spacing.lg,
  },
  dateNavigator: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: tokens.spacing.md,
  },
  dateArrow: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  selectedDateText: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  homeSectionText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
