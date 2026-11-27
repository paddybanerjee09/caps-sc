import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ScreenTitleCard } from "../components/ScreenTitleCard";
import { ActionButton } from "../components/ActionButton";
import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { SavedWorkouts } from "../components/training/SavedWorkouts";
import { SessionChooser, type SessionOption } from "../components/training/SessionChooser";
import { TrainingSessionActions } from "../components/training/TrainingSessionActions";
import { buildMonthGrid, type MonthEvent } from "../components/monthGrid";
import { formatLocalDate } from "../conditioning/dates";
import {
  createLogDraft,
  defaultStrengthSessionTime,
  draftFromTemplate,
} from "../strength/drafts";
import { emphasisMarkerColor } from "../strength/emphasis";
import type { StrengthSessionMode } from "../strength/types";
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

const sessionOptions: SessionOption<StrengthSessionMode>[] = [
  {
    value: "planned",
    title: "Planned Session",
    description: "Schedule a future start time and set exercise targets.",
    icon: "calendar-outline",
  },
  {
    value: "completed",
    title: "Current / Completed Session",
    description: "Enter the workout end time and record each set.",
    icon: "checkmark-circle-outline",
  },
];

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
  const [sessionSource, setSessionSource] = useState<{ templateId: string | null } | null>(null);
  const [openingSaved, setOpeningSaved] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
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

  useEffect(() => () => activeRequest.current?.abort(), []);

  const events = useMemo<MonthEvent[]>(
    () =>
      sessions.map((session) => {
        const planned = session.status === "planned";
        const time = new Date(planned ? session.startedAt : session.endedAt)
          .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return {
          color: session.emphasis.primary
            ? emphasisMarkerColor(session.emphasis)
            : theme.colors.textMuted,
          detail: planned ? `Planned · starts ${time}` : `Completed · ended ${time}`,
          id: session.id,
          localDate: session.localDate,
          status: planned ? "planned" : "logged",
          title: session.title,
        };
      }),
    [sessions, theme.colors.textMuted],
  );

  function openChooser(templateId: string | null) {
    setTemplateError(null);
    setSessionSource({ templateId });
  }

  function closeChooser() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setSessionSource(null);
    setOpeningSaved(false);
  }

  async function beginSession(mode: StrengthSessionMode) {
    if (!sessionSource || activeRequest.current) return;

    if (!sessionSource.templateId) {
      closeChooser();
      const draft = createLogDraft(defaultStrengthSessionTime(mode), undefined, mode);
      workspace.openBuilder(draft);
      return;
    }

    const request = new AbortController();
    activeRequest.current = request;
    setOpeningSaved(true);
    try {
      const template = await getStrengthTemplate(db, sessionSource.templateId);
      if (request.signal.aborted) return;
      if (!template || template.archivedAt) {
        feedbackWarn();
        setTemplateError("That saved workout is no longer available.");
        return;
      }
      const draft = draftFromTemplate(template, defaultStrengthSessionTime(mode), undefined, mode);
      workspace.openBuilder(draft);
    } catch {
      if (request.signal.aborted) return;
      feedbackWarn();
      setTemplateError("Couldn’t open that saved workout. Try again.");
    } finally {
      if (!request.signal.aborted) closeChooser();
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
          emptyLabel={loading ? "Loading sessions…" : loadError ? "Couldn’t load sessions" : "No strength sessions on this date"}
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
          onFreeSession={() => openChooser(null)}
        />
        <SavedWorkouts
          entries={templates}
          error={templateError ?? loadError}
          loading={loading}
          onRetry={() => {
            setTemplateError(null);
            workspace.bumpRevision();
          }}
          onSelect={openChooser}
        />
      </ScrollView>
      {sessionSource ? (
        <SessionChooser
          busy={openingSaved}
          onClose={closeChooser}
          onSelect={(mode) => { void beginSession(mode); }}
          options={sessionOptions}
        />
      ) : null}
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
