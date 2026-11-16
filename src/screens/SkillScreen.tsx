import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSQLiteContext } from "expo-sqlite";

import { MonthlyTimelineComponent } from "../components/MonthlyTimelineComponent";
import { PressOpacity } from "../components/PressOpacity";
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
import { readableTextColor, themes } from "../theme/theme";
import { feedbackToggle, feedbackWarn } from "../utils/feedback";

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
  const [savedOpen, setSavedOpen] = useState(false);
  const panel = useSharedValue(savedOpen ? 1 : 0);
  const primaryText = readableTextColor(theme.colors.tertiary);

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Couldn’t load skills.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, workspace.revision]);

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

  const savedStyle = useAnimatedStyle(() => ({
    opacity: panel.get(),
  }));

  async function openSaved(templateId: string, endedAt: number) {
    const template = await getSkillTemplate(db, templateId);
    if (!template || template.archivedAt) {
      feedbackWarn();
      setLoadError("That saved session is no longer available.");
      workspace.bumpRevision();
      return;
    }
    workspace.openBuilder(draftFromTemplate(template, endedAt));
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={savedOpen ? templates : []}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          savedOpen ? (
            <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
              No saved sessions.
            </Text>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {loadError ? (
              <PressOpacity
                accessibilityLabel="Retry loading skills"
                onPress={() => workspace.bumpRevision()}
                style={[
                  styles.secondary,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                  {loadError} Tap to retry.
                </Text>
              </PressOpacity>
            ) : null}

            <MonthlyTimelineComponent
              emptyLabel="No skill session logged"
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

            <PressOpacity
              accessibilityLabel="Build skill session"
              onPress={() => workspace.openBuilder(createSkillDraft(Date.now()))}
              style={[styles.primary, { backgroundColor: theme.colors.tertiary }]}
            >
              <Text style={[styles.primaryText, { color: primaryText }]}>
                Build Skill Session
              </Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel="Saved sessions"
              accessibilityState={{ expanded: savedOpen }}
              onPress={toggleSaved}
              style={[
                styles.secondary,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                Saved Sessions
              </Text>
              <Text style={[styles.count, { color: theme.colors.textMuted }]}>
                {templates.length}
              </Text>
            </PressOpacity>
          </View>
        }
        renderItem={({ item }: { item: SavedRow }) => (
          <Animated.View style={savedStyle}>
            <PressOpacity
              accessibilityLabel={`Open saved session ${item.title}`}
              onPress={() => {
                void openSaved(item.id, Date.now());
              }}
              style={[
                styles.savedRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.savedTitle, { color: theme.colors.text }]}>{item.title}</Text>
            </PressOpacity>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  header: { gap: tokens.spacing.md, marginBottom: tokens.spacing.sm },
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
  primary: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryText: { fontSize: 16, fontWeight: "700" },
  secondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  count: { fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "700" },
  savedRow: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  savedTitle: { fontSize: 15, fontWeight: "700" },
  empty: { fontSize: 14, paddingVertical: tokens.spacing.sm },
});
