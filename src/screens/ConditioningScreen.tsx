import { formatDisplayDate } from "../utils/displayDate";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ScreenTitleCard } from "../components/ScreenTitleCard";
import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { PressOpacity } from "../components/PressOpacity";
import { SavedWorkouts } from "../components/training/SavedWorkouts";
import { TrainingSessionActions } from "../components/training/TrainingSessionActions";
import { ActionButton } from "../components/ActionButton";
import {
  calendarDateForSession,
  formatLocalDate,
  markerForSessionStatus,
} from "../conditioning/dates";
import { createWorkoutDraft, draftFromTemplate } from "../conditioning/drafts";
import { formatName, formatTemplateSummary } from "../conditioning/summaries";
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
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { readableTextColor, themes } from "../theme/theme";
import type { StructuredFormat } from "../conditioning/types";

const tokens = themes.dark;

const FORMAT_OPTIONS: {
  description: string;
  format: StructuredFormat;
  icon: "timer-outline" | "flash-outline" | "repeat-outline";
  title: string;
}[] = [
  {
    description: "Timed work / rest",
    format: "time_interval",
    icon: "timer-outline",
    title: "Time Interval",
  },
  {
    description: "Distance repeats",
    format: "sprint",
    icon: "flash-outline",
    title: "Sprints",
  },
  {
    description: "Station rounds",
    format: "circuit",
    icon: "repeat-outline",
    title: "Circuit",
  },
];

export function ConditioningScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const { unitSettings } = useAppState();
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
  const [activeSession, setActiveSession] = useState<ConditioningSessionRecord | null>(null);

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
        <ScreenTitleCard title="Conditioning" />
        {templatesError ? (
          <ActionButton label={`${templatesError}. Retry`} onPress={() => setFetchRetry((count) => count + 1)} tone="quiet" />
        ) : null}

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

        <MonthlyTimelineComponent
          emptyLabel={templatesLoading ? "Loading sessions…" : templatesError ? "Couldn’t load sessions" : "No conditioning on this date"}
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

        <TrainingSessionActions
          onFreeSession={() => workspace.push({ key: `free-${Date.now()}`, name: "free" })}
          onCreateSession={() => setChooserOpen(true)}
        />

        <SavedWorkouts
          entries={templates.map((template) => ({
            id: template.id,
            title: template.title,
            badge: formatName(template.format),
            summary: formatTemplateSummary(template.config, unitSettings.distance, unitSettings.height),
          }))}
          error={templatesError}
          loading={templatesLoading}
          onSelect={(id) => {
            const template = templates.find((item) => item.id === id);
            if (template) openEditor(template.format, template);
          }}
          onRetry={() => setFetchRetry((count) => count + 1)}
        />
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
                {formatDisplayDate(selectedDate)}
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
