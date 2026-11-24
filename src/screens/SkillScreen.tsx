import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ScreenTitleCard } from "../components/ScreenTitleCard";
import { ActionButton } from "../components/ActionButton";
import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { SavedWorkouts } from "../components/training/SavedWorkouts";
import { TrainingSessionActions } from "../components/training/TrainingSessionActions";
import { buildMonthGrid, parseIsoDate, type MonthEvent } from "../components/monthGrid";
import { formatLocalDate } from "../conditioning/dates";
import {
  getSkillTemplate,
  listSkillSessionsForDates,
  listSkillTemplates,
} from "../data/skillRepository";
import { createSkillDraft, draftFromTemplate } from "../skill/drafts";
import { FOCUS_PRESENTATION } from "../skill/focus";
import type { SkillFocus, SkillSessionSummary } from "../skill/types";
import { useSkillWorkspace } from "../state/SkillWorkspaceContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import { feedbackWarn } from "../utils/feedback";

const tokens = themes.dark;

const focusOrder: SkillFocus[] = ["muay_thai", "boxing", "bjj", "mixed", "general"];

type SavedRow = { id: string; title: string };

export function SkillTrainingScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useSkillWorkspace();
  const today = formatLocalDate(new Date());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { monthIndex: now.getMonth(), year: now.getFullYear() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [sessions, setSessions] = useState<SkillSessionSummary[]>([]);
  const [templates, setTemplates] = useState<SavedRow[]>([]);
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
      listSkillSessionsForDates(db, start, end),
      listSkillTemplates(db),
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
          setLoadError("Couldn’t load skills.");
          setLoadedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchKey, load]);

  const focusDate = workspace.calendarDate;
  const focusNonce = workspace.calendarNonce;
  const [seenFocus, setSeenFocus] = useState(0);
  if (focusDate && focusNonce !== seenFocus && workspace.stack.length === 0) {
    setSeenFocus(focusNonce);
    setSelectedDate(focusDate);
    const parsed = parseIsoDate(focusDate);
    if (parsed) {
      setMonth({ monthIndex: parsed.monthIndex, year: parsed.year });
    }
  }

  const events = useMemo<MonthEvent[]>(
    () =>
      sessions.map((session) => {
        const focus = FOCUS_PRESENTATION[session.focus];
        return {
          color: focus.color,
          detail: `${focus.label} · ${formatClock(new Date(session.endedAt))}`,
          id: session.id,
          localDate: session.localEndDate,
          status: "logged",
          title: session.title,
        };
      }),
    [sessions],
  );

  async function openSaved(templateId: string) {
    try {
      const template = await getSkillTemplate(db, templateId);
      if (!template || template.archivedAt) {
        feedbackWarn();
        setTemplateError("That saved session is no longer available.");
        return;
      }
      workspace.openBuilder(draftFromTemplate(template, Date.now()));
    } catch {
      feedbackWarn();
      setTemplateError("Couldn’t open that saved session. Try again.");
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ScreenTitleCard title="Skill" />
        {loadError ? (
          <ActionButton label={`${loadError} Retry`} onPress={() => workspace.bumpRevision()} tone="quiet" />
        ) : null}
        <MonthlyTimelineComponent
          emptyLabel={loading ? "Loading sessions…" : loadError ? "Couldn’t load sessions" : "No skill session logged"}
          events={events}
          monthIndex={month.monthIndex}
          onEventPress={(event) => workspace.openDetail(event.id)}
          onMonthChange={setMonth}
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          today={today}
          year={month.year}
        />
        <View
          accessibilityLabel="Focus colours"
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>FOCUS</Text>
          <View style={styles.legend}>
            {focusOrder.map((focus) => (
              <View key={focus} style={styles.legendItem}>
                <View
                  style={[styles.swatch, { backgroundColor: FOCUS_PRESENTATION[focus].color }]}
                />
                <Text style={[styles.legendLabel, { color: theme.colors.text }]}>
                  {FOCUS_PRESENTATION[focus].label}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <TrainingSessionActions
          onFreeSession={() => workspace.openBuilder(createSkillDraft(Date.now()))}
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

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 32,
  },
  swatch: { borderRadius: 6, height: 12, width: 12 },
  legendLabel: { fontSize: 13, fontWeight: "700" },
});
