import { formatDisplayDate } from "../../utils/displayDate";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { PressOpacity } from "../../components/PressOpacity";
import { createId } from "../../conditioning/ids";
import {
  getStrengthSession,
  type StrengthSessionRecord,
} from "../../data/strengthRepository";
import { formatDurationSeconds } from "../../strength/duration";
import {
  emphasisHeadline,
  emphasisMarkerColor,
} from "../../strength/emphasis";
import { tableField } from "../../strength/drafts";
import type { StrengthExerciseRecord } from "../../strength/types";
import { formatRestSeconds, formatRir, formatRpe, formatSetLoad } from "../../strength/units";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function StrengthSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { unitSettings } = useAppState();
  const workspace = useStrengthWorkspace();
  const [session, setSession] = useState<StrengthSessionRecord | null>(null);
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
    void getStrengthSession(db, sessionId)
      .then((row) => {
        if (!cancelled) {
          setSession(row);
          setError(row ? null : "This workout could not be found.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("This workout could not be found.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, sessionId]);

  const color = session ? emphasisMarkerColor(session.emphasis) : theme.colors.textMuted;
  const planned = session?.status === "planned";

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={session?.title ?? "Workout"} onClose={workspace.closeBranch} />
      <FlatList
        contentContainerStyle={styles.content}
        data={session?.exercises ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {error ? (
              <Text style={[styles.hint, { color: theme.colors.tertiary }]}>{error}</Text>
            ) : null}
            {session ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
                ]}
              >
                <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
                  {planned ? "PLANNED START" : "COMPLETED END"}
                </Text>
                <Text style={[styles.metric, { color: theme.colors.text }]}>
                  {formatWhen(planned ? session.startedAt : session.endedAt)}
                </Text>
                <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                  Estimated duration {formatDurationSeconds(session.durationSeconds)}
                </Text>
                <PressOpacity
                  accessibilityLabel={`Estimated focus ${emphasisHeadline(session.emphasis)}`}
                  onPress={() =>
                    workspace.push({ key: createId(), name: "emphasis", sessionId: session.id })
                  }
                  style={[styles.focus, { borderColor: color, backgroundColor: theme.colors.surfaceMuted }]}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.headerAction, { color: theme.colors.text }]}>
                    Estimated focus · {emphasisHeadline(session.emphasis)}
                  </Text>
                </PressOpacity>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ExerciseCard exercise={item} unit={unitSettings.weight} />
        )}
      />
      <WorkflowFooter onBack={workspace.pop} backLabel={workspace.stack.length > 1 ? "Back" : "Cancel"} />
    </View>
  );
}

function ExerciseCard({
  exercise,
  unit,
}: {
  exercise: StrengthExerciseRecord;
  unit: "metric" | "imperial";
}) {
  const { theme } = useAppTheme();
  const sets = exercise.sets;
  const target = exercise.target;
  const skipped = sets.filter((set) => set.skipped).length;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
      ]}
    >
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
        {exercise.unilateral ? "PER SIDE" : exercise.equipment.toUpperCase()}
      </Text>
      <Text style={[styles.exercise, { color: theme.colors.text }]}>{exercise.name}</Text>
      {target ? (
        <>
          <Text style={[styles.metric, { color: theme.colors.text }]}>
            {target.sets} sets · {target.repRange}{target.repRange === "1RM" ? "" : " reps"}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Target RPE {formatRpe(target.rpe)} · Target RIR {formatRir(target.rir)} · Rest {formatRestSeconds(target.restSeconds)}
          </Text>
          {sets.map((set) => (
            <Text key={set.id} style={[styles.hint, { color: theme.colors.text }]}>
              Set {set.position + 1} · {set.reps} reps · RPE {formatRpe(set.rpe)} · RIR {formatRir(set.rir)}
            </Text>
          ))}
        </>
      ) : (
        <>
          <Text style={[styles.metric, { color: theme.colors.text }]}>
        {tableField(sets, (set) => formatSetLoad(exercise.loadMode, set.loadKg, set.assistanceKg, unit))}
        {" · "}
        {skipped > 0 ? `${exercise.sets.length} sets, ${skipped} skipped` : `${exercise.sets.length} sets`}
        {" · "}
        {tableField(sets, (set) => String(set.reps))} reps
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
        RPE {tableField(sets, (set) => formatRpe(set.rpe))} · Rest{" "}
        {tableField(sets, (set) => formatRestSeconds(set.restSeconds))}
        {exercise.explosiveIntent ? " · Explosive" : ""}
          </Text>
        </>
      )}
      {exercise.notes ? (
        <Text style={[styles.hint, { color: theme.colors.text }]}>{exercise.notes}</Text>
      ) : null}
    </View>
  );
}

function formatWhen(instant: number) {
  const date = new Date(instant);
  return `${formatDisplayDate(date)} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  headerBlock: { gap: tokens.spacing.sm },
  headerHit: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 64,
  },
  headerAction: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "800" },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  metric: { fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "800" },
  hint: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  focus: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  dot: { borderRadius: 6, height: 12, width: 12 },
  exercise: { fontSize: 18, fontWeight: "800" },
});
