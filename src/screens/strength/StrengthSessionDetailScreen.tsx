import { formatDisplayDate } from "../../utils/displayDate";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { exerciseTableColumnGap, exerciseTableColumns, exerciseTableLabels } from "../../components/strength/ExerciseTable";
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
import { draftToCompletePlan, tableField } from "../../strength/drafts";
import type { StrengthExerciseRecord } from "../../strength/types";
import { formatRir, formatRpe, formatSetLoad } from "../../strength/units";
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
      <ScrollView contentContainerStyle={styles.content} nestedScrollEnabled>
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
        {session && session.exercises.length > 0 ? (
          <ExerciseRecordTable exercises={session.exercises} unit={unitSettings.weight} />
        ) : null}
      </ScrollView>
      <WorkflowFooter onBack={workspace.pop} backLabel={workspace.stack.length > 1 ? "Back" : "Cancel"}>
        {session?.status === "planned" ? (
          <ActionButton
            label="Log as Completed"
            onPress={() => workspace.openPlanCompletion(draftToCompletePlan(session, Date.now()))}
            style={styles.flex}
          />
        ) : null}
      </WorkflowFooter>
    </View>
  );
}

function ExerciseRecordTable({
  exercises,
  unit,
}: {
  exercises: readonly StrengthExerciseRecord[];
  unit: "metric" | "imperial";
}) {
  const { theme } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const showLegacyLoad = exercises.some((exercise) => !exercise.target);
  const columns = [...exerciseTableColumns, ...(showLegacyLoad ? [76] : []), 115];
  const widths = columns.map((width) => Math.ceil(width * Math.max(1, fontScale)));
  const tableWidth = widths.reduce((total, width) => total + width, 0) + exerciseTableColumnGap * (widths.length - 1);
  const labels = [...exerciseTableLabels, ...(showLegacyLoad ? ["Load"] : []), "Details"];
  const actualLabels = ["Actual sets", "Set #", "Reps", "RPE", "RIR"];

  return (
    <View
      style={[
        styles.exerciseTable,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
      ]}
    >
      <ScrollView horizontal nestedScrollEnabled persistentScrollbar>
        <View style={{ width: tableWidth }}>
          <RecordRow heading labels={labels} values={labels} widths={widths} />
          {exercises.map((exercise) => {
            const { sets, target } = exercise;
            const skipped = sets.filter((set) => set.skipped).length;
            const expanded = expandedId === exercise.id;
            const details = [
              exercise.unilateral ? "Per side" : exercise.equipment,
              !target && exercise.explosiveIntent ? "Explosive" : null,
              skipped ? `${skipped} skipped` : null,
            ].filter(Boolean).join(" · ");
            const values = [
              exercise.name,
              String(target?.sets ?? sets.length),
              target?.repRange ?? tableField(sets, (set) => String(set.reps)),
              target ? formatRpe(target.rpe) : tableField(sets, (set) => formatRpe(set.rpe)),
              target ? formatRir(target.rir) : tableField(sets, (set) => formatRir(set.rir)),
              target
                ? String(target.restSeconds ?? "—")
                : tableField(sets, (set) => String(set.restSeconds ?? "—")),
              exercise.notes.replace(/\s+/g, " ").trim() || "—",
              ...(showLegacyLoad
                ? [target ? "—" : tableField(sets, (set) => formatSetLoad(exercise.loadMode, set.loadKg, set.assistanceKg, unit))]
                : []),
              details,
            ];

            return (
              <View key={exercise.id} style={[styles.exerciseGroup, { borderColor: theme.colors.border }]}>
                <RecordRow
                  labels={labels}
                  values={values}
                  widths={widths}
                  toggle={target && sets.length > 0 ? {
                    expanded,
                    onPress: () => setExpandedId((current) => current === exercise.id ? null : exercise.id),
                  } : undefined}
                />
                {expanded ? (
                  <View style={{ backgroundColor: theme.colors.surfaceMuted }}>
                    <RecordRow heading labels={actualLabels} values={actualLabels} widths={widths} />
                    {sets.map((set) => (
                      <RecordRow
                        key={set.id}
                        labels={actualLabels}
                        values={["", String(set.position + 1), String(set.reps), formatRpe(set.rpe), formatRir(set.rir)]}
                        widths={widths}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function RecordRow({
  heading = false,
  labels,
  values,
  widths,
  toggle,
}: {
  heading?: boolean;
  labels: readonly string[];
  values: readonly string[];
  widths: readonly number[];
  toggle?: { expanded: boolean; onPress: () => void };
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.row, heading && styles.columnHeadingRow]}>
      {values.map((value, index) => {
        if (index === 0 && toggle) {
          return (
            <PressOpacity
              accessibilityLabel={`${value}, actual sets`}
              accessibilityState={{ expanded: toggle.expanded }}
              key={labels[index]}
              onPress={toggle.onPress}
              style={[styles.expandCell, { width: widths[index] }]}
            >
              <Text numberOfLines={1} style={[styles.cell, styles.exerciseName, styles.expandLabel, { color: theme.colors.text }]}>
                {value}
              </Text>
              <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>
                {toggle.expanded ? "▴" : "▾"}
              </Text>
            </PressOpacity>
          );
        }
        return (
          <Text
            accessibilityLabel={heading || index === 0 ? undefined : `${labels[index]} ${value}`}
            accessibilityRole={heading ? "header" : undefined}
            key={labels[index]}
            numberOfLines={1}
            style={[
              styles.cell,
              heading ? styles.columnHeading : index === 0 ? styles.exerciseName : undefined,
              index > 0 && index < 6 && styles.center,
              { color: heading ? theme.colors.textMuted : theme.colors.text, width: widths[index] },
            ]}
          >
            {value}
          </Text>
        );
      })}
    </View>
  );
}

function formatWhen(instant: number) {
  const date = new Date(instant);
  return `${formatDisplayDate(date)} ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  flex: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  headerAction: { fontSize: 16, fontWeight: "700" },
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
  exerciseTable: { borderWidth: 1, borderRadius: tokens.radius.lg, paddingHorizontal: 6 },
  exerciseGroup: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: exerciseTableColumnGap, minHeight: 24, paddingVertical: 3 },
  columnHeadingRow: { minHeight: 24, paddingVertical: 4 },
  cell: { fontSize: 12, fontVariant: ["tabular-nums"] },
  center: { textAlign: "center" },
  columnHeading: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  exerciseName: { fontWeight: "700" },
  expandCell: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 38 },
  expandLabel: { flex: 1, minWidth: 0 },
  chevron: { fontSize: 11 },
});
