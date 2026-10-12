import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSQLiteContext } from "expo-sqlite";

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
import { themes } from "../theme/theme";
import type { StructuredFormat } from "../conditioning/types";

const tokens = themes.dark;
const SAVED_PANEL_HEIGHT = 228;

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
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<ConditioningSessionRecord | null>(null);
  const panel = useSharedValue(0);

  const load = useCallback(async () => {
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
    setEvents(sessions.flatMap(toCalendarEvent));
    setTemplates(saved);
    setActiveSession(active);
    setTemplatesLoading(false);
    setTemplatesError(null);
  }, [db, month.monthIndex, month.year, selectedDate, today]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    void load().catch(() => {
      if (!cancelled) {
        setTemplatesError("Couldn’t load conditioning");
        setTemplatesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, workspace.revision]);

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
    setSavedOpen(next);
    panel.set(
      withTiming(next ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) }),
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

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>Conditioning</Text>
        <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
        {activeSession ? (
          <PressOpacity
            accessibilityLabel="Return to active session"
            onPress={() =>
              workspace.push(
                activeSession.format === "free"
                  ? { key: `free-${activeSession.id}`, name: "free" }
                  : { key: `runner-${activeSession.id}`, name: "runner", sessionId: activeSession.id },
              )
            }
            style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
              Return to {activeSession.title}
            </Text>
          </PressOpacity>
        ) : null}
        <MonthlyTimelineComponent
          emptyLabel="No conditioning on this date"
          events={events}
          monthIndex={month.monthIndex}
          onEventPress={(event) =>
            workspace.push({ key: `detail-${event.id}`, name: "detail", sessionId: event.id })
          }
          onMonthChange={setMonth}
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          today={today}
          year={month.year}
        />
        <ActionButton label="Free Session" onPress={() => workspace.push({ key: `free-${Date.now()}`, name: "free" })} />
        <ActionButton
          label="Browse saved workouts"
          onPress={() => workspace.push({ key: `saved-${Date.now()}`, name: "saved" })}
          tone="quiet"
        />
        <ActionButton
          label="Create Session"
          onPress={() => setChooserOpen(true)}
          tone="secondary"
        />
        <PressOpacity
          accessibilityLabel="Saved workouts"
          accessibilityState={{ expanded: savedOpen }}
          onPress={toggleSaved}
          style={[styles.expander, { borderColor: theme.colors.border }]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Saved Workouts</Text>
          <Text style={{ color: theme.colors.textMuted }}>{savedOpen ? "Hide" : "Show"}</Text>
        </PressOpacity>
        <Animated.View style={[styles.panel, panelStyle]}>
          <ScrollView nestedScrollEnabled>
            <SavedWorkoutGrid
              error={templatesError}
              loading={templatesLoading}
              onPress={(template) => openEditor(template.format, template)}
              onRetry={() => {
                setTemplatesLoading(true);
                void load();
              }}
              templates={templates}
            />
          </ScrollView>
        </Animated.View>
      </ScrollView>
      {chooserOpen ? (
        <View style={[StyleSheet.absoluteFill, styles.chooser, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.chooserCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.chooserTitle, { color: theme.colors.text }]}>Create session</Text>
            {(["time_interval", "sprint", "circuit"] as const).map((format) => (
              <ActionButton
                key={format}
                label={format === "time_interval" ? "Time Interval" : format === "sprint" ? "Sprints" : "Circuit"}
                onPress={() => {
                  setChooserOpen(false);
                  openEditor(format);
                }}
              />
            ))}
            <ActionButton label="Cancel" onPress={() => setChooserOpen(false)} tone="quiet" />
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
    paddingTop: tokens.spacing.xl,
  },
  title: {
    fontSize: tokens.typography.title.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
  banner: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.md,
  },
  expander: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
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
    gap: tokens.spacing.sm,
    maxWidth: 420,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  chooserTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: "700",
    textAlign: "center",
  },
});
