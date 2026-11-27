import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { TrainingMetricValue } from "../../components/training/TrainingMetricValue";
import { deviceTimeZone } from "../../conditioning/dates";
import { getStrengthSession, getStrengthStimulusContext } from "../../data/strengthRepository";
import { trainingMetric, type MetricResult } from "../../domain/training/metric";
import { localDateInZone } from "../../recovery/dates";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { calculateStrengthStimulus, strengthStimulusFromDraft } from "../../strength/stimulus";
import { formatLoadAmount } from "../../strength/units";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { formatDisplayDate } from "../../utils/displayDate";

const tokens = themes.dark;
const title = "Estimated training stimulus";
const descriptions = {
  hypertrophy: "Log actual reps in reserve (RIR) for a working set with catalog muscle tags.",
  max: "Log actual load and reps for a free-weight lift. Mark an earlier completed single as a tested 1RM for the same lift and setup.",
  endurance: "Record a completed set with actual repetitions or a timed hold.",
  power: "Choose Explosive as the actual set intent to log explosive-intent exposure.",
  measuredPower: "Measured power needs compatible per-rep readings in watts.",
};

function missing(metricId: string, requirement: string) {
  return trainingMetric({
    metricId, status: "unavailable", value: null, unit: "", method: "Needs input",
    coverage: { valid: 0, total: 0 }, missingInputs: [requirement], reasonCodes: ["missing"],
  });
}

function StimulusCard({ heading, children }: { heading: string; children: ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.colors.textMuted }]}>{heading}</Text>
      {children}
    </View>
  );
}

function Detail({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return <Text style={[styles.detail, { color: theme.colors.textMuted }]}>{children}</Text>;
}

function RowLabel({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{children}</Text>;
}

export function StrengthAdaptationsScreen({ sessionId }: { sessionId: string | null }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { unitSettings } = useAppState();
  const workspace = useStrengthWorkspace();
  const [result, setResult] = useState<ReturnType<typeof calculateStrengthStimulus> | null>(null);

  useEffect(() => {
    workspace.registerBackHandler(() => { workspace.pop(); return true; });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  const draft = workspace.draft;
  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = sessionId ? await getStrengthSession(db, sessionId) : null;
      const workout = sessionId ? saved : draft;
      if (!workout) return;
      const status = saved?.status ?? draft?.sessionMode ?? "completed";
      const id = sessionId ?? draft?.sessionId ?? "";
      const exercises = saved?.exercises ?? strengthStimulusFromDraft(draft?.exercises ?? []);
      const input = { exercises, sessionId: id, endedAt: workout.endedAt, status };
      const now = Date.now();
      const history = status === "completed" && workout.endedAt <= now
        ? await getStrengthStimulusContext(
          db, id, workout.endedAt, saved?.localDate ?? localDateInZone(workout.endedAt, deviceTimeZone()),
          exercises.flatMap((exercise) => exercise.catalogExerciseId ? [exercise.catalogExerciseId] : []),
        ).catch(() => undefined)
        : undefined;
      if (active) setResult(calculateStrengthStimulus({ ...input, ...history, now }));
    })().catch(() => {
      if (active) setResult(null);
    });
    return () => { active = false; };
  }, [db, draft, sessionId]);

  const groups = result?.exercises ?? [];
  const muscles = result?.hypertrophy ?? [];
  const manualAction = sessionId ? {} : { onAction: workspace.pop, actionLabel: "Return to the set editor" };
  function explain(label: string, metric: MetricResult, explanation: string, canLog = true) {
    return <TrainingMetricValue label={label} metric={metric} explanation={explanation} {...(canLog ? manualAction : {})} />;
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={title} onClose={workspace.closeBranch} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Detail>Workout-level exposure estimates</Detail>
        <StimulusCard heading="Hypertrophy by muscle">
          {muscles.length ? muscles.map(({ muscle, recentWorkingSets, limitedEvidence, workingSets, weighted }) => (
            <View key={muscle} style={styles.group}>
              <RowLabel>{muscle}</RowLabel>
              {explain(`${muscle} hypertrophy exposure`, weighted, descriptions.hypertrophy)}
              <Detail>{workingSets.value} tagged working sets · {weighted.coverage.valid}/{weighted.coverage.total} with RIR</Detail>
              <Detail>{recentWorkingSets} logged sets over 7 days{limitedEvidence ? ` · ${limitedEvidence} with limited load evidence` : ""}</Detail>
            </View>
          )) : explain("hypertrophy", missing("strength.hypertrophy", "tagged completed working sets"), descriptions.hypertrophy)}
        </StimulusCard>
        <StimulusCard heading="Maximal strength by lift">
          {groups.length ? groups.map((item) => (
            <View key={item.id} style={styles.group}>
              <RowLabel>{item.label} · {item.equipment}</RowLabel>
              {explain(`${item.label} maximal strength`, item.max, item.aboveReference
                ? "A completed load exceeds the earlier 1RM for this setup. Record an updated compatible test to score comparable future sets."
                : descriptions.max)}
              <Detail>{item.practiceSets} observed practice sets{item.loadKg.length ? ` · ${formatLoadAmount(Math.min(...item.loadKg), unitSettings.weight)}–${formatLoadAmount(Math.max(...item.loadKg), unitSettings.weight)}` : ""}</Detail>
              {item.relativeLoads.length ? <Detail>{[...new Set(item.relativeLoads.map((value) => `${(value * 100).toFixed(1)}%`))].join(", ")} of prior 1RM</Detail> : null}
              {item.referenceDates.length ? <Detail>Tested {item.referenceDates.map((value) => formatDisplayDate(new Date(value))).join(", ")}</Detail> : null}
              {item.rom.length ? <Detail>Range of motion · {item.rom.join(", ")}</Detail> : null}
              {item.aboveReference && item.max.value !== null ? <Detail>Some loads exceeded their earlier 1RM.</Detail> : null}
            </View>
          )) : explain("maximal strength", missing("strength.maximalStrength", "actual reps and compatible 1RM"), descriptions.max)}
        </StimulusCard>
        <StimulusCard heading="Local muscular endurance">
          {groups.length ? groups.map((item) => (
            <View key={item.id} style={styles.group}>
              <RowLabel>{item.label}</RowLabel>
              {item.repetitions.value !== null ? explain(`${item.label} repetitions`, item.repetitions, descriptions.endurance) : null}
              {item.holdSeconds.value !== null ? explain(`${item.label} timed holds`, item.holdSeconds, descriptions.endurance) : null}
              {item.longest.value === null
                ? explain(`${item.label} longest continuous bout`, item.longest, "Enter actual work seconds on a completed set.")
                : <Detail>{item.longest.method} · {item.longest.value} s</Detail>}
              {item.rest.value === null
                ? explain(`${item.label} recorded preceding rest`, item.rest, "Log actual preceding rest in seconds for sets within this exercise.")
                : <Detail>{item.rest.method} · {item.rest.value} s</Detail>}
            </View>
          )) : explain("local muscular endurance", missing("strength.endurance", "completed reps or holds"), descriptions.endurance)}
        </StimulusCard>
        <StimulusCard heading="Power by movement">
          {groups.length ? groups.map((item) => (
            <View key={item.id} style={styles.group}>
              <RowLabel>{item.label}</RowLabel>
              {explain(`${item.label} explosive-intent exposure`, item.explosive, descriptions.power)}
              {item.power.length
                ? item.power.map((value) => <View key={value.methodKey}>{explain(`${item.label} mean rep power`, value.mean, descriptions.measuredPower, false)}{explain(`${item.label} best rep power`, value.best, descriptions.measuredPower, false)}</View>)
                : explain(`${item.label} measured rep power`, missing("strength.power.watts", "power measurements"), descriptions.measuredPower, false)}
              {item.velocity.map((value) => <View key={value.methodKey}>{explain(`${item.label} mean concentric velocity`, value.mean, "Concentric velocity needs comparable measured rep speed.", false)}{explain(`${item.label} best concentric velocity`, value.best, "Concentric velocity needs comparable measured rep speed.", false)}</View>)}
              {item.velocityLoss.map(({ setId, result: loss }) => <View key={setId}><Detail>Concentric velocity loss</Detail>{explain("acute velocity loss", loss, "Velocity loss needs comparable rep-level measurements.", false)}</View>)}
            </View>
          )) : explain("power", missing("strength.power", "movement intent or power observations"), descriptions.power)}
        </StimulusCard>
        {groups.length ? <StimulusCard heading="Work context">
          {groups.map((item) => (
            <View key={item.id} style={styles.group}>
              <RowLabel>{item.label}</RowLabel>
              <Detail>External volume-load</Detail>
              {explain(`${item.label} external volume-load`, item.volume, "Enter actual external load and completed reps for the set.")}
              <Detail>Work density</Detail>
              {explain(`${item.label} work density`, item.density, "Enter actual work and preceding rest seconds for consecutive working sets.")}
            </View>
          ))}
        </StimulusCard> : null}
      </ScrollView>
      <WorkflowFooter onBack={workspace.pop} backLabel={workspace.stack.length > 1 ? "Back" : "Cancel"} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.sm, padding: tokens.spacing.lg },
  group: { gap: tokens.spacing.xs, paddingVertical: tokens.spacing.xs },
  heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  rowLabel: { fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  detail: { fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
});
