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
import { draftFromTemplate } from "../conditioning/drafts";
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

const tokens = themes.dark;

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

  function openEditor(template: ConditioningTemplateRecord) {
    const draft = draftFromTemplate(template.config, selectedDate);
    workspace.openEditor({
      draft,
      format: template.format,
      planSessionId: null,
      savedSnapshot: JSON.stringify(draft),
      templateId: template.id,
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
          label="Free Session"
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
            if (template) openEditor(template);
          }}
          onRetry={() => setFetchRetry((count) => count + 1)}
        />
      </ScrollView>
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
});
