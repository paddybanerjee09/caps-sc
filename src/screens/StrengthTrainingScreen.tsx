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
import { readableTextColor, themes } from "../theme/theme";
import { feedbackToggle, feedbackWarn } from "../utils/feedback";

const tokens = themes.dark;

function draftForSavedTemplate(
  template: NonNullable<Awaited<ReturnType<typeof getStrengthTemplate>>>,
) {
  return draftFromTemplate(template, Date.now());
}

type SavedRow = StrengthTemplateSummary;

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Couldn’t load strength.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, workspace.revision]);

  const events = useMemo<MonthEvent[]>(
    () =>
      sessions.map((session) => ({
        color: emphasisMarkerColor(session.emphasis),
        id: session.id,
        localDate: session.localEndDate,
        status: "completed",
        title: session.title,
      })),
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

  async function openSaved(templateId: string) {
    const template = await getStrengthTemplate(db, templateId);
    if (!template || template.archivedAt) {
      feedbackWarn();
      setLoadError("That saved workout is no longer available.");
      workspace.bumpRevision();
      return;
    }
    workspace.openBuilder(draftForSavedTemplate(template), "log");
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
              No saved workouts.
            </Text>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <View style={[styles.accent, { backgroundColor: theme.colors.tertiary }]} />
              <View style={styles.bannerText}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Strength</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                  Log a workout or save one to repeat.
                </Text>
              </View>
            </View>

            {loadError ? (
              <PressOpacity
                accessibilityLabel="Retry loading strength"
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
              emptyLabel="No strength workout logged"
              events={events}
              monthIndex={month.monthIndex}
              onEventPress={(event) => workspace.openDetail(event.id)}
              onMonthChange={setMonth}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              today={today}
              year={month.year}
            />

            <PressOpacity
              accessibilityLabel="Log workout"
              onPress={() => workspace.openBuilder(createLogDraft(Date.now()), "log")}
              style={[styles.primary, { backgroundColor: theme.colors.tertiary }]}
            >
              <Text style={[styles.primaryText, { color: primaryText }]}>Log Workout</Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel="Create workout"
              onPress={() => workspace.openBuilder(createTemplateDraft(), "template")}
              style={[
                styles.secondary,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                Create Workout
              </Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel="Saved workouts"
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
                Saved Workouts
              </Text>
              <Text
                style={[
                  styles.count,
                  { color: theme.colors.textMuted },
                ]}
              >
                {templates.length}
              </Text>
            </PressOpacity>
          </View>
        }
        renderItem={({ item }: { item: SavedRow }) => (
          <Animated.View style={savedStyle}>
            <PressOpacity
              accessibilityLabel={`Log ${item.title}`}
              onPress={() => {
                void openSaved(item.id);
              }}
              style={[
                styles.savedRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.savedTitle, { color: theme.colors.text }]}>
                {item.title}
              </Text>
            </PressOpacity>
          </Animated.View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  header: {
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  banner: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.md,
    overflow: "hidden",
  },
  accent: {
    alignSelf: "stretch",
    width: 6,
  },
  bannerText: {
    flex: 1,
    gap: 2,
    paddingVertical: tokens.spacing.lg,
    paddingRight: tokens.spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  primary: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
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
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  count: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  savedRow: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: tokens.spacing.sm,
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  savedTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  empty: {
    fontSize: 14,
    paddingVertical: tokens.spacing.md,
  },
});
