import { formatDisplayDate } from "../utils/displayDate";
import { QuestionnaireHistoryScreen } from "../recovery/components/QuestionnaireHistoryScreen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { DayTimeline } from "../components/DayTimeline";
import {
  SegmentedSelector,
  SlidingPanels,
} from "../components/nutrition/SegmentedSelector";
import { PressOpacity } from "../components/PressOpacity";
import { SleepLogModal } from "../components/SleepLogModal";
import { WeightLogModal } from "../components/WeightLogModal";

import { useSQLiteContext } from "expo-sqlite";

import { scheduleIdleTask } from "../utils/scheduleIdleTask";
import {
  getTimelineEntriesForDay,
  type TimelineEntry,
  type TimelineKind,
} from "../data/timelineRepository";

import { Screen } from "../components/Screen";
import { MorningQuestionnaire } from "../recovery/components/MorningQuestionnaire";
import { RecoveryPanel } from "../recovery/components/RecoveryPanel";
import { useRecoveryDay } from "../recovery/useRecoveryDay";
import { useRecoveryData } from "../recovery/useRecoveryData";
import type { Questionnaire } from "../recovery/types";
import { ProgressPanel } from "../progress/ProgressPanel";
import { timelineCategories } from "../constants/timelineCategories";
import { useAppState } from "../state/AppStateContext";
import { useNutritionWorkspace } from "../state/NutritionWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackStep, feedbackToggle } from "../utils/feedback";
import { formatHeight } from "../utils/height";
import { calculateAge } from "../utils/biometrics";
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

export function HomeScreen({ registerExitGuard }: { registerExitGuard?: (guard: ((proceed: () => void) => void) | null) => void }) {
  const { theme } = useAppTheme();
  const { athleteProfile, timelineRevision, unitSettings, username } = useAppState();
  const { dataRevision, homeDate, openNewMeal, setHomeDate } = useNutritionWorkspace();
  const selectedDate = homeDate;
  const recoveryDay = useRecoveryDay();
  const [recoveryRevision, setRecoveryRevision] = useState(0);
  const recovery = useRecoveryData(recoveryDay.localDate, recoveryDay.timezone, recoveryRevision + timelineRevision);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [questionnaireForm, setQuestionnaireForm] = useState<{ localDate: string; timezone: string; initial: Questionnaire | null } | null>(null);
  function openQuestionnaire(historical?: Questionnaire) {
    if (!historical && (!recovery.data || recovery.loading || recovery.error)) return;
    setQuestionnaireForm(historical ? { localDate: historical.localDate, timezone: historical.timezone, initial: historical } : { ...recoveryDay, initial: recovery.data!.questionnaire });
  }

  const age = calculateAge(athleteProfile.dateOfBirth) ?? athleteProfile.age;
  const ageText = age === null ? "--" : `${age} yrs`;
  const heightText = formatHeight(athleteProfile.heightCm, unitSettings.height);
  const weightText = formatWeight(athleteProfile.weightKg, unitSettings.weight);
  const sportsText = formatSports(athleteProfile.sports);

  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const quickLogAnimation = useSharedValue(0);

  const [selectedHomeSection, setSelectedHomeSection] =
    useState<HomeSection>("today");

  function toggleQuickLogMenu() {
    const willOpen = !quickLogOpen;
    feedbackToggle(willOpen);
    setQuickLogOpen(willOpen);

    quickLogAnimation.set(
      withTiming(willOpen ? 1 : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }

  const quickLogMenuStyle = useAnimatedStyle(() => ({
    height: interpolate(quickLogAnimation.get(), [0, 1], [0, 2 * 92 + tokens.spacing.sm + tokens.spacing.md]),
    opacity: quickLogAnimation.get(),
  }));

  const db = useSQLiteContext();

  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
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
    const task = scheduleIdleTask(() => {
      void loadSelectedDateEntries();
    });

    return () => {
      task.cancel();
      timelineRequestId.current += 1;
    };
  }, [loadSelectedDateEntries, dataRevision, timelineRevision]);

  const previousDate = shiftLocalDate(selectedDate, -1);
  const nextDate = shiftLocalDate(selectedDate, 1);
  const primaryText = readableTextColor(theme.colors.tertiary);

  async function handleLoggedEntrySaved(loggedAt: number) {
    const loggedDate = new Date(loggedAt);

    if (isSameLocalDay(selectedDate, loggedDate)) {
      await loadSelectedDateEntries();
      return;
    }

    setHomeDate(loggedDate);
  }

  async function handleWeightDeleted() {
    await loadSelectedDateEntries();
  }

  function openNewWeightLog() {
    setSelectedWeightEntry(null);
    setSleepModalOpen(false);
    setWeightModalOpen(true);
  }

  function openWeightLog(entry: TimelineEntry) {
    if (entry.kind !== "weight" || entry.weightKg === null) {
      return;
    }

    setSelectedWeightEntry(entry);
    setSleepModalOpen(false);
    setWeightModalOpen(true);
  }

  function closeWeightModal() {
    setWeightModalOpen(false);
    setSelectedWeightEntry(null);
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen
      title="Home"
    >
      {/* Card 1: Athlete Information Card */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            ATHLETE INFORMATION
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: theme.colors.tertiary }]}>
              {timelineEntries.length} LOGGED TODAY
            </Text>
          </View>
        </View>

        <View style={styles.profileTopRow}>
          <View
            style={[
              styles.profileImage,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.tertiary,
              },
            ]}
          >
            <Ionicons color={theme.colors.tertiary} name="person" size={30} />
          </View>

          <View style={styles.profileIdentity}>
            <Text
              numberOfLines={1}
              style={[styles.username, { color: theme.colors.text }]}
            >
              {username || "Not selected"}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.sportsLine, { color: theme.colors.textMuted }]}
            >
              {sportsText}
            </Text>
          </View>

          <View
            style={[
              styles.weightHeroPill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.weightHeroLabel, { color: theme.colors.textMuted }]}>
              WEIGHT
            </Text>
            <Text style={[styles.weightHeroValue, { color: theme.colors.text }]}>
              {weightText}
            </Text>
          </View>
        </View>

        <View style={styles.statGrid}>
          <View
            style={[
              styles.statCell,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
              AGE
            </Text>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {ageText}
            </Text>
          </View>
          <View
            style={[
              styles.statCell,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>
              HEIGHT
            </Text>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {heightText}
            </Text>
          </View>
        </View>
      </View>

      {/* Card 2: Quick Log Action Launcher */}
      <View
        style={[
          styles.quickLogCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <PressOpacity
          accessibilityLabel="Quick Log"
          accessibilityState={{ expanded: quickLogOpen }}
          onPress={toggleQuickLogMenu}
          silent
          style={[
            styles.quickLogButton,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <Ionicons
            color={primaryText}
            name={quickLogOpen ? "chevron-up-circle" : "flash"}
            size={20}
          />
          <Text style={[styles.quickLogButtonText, { color: primaryText }]}>
            Quick Log
          </Text>
        </PressOpacity>

        <Animated.View style={[styles.quickLogMenuWrapper, quickLogMenuStyle]}>
          <View style={styles.quickLogGrid}>
            {quickLogKinds.map((kind) => (
              <QuickLogOption
                key={kind}
                kind={kind}
                onPress={
                  kind === "weight"
                    ? openNewWeightLog
                    : kind === "meal"
                      ? () => {
                          if (quickLogOpen) {
                            toggleQuickLogMenu();
                          }
                          openNewMeal(selectedDate);
                        }
                      : kind === "sleep"
                        ? () => {
                            setWeightModalOpen(false);
                            setSleepModalOpen(true);
                          }
                        : undefined
                }
              />
            ))}
          </View>
        </Animated.View>
      </View>

      {recovery.data && !recovery.loading && !recovery.error && recovery.data.questionnaire?.status !== "completed" ? <PressOpacity accessibilityLabel="Morning questionnaire due. Open Recovery" onPress={() => setSelectedHomeSection("recovery")} style={[styles.recoveryNotice, { borderColor: theme.colors.tertiary, backgroundColor: theme.colors.surface }]}><Text style={{ color: theme.colors.text }}>● Morning questionnaire due · {formatDisplayDate(recoveryDay.localDate)}</Text></PressOpacity> : null}
      {/* Card 3: Section Selector & Daily Timeline Card */}
      <SegmentedSelector
        accessibilityLabel="Home sections"
        onChange={setSelectedHomeSection}
        options={homeSections.map((section) => ({
          label: section.key === "recovery" && recovery.data && !recovery.loading && !recovery.error && recovery.data.questionnaire?.status !== "completed" ? "Recovery •" : section.label,
          value: section.key,
        }))}
        value={selectedHomeSection}
      />

      <View
        style={[
          styles.homeSectionContent,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <SlidingPanels
          index={homeSections.findIndex(
            (section) => section.key === selectedHomeSection,
          )}
        >
          {selectedHomeSection === "today" ? <View style={styles.todayPanel}>
            <View style={styles.dateNavigator}>
              <PressOpacity
                accessibilityLabel={`Show previous day, ${formatFullDate(
                  previousDate,
                )}`}
                onPress={() => {
                  feedbackStep("down");
                  setHomeDate(shiftLocalDate(selectedDate, -1));
                }}
                silent
                style={[
                  styles.dateStepButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Ionicons
                  color={theme.colors.text}
                  name="chevron-back"
                  size={20}
                />
              </PressOpacity>

              <PressOpacity
                accessibilityLabel="Jump to today"
                onPress={() => {
                  feedbackStep("up");
                  setHomeDate(new Date());
                }}
                silent
                style={[
                  styles.selectedDatePill,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.selectedDateText, { color: theme.colors.text }]}
                >
                  {formatSelectedDate(selectedDate)}
                </Text>
              </PressOpacity>

              <PressOpacity
                accessibilityLabel={`Show next day, ${formatFullDate(
                  nextDate,
                )}`}
                onPress={() => {
                  feedbackStep("up");
                  setHomeDate(shiftLocalDate(selectedDate, 1));
                }}
                silent
                style={[
                  styles.dateStepButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Ionicons
                  color={theme.colors.text}
                  name="chevron-forward"
                  size={20}
                />
              </PressOpacity>
            </View>

            <DayTimeline
              dayEnd={dayEnd}
              dayStart={dayStart}
              entries={timelineEntries}
              error={timelineError}
              loading={timelineLoading}
              onRetry={loadSelectedDateEntries}
              onWeightEntryPress={openWeightLog}
            />
          </View> : null}
          {selectedHomeSection === "recovery" ? <RecoveryPanel recovery={recovery} onHistory={() => setHistoryOpen(true)} onQuestionnaire={openQuestionnaire} onChanged={() => setRecoveryRevision((value) => value + 1)} /> : null}
          <ProgressPanel active={selectedHomeSection === "progress"} revision={recoveryRevision} onManageIndices={() => setSelectedHomeSection("recovery")} />
        </SlidingPanels>
      </View>
    </Screen>
      {historyOpen ? <QuestionnaireHistoryScreen active={!questionnaireForm} revision={recoveryRevision} onClose={() => setHistoryOpen(false)} onEdit={openQuestionnaire} /> : null}
      {questionnaireForm ? <MorningQuestionnaire onBack={historyOpen ? () => setQuestionnaireForm(null) : undefined} registerExitGuard={registerExitGuard} key={`${questionnaireForm.localDate}:${questionnaireForm.timezone}`} {...questionnaireForm} onClose={() => { setQuestionnaireForm(null); setHistoryOpen(false); }} onSaved={() => setRecoveryRevision((value) => value + 1)} /> : null}
      <WeightLogModal
        entryToEdit={selectedWeightEntry ?? undefined}
        onClose={closeWeightModal}
        onDeleted={handleWeightDeleted}
        onSaved={handleLoggedEntrySaved}
        visible={weightModalOpen}
      />
      <SleepLogModal
        onClose={() => setSleepModalOpen(false)}
        onSaved={loadSelectedDateEntries}
        visible={sleepModalOpen}
        wakeDate={selectedDate}
      />
    </View>
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

function formatSelectedDate(date: Date) { return formatDisplayDate(date); }

function formatFullDate(date: Date) { return formatDisplayDate(date); }

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
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <View
        style={[
          styles.quickLogOptionIconBadge,
          {
            backgroundColor: theme.colors.background,
            borderColor: presentation.color,
          },
        ]}
      >
        {presentation.iconSet === "materialCommunity" ? (
          <MaterialCommunityIcons
            color={presentation.color}
            name={presentation.icon}
            size={22}
          />
        ) : (
          <Ionicons
            color={presentation.color}
            name={presentation.icon}
            size={22}
          />
        )}
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
  recoveryNotice: { borderWidth: 1, borderRadius: 12, minHeight: 48, padding: 12, justifyContent: "center" },
  profileCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  profileTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  profileImage: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 2,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  profileIdentity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  username: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  sportsLine: {
    fontSize: 12,
    fontWeight: "600",
  },
  weightHeroPill: {
    alignItems: "flex-end",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
  },
  weightHeroLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  weightHeroValue: {
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  statGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  statCell: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  quickLogCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: tokens.spacing.md,
  },
  quickLogButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    width: "100%",
  },
  quickLogButtonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  quickLogMenuWrapper: {
    overflow: "hidden",
  },
  quickLogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    paddingTop: tokens.spacing.md,
  },
  quickLogOption: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: 6,
    height: 92,
    justifyContent: "center",
    padding: tokens.spacing.xs,
    width: "31%",
  },
  quickLogOptionIconBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1.5,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  quickLogOptionText: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
    textAlign: "center",
  },
  homeSectionContent: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    minHeight: 180,
    padding: tokens.spacing.lg,
  },
  todayPanel: {
    gap: tokens.spacing.md,
  },
  dateNavigator: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  dateStepButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  selectedDatePill: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  homeSectionText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
});
