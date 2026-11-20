import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSQLiteContext } from "expo-sqlite";

import { ScreenTitleCard } from "../components/ScreenTitleCard";
import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { PressOpacity } from "../components/PressOpacity";
import { SavedWorkoutGrid } from "../components/conditioning/SavedWorkoutGrid";
import { ActionButton } from "../components/conditioning/ConditioningFields";
import {
  calendarDateForSession,
  formatLocalDate,
  markerForSessionStatus,
} from "../conditioning/dates";
import { createWorkoutDraft, draftFromTemplate } from "../conditioning/drafts";
import { buildMonthGrid } from "../components/monthGrid";
import type { MonthEvent } from "../components/monthGrid";
import { timelineCategories } from "../constants/timelineCategories";
import {
  findInProgressConditioningSession,
  getConditioningOwnerId,
  listConditioningSessionsForDates,
  listConditioningTemplates,
  type ConditioningSessionRecord,
  type ConditioningTemplateRecord,
} from "../data/conditioningRepository";
import { useConditioningWorkspace } from "../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import { feedbackToggle } from "../utils/feedback";
import type { StructuredFormat } from "../conditioning/types";

const tokens = themes.dark;
const SAVED_PANEL_HEIGHT = 248;

const FORMAT_OPTIONS: {
  description: string;
  format: StructuredFormat;
  icon: "timer-outline" | "flash-outline" | "repeat-outline";
  title: string;
}[] = [
  {
    description: "Work/rest rounds with target RPE & preparation timer",
    format: "time_interval",
    icon: "timer-outline",
    title: "Time Interval",
  },
  {
    description: "Fixed-distance repeats with GPS or manual split tracking",
    format: "sprint",
    icon: "flash-outline",
    title: "Sprints",
  },
  {
    description: "Multi-station rounds by time, reps, distance, or calories",
    format: "circuit",
    icon: "repeat-outline",
    title: "Circuit",
  },
];

export function ConditioningScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const today = formatLocalDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { monthIndex: now.getMonth(), year: now.getFullYear() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<MonthEvent[]>([]);
  const [templates, setTemplates] = useState<ConditioningTemplateRecord[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [fetchRetry, setFetchRetry] = useState(0);
  const [committedFetchKey, setCommittedFetchKey] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<ConditioningSessionRecord | null>(null);
  const panel = useSharedValue(0);

  const fetchKey = `${workspace.revision}:${month.monthIndex}:${month.year}:${selectedDate}:${fetchRetry}`;
  const templatesLoading = committedFetchKey !== fetchKey;

  const fetchScreenData = useCallback(async () => {
    const ownerId = await getConditioningOwnerId(db);
    const grid = buildMonthGrid({
      events: [],
      monthIndex: month.monthIndex,
      selectedDate,
      today,
      year: month.year,
    });
    const start = grid.cells[0]?.isoDate ?? today;
    const end = grid.cells.at(-1)?.isoDate ?? today;
    const [sessions, saved, active] = await Promise.all([
      listConditioningSessionsForDates(db, ownerId, start, end),
      listConditioningTemplates(db, ownerId),
      findInProgressConditioningSession(db, ownerId),
    ]);
    return {
      activeSession: active,
      events: sessions.flatMap(toCalendarEvent),
      templates: saved,
    };
  }, [db, month.monthIndex, month.year, selectedDate, today]);

  useEffect(() => {
    let cancelled = false;
    void fetchScreenData()
      .then((result) => {
        if (!cancelled) {
          setEvents(result.events);
          setTemplates(result.templates);
          setActiveSession(result.activeSession);
          setTemplatesError(null);
          setCommittedFetchKey(fetchKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplatesError("Couldn’t load conditioning");
          setCommittedFetchKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, fetchScreenData]);

  useEffect(() => {
    workspace.registerBackHandler(() => {
      if (!chooserOpen) {
        return false;
      }
      setChooserOpen(false);
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [chooserOpen, workspace]);

  function toggleSaved() {
    const next = !savedOpen;
    feedbackToggle(next);
    setSavedOpen(next);
    panel.set(
      withTiming(next ? 1 : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }

  const panelStyle = useAnimatedStyle(() => ({
    height: panel.get() * SAVED_PANEL_HEIGHT,
    opacity: panel.get(),
  }));

  function openEditor(format: StructuredFormat, template?: ConditioningTemplateRecord) {
    const draft = template
      ? draftFromTemplate(template.config, selectedDate)
      : createWorkoutDraft(format, selectedDate);
    workspace.openEditor({
      draft,
      format,
      planSessionId: null,
      savedSnapshot: JSON.stringify(draft),
      templateId: template?.id ?? null,
    });
  }

  const primaryText = readableTextColor(theme.colors.tertiary);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleCard title="Conditioning" subtitle="Intervals, sprints, circuits, and GPS roadwork" />

        {/* Active Session Banner Card */}
        {activeSession ? (
          <PressOpacity
            accessibilityLabel="Return to active session"
            onPress={() =>
              workspace.push(
                activeSession.format === "free"
                  ? { key: `free-${activeSession.id}`, name: "free" }
                  : {
                      key: `runner-${activeSession.id}`,
                      name: "runner",
                      sessionId: activeSession.id,
                    },
              )
            }
            style={[
              styles.activeBannerCard,
              {
                backgroundColor: theme.colors.tertiary,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <View style={styles.activeBannerCopy}>
              <Text style={[styles.activeBannerTag, { color: primaryText }]}>
                LIVE SESSION IN PROGRESS
              </Text>
              <Text style={[styles.activeBannerTitle, { color: primaryText }]}>
                Return to {activeSession.title}
              </Text>
            </View>
            <Ionicons color={primaryText} name="play-circle" size={28} />
          </PressOpacity>
        ) : null}

        {/* Card 1: Monthly Conditioning Calendar */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              TRAINING CALENDAR
            </Text>
            <Text style={[styles.cardBadgeText, { color: theme.colors.tertiary }]}>
              {events.length} IN VIEW
            </Text>
          </View>
          <MonthlyTimelineComponent
            emptyLabel="No conditioning on this date"
            events={events}
            monthIndex={month.monthIndex}
            onEventPress={(event) =>
              workspace.push({
                key: `detail-${event.id}`,
                name: "detail",
                sessionId: event.id,
              })
            }
            onMonthChange={setMonth}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            today={today}
            year={month.year}
          />
        </View>

        {/* Card 2: Session Launch & User Flow Controls */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              SESSION LAUNCHER
            </Text>
            <Text style={[styles.cardBadgeText, { color: theme.colors.textMuted }]}>
              TARGET: {selectedDate}
            </Text>
          </View>

          <ActionButton
            label="Free Session"
            onPress={() =>
              workspace.push({ key: `free-${Date.now()}`, name: "free" })
            }
          />
          <ActionButton
            label="Create Session"
            onPress={() => setChooserOpen(true)}
            tone="secondary"
          />
          <ActionButton
            label="Browse saved workouts"
            onPress={() =>
              workspace.push({ key: `saved-${Date.now()}`, name: "saved" })
            }
            tone="quiet"
          />
        </View>

        {/* Card 3: Saved Workouts Inline Expander (pushes content down) */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <PressOpacity
            accessibilityLabel="Saved workouts"
            accessibilityState={{ expanded: savedOpen }}
            onPress={toggleSaved}
            silent
            style={[
              styles.expander,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <View style={styles.expanderLeft}>
              <Ionicons
                color={theme.colors.tertiary}
                name="bookmarks-outline"
                size={18}
              />
              <Text style={[styles.expanderTitle, { color: theme.colors.text }]}>
                Saved Workouts ({templates.length})
              </Text>
            </View>
            <View style={styles.expanderRight}>
              <Text style={[styles.expanderState, { color: theme.colors.textMuted }]}>
                {savedOpen ? "HIDE" : "SHOW"}
              </Text>
              <Ionicons
                color={theme.colors.textMuted}
                name={savedOpen ? "chevron-up" : "chevron-down"}
                size={18}
              />
            </View>
          </PressOpacity>

          <Animated.View style={[styles.panel, panelStyle]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <SavedWorkoutGrid
                bounded
                error={templatesError}
                loading={templatesLoading}
                onPress={(template) => openEditor(template.format, template)}
                onRetry={() => setFetchRetry((count) => count + 1)}
                templates={templates}
              />
            </ScrollView>
          </Animated.View>
        </View>
      </ScrollView>

      {chooserOpen ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.chooser,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <View
            style={[
              styles.chooserCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
                SELECT PROTOCOL FORMAT
              </Text>
              <Text style={[styles.cardBadgeText, { color: theme.colors.tertiary }]}>
                {selectedDate}
              </Text>
            </View>
            <Text style={[styles.chooserTitle, { color: theme.colors.text }]}>
              Create Session
            </Text>

            {FORMAT_OPTIONS.map((item) => (
              <PressOpacity
                accessibilityLabel={item.title}
                key={item.format}
                onPress={() => {
                  setChooserOpen(false);
                  openEditor(item.format);
                }}
                style={[
                  styles.formatOptionCard,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.formatIconWrap,
                    { backgroundColor: theme.colors.tertiary },
                  ]}
                >
                  <Ionicons color={primaryText} name={item.icon} size={22} />
                </View>
                <View style={styles.formatOptionCopy}>
                  <Text style={[styles.formatOptionTitle, { color: theme.colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.formatOptionDescription,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>
                <Ionicons
                  color={theme.colors.textMuted}
                  name="chevron-forward"
                  size={20}
                />
              </PressOpacity>
            ))}

            <ActionButton
              label="Cancel"
              onPress={() => setChooserOpen(false)}
              tone="quiet"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function toCalendarEvent(session: ConditioningSessionRecord): MonthEvent[] {
  const localDate = calendarDateForSession(session);
  if (!localDate) {
    return [];
  }

  const marker = markerForSessionStatus(session.status);
  return [
    {
      color: timelineCategories.conditioning.color,
      id: session.id,
      localDate,
      status: marker === "draft" ? session.status : marker,
      title: session.title,
    },
  ];
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  activeBannerCard: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  activeBannerCopy: {
    flex: 1,
    gap: 2,
  },
  activeBannerTag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  activeBannerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
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
  cardBadgeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  expander: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
  },
  expanderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  expanderTitle: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  expanderRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  expanderState: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  panel: {
    overflow: "hidden",
  },
  chooser: {
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  chooserCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    maxWidth: 440,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  chooserTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  formatOptionCard: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    minHeight: 68,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  formatIconWrap: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  formatOptionCopy: {
    flex: 1,
    gap: 2,
  },
  formatOptionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  formatOptionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
