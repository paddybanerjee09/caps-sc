import { formatDisplayDate } from "../../utils/displayDate";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { getSkillSession } from "../../data/skillRepository";
import { FOCUS_PRESENTATION } from "../../skill/focus";
import {
  activityElapsedLabel,
  activitySettingsLine,
  focusLabel,
  formatElapsed,
  formatKcal,
  weightBasisText,
} from "../../skill/present";
import type { SkillActivityRecord, SkillSessionRecord } from "../../skill/types";
import { useSkillWorkspace } from "../../state/SkillWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function SkillSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useSkillWorkspace();
  const [session, setSession] = useState<SkillSessionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspace.registerBackHandler(() => {
      workspace.pop();
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    void getSkillSession(db, sessionId)
      .then((row) => {
        if (!cancelled) {
          setSession(row);
          setError(row ? null : "This session could not be found.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("This session could not be found.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, sessionId]);

  const focus = session ? FOCUS_PRESENTATION[session.focus] : null;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={session?.title ?? "Skill session"} onClose={workspace.resetWorkspace} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Text style={[styles.error, { color: theme.colors.tertiary }]}>{error}</Text> : null}
        {session && focus ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>LOGGED</Text>
            <Text style={[styles.metric, { color: theme.colors.text }]}>
              {formatWhen(session.startedAt)} – {formatWhen(session.endedAt)}
            </Text>
            <View style={styles.focusRow}>
              <View style={[styles.swatch, { backgroundColor: focus.color }]} />
              <Text style={[styles.body, { color: theme.colors.text }]}>
                {focusLabel(session.focus)}
              </Text>
            </View>
            <Text style={[styles.metric, { color: theme.colors.text }]}>
              {formatElapsed(session.elapsedSeconds)}
            </Text>
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
              ESTIMATED CALORIES
            </Text>
            <Text style={[styles.metric, { color: theme.colors.text }]}>
              {formatKcal(session.energyKcal)}
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
              {weightBasisText(session.weightBasis, session.weightKg)}
            </Text>
          </View>
        ) : null}
        {session?.activities.map((activity, index) => (
          <ActivityCard activity={activity} index={index} key={activity.id} />
        ))}
      </ScrollView>
      <WorkflowFooter onBack={workspace.pop} backLabel={workspace.stack.length > 1 ? "Back" : "Cancel"} />
    </View>
  );
}

function ActivityCard({
  activity,
  index,
}: {
  activity: SkillActivityRecord;
  index: number;
}) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
        ACTIVITY {index + 1}
      </Text>
      <Text style={[styles.body, { color: theme.colors.text }]}>{activity.name}</Text>
      <Text style={[styles.metric, { color: theme.colors.text }]}>
        {activityElapsedLabel(activity)}
      </Text>
      <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
        {activitySettingsLine(activity)}
      </Text>
      <Text style={[styles.metric, { color: theme.colors.text }]}>
        {formatKcal(activity.energyKcal)}
      </Text>
    </View>
  );
}

function formatWhen(ms: number) {
  const date = new Date(ms);
  const day = formatDisplayDate(date);
  const clock = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} ${clock}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  headerHit: { alignSelf: "flex-start", justifyContent: "center", minHeight: 48, minWidth: 48 },
  headerAction: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "800" },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  metric: { fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "800" },
  body: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, lineHeight: 18 },
  focusRow: { alignItems: "center", flexDirection: "row", gap: tokens.spacing.sm },
  swatch: { borderRadius: 6, height: 12, width: 12 },
  error: { fontSize: 14, fontWeight: "700" },
});
