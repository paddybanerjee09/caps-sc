import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ScreenTitleCard } from "../components/ScreenTitleCard";
import { ActionButton } from "../components/ActionButton";
import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { SavedWorkouts } from "../components/training/SavedWorkouts";
import { TrainingSessionActions } from "../components/training/TrainingSessionActions";
import { buildMonthGrid, type MonthEvent } from "../components/monthGrid";
import { formatLocalDate } from "../conditioning/dates";
import {
  createLogDraft,
  createTemplateDraft,
  draftFromTemplate,
} from "../strength/drafts";
import { emphasisMarkerColor } from "../strength/emphasis";
import {
  getStrengthTemplate,
  listStrengthSessionsForDates,
  listStrengthTemplates,
  type StrengthSessionSummary,
  type StrengthTemplateSummary,
} from "../data/strengthRepository";
import { useStrengthWorkspace } from "../state/StrengthWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { feedbackWarn } from "../utils/feedback";

const tokens = themes.dark;

function draftForSavedTemplate(
  template: NonNullable<Awaited<ReturnType<typeof getStrengthTemplate>>>,
) {
  return draftFromTemplate(template, Date.now());
}

export function StrengthTrainingScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useStrengthWorkspace();
  const today = formatLocalDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { monthIndex: now.getMonth(), year: now.getFullYear() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [sessions, setSessions] = useState<StrengthSessionSummary[]>([]);
  const [templates, setTemplates] = useState<StrengthTemplateSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const fetchKey = `${month.year}:${month.monthIndex}:${selectedDate}:${workspace.revision}`;
  const loading = loadedKey !== fetchKey;

  const load = useCallback(async () => {
    const grid = buildMonthGrid({
      events: [],
      monthIndex: month.monthIndex,
      selectedDate,
      today,
      year: month.year,
    });
    const start = grid.cells[0]?.isoDate ?? today;
    const end = grid.cells.at(-1)?.isoDate ?? today;
    const [logged, saved] = await Promise.all([
      listStrengthSessionsForDates(db, start, end),
      listStrengthTemplates(db),
    ]);
    return { logged, saved };
  }, [db, month.monthIndex, month.year, selectedDate, today]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((result) => {
        if (!cancelled) {
          setSessions(result.logged);
          setTemplates(result.saved);
          setLoadError(null);
          setLoadedKey(fetchKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Couldn’t load strength.");
          setLoadedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, load]);

  const events = useMemo<MonthEvent[]>(
    () =>
      sessions.map((session) => ({
        color: session.emphasis.primary
          ? emphasisMarkerColor(session.emphasis)
          : theme.colors.textMuted,
        id: session.id,
        localDate: session.localEndDate,
        status: "logged",
        title: session.title,
      })),
    [sessions, theme.colors.textMuted],
  );

  async function openSaved(templateId: string) {
    try {
      const template = await getStrengthTemplate(db, templateId);
      if (!template || template.archivedAt) {
        feedbackWarn();
        setTemplateError("That saved workout is no longer available.");
        return;
      }
      workspace.openBuilder(draftForSavedTemplate(template), "log");
    } catch {
      feedbackWarn();
      setTemplateError("Couldn’t open that saved workout. Try again.");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenTitleCard title="Strength" />
        {loadError ? (
          <ActionButton label={`${loadError} Retry`} onPress={() => workspace.bumpRevision()} tone="quiet" />
        ) : null}
        <MonthlyTimelineComponent
          emptyLabel={loading ? "Loading sessions…" : loadError ? "Couldn’t load sessions" : "No strength workout logged"}
          events={events}
          monthIndex={month.monthIndex}
          onEventPress={(event) => workspace.openDetail(event.id)}
          onMonthChange={setMonth}
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          today={today}
          year={month.year}
        />
        <TrainingSessionActions
          onFreeSession={() => workspace.openBuilder(createLogDraft(Date.now()), "log")}
          onCreateSession={() => workspace.openBuilder(createTemplateDraft(), "template")}
        />
        <SavedWorkouts
          entries={templates}
          error={templateError ?? loadError}
          loading={loading}
          onRetry={() => {
            setTemplateError(null);
            workspace.bumpRevision();
          }}
          onSelect={(id) => { void openSaved(id); }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
});
