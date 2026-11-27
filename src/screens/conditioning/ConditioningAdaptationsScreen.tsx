import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ConditioningFooter, ErrorText, ScreenHeading } from "../../components/conditioning/ConditioningFields";
import { TrainingMetricValue } from "../../components/training/TrainingMetricValue";
import { conditioningStimulus } from "../../conditioning/stimulus";
import { messageFromUnknown } from "../../conditioning/validation";
import { getConditioningSession, listConditioningOccurrences, type ConditioningSessionRecord } from "../../data/conditioningRepository";
import type { MetricResult } from "../../domain/training/metric";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { formatDisplayDate } from "../../utils/displayDate";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;
const displayNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const activityNames = { run: "Running", cycling: "Cycling", assault_bike: "Assault Bike", other: "Other or mixed" };

export function ConditioningAdaptationsScreen({ sessionId }: { sessionId: string | null }) {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [loaded, setLoaded] = useState<{
    session: ConditioningSessionRecord | null;
    stimulus: ReturnType<typeof conditioningStimulus> | null;
  } | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !ownerId) return;
    let cancelled = false;
    void (async () => {
      const session = await getConditioningSession(db, ownerId, sessionId);
      if (!session || (session.status !== "completed" && session.status !== "ended_early")) {
        if (!cancelled) setLoaded({ session, stimulus: null });
        return;
      }
      const occurrences = await listConditioningOccurrences(db, ownerId, sessionId);
      const stimulus = conditioningStimulus({
        ...session,
        sessionSeconds: session.activeSeconds ?? (session.source === "manual" ? session.elapsedSeconds : null),
        continuous: session.format === "free",
        expectedWorkBouts: session.snapshot.phases.filter(phase => phase.type === "work").length,
        sprintProtocol: session.format === "sprint",
        observations: session.snapshot.conditioningObservations,
        occurrences,
        now: Date.now(),
      });
      if (!cancelled) setLoaded({ session, stimulus });
    })().catch(caught => { if (!cancelled) setError(messageFromUnknown(caught)); });
    return () => { cancelled = true; };
  }, [db, ownerId, sessionId, workspace.revision]);

  const result = loaded?.stimulus;
  const activity = result?.protocol?.mode ?? (loaded?.session?.activityType === "bike" ? "cycling" : loaded?.session?.activityType);
  const criticalLabel = activity === "run" ? "Distance above critical speed" : "Work above critical power";
  const criticalExplanation = activity === "run" ? "Log observed work times and distances with a compatible critical speed test."
    : "Log measured power and work times with a compatible critical power test. Assault Bike results need the same machine and technique.";
  const aerobicPower = result && (result.vo2.value !== null ? result.vo2 : result.sustained);
  const sprintMetric = result?.test;
  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading title="Estimated training stimulus" />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!error && sessionId && loaded === undefined ? <Text style={{ color: theme.colors.textMuted }}>Loading session</Text> : null}
        {loaded?.session === null ? <ErrorText>Session unavailable</ErrorText> : null}
        {!sessionId || loaded?.session && !result ? (
          <Text style={{ color: theme.colors.textMuted }}>Estimated stimulus appears after you log a completed workout.</Text>
        ) : null}
        {result && aerobicPower && sprintMetric ? (
          <>
            <StimulusCard label="Recorded workout">
              {activity ? <ContextLine>{activityNames[activity]}</ContextLine> : null}
              <Metric label="Work duration" metric={result.work} explanation="Record actual work seconds. A prescribed timer alone does not establish work completed." />
              {result.rest.coverage.total > 0 ? <>
                <Metric label="Rest duration" metric={result.rest} explanation="Enter observed rest seconds between completed bouts, including zero for no rest." />
                <Metric label="Work:rest ratio" metric={result.ratio} explanation="The ratio needs complete recorded work and rest, with a positive total rest duration." />
              </> : null}
              <Metric label="General internal load" metric={result.sessionLoad} explanation="Enter completed session duration and session RPE in Log session, or add the load inputs from the Home timeline." />
            </StimulusCard>
            <StimulusCard label="Aerobic endurance">
              {result.continuous.value !== null ? <Metric label="Continuous work" metric={result.continuous} explanation="" /> : null}
              {result.domains.some(metric => metric.value !== null) ? result.domains.map(metric =>
                <Metric key={metric.metricId} label={effortLabel(metric.metricId)} metric={metric} explanation="Add measured output and compatible tested intensity bounds." />
              ) : result.manualDomains.length ? result.manualDomains.map(metric =>
                <Metric key={metric.metricId} label={effortLabel(metric.metricId)} metric={metric} explanation="Add observed work duration and effort." />
              ) : <Metric label="Work by intensity domain" metric={result.domains[0]} explanation="Log observed work times and effort labels, or add measured output with compatible tested intensity bounds." />}
            </StimulusCard>
            <StimulusCard label="Aerobic power">
              <Metric label={aerobicPower.metricId === result.vo2.metricId ? "Time ≥90% measured VO₂max" : "Sustained-hard minutes"}
                metric={aerobicPower} explanation="Log sustained-hard work and its duration. Time at or above 90% of VO₂max requires measured oxygen uptake and a compatible VO₂max test." />
              {result.oxygenSeconds > 0 ? <ContextLine>{displayNumber.format(result.oxygenSeconds)} s of measured oxygen uptake</ContextLine> : null}
            </StimulusCard>
            <StimulusCard label="Sustained high intensity / repeated effort">
              {result.above.value !== null || result.exposure.value === null
                ? <Metric label={criticalLabel} metric={result.above} explanation={criticalExplanation} />
                : <Metric label="Protocol exposure" metric={result.exposure} explanation="Log sustained-hard or repeated-effort work with actual durations." />}
              <Metric label="Output retention" metric={result.retention} explanation="Log at least two work bouts with comparable measured output." />
            </StimulusCard>
            <StimulusCard label="Sprint quality">
              <Metric label="Sprint quality" metric={sprintMetric} explanation="Sprint quality needs measured output for a short sprint and a comparable earlier best. Enter matched splits or same-machine power in Log session." />
              {result.sprint.value !== null ? <Metric label="Completed short sprint bouts" metric={result.sprint} explanation="" /> : null}
              {result.sprintBest.value !== null ? <Metric label="Best short sprint output" metric={result.sprintBest} explanation="" /> : null}
              {result.sprintDrop.length ? <ContextLine>{result.sprintMeasured}/{result.sprintTotal} comparable short sprint bouts</ContextLine> : null}
              {result.sprintDrop.map(bout => <ContextLine key={bout.position}>
                Bout {bout.position + 1} · {displayNumber.format(bout.output)} {result.sprintUnit} · {displayNumber.format(bout.drop)}% drop-off
              </ContextLine>)}
            </StimulusCard>
            {Object.entries(result.references ?? {}).filter(([key]) => key !== "protocol").map(([name, reference]) =>
              reference && "testDate" in reference ? <ContextLine key={name}>{referenceLabel(name)} · {formatDisplayDate(reference.testDate)}</ContextLine> : null)}
            {result.bouts.length ? <StimulusCard label="Recorded bout order">
              {result.bouts.map(bout => {
                const details = [
                  bout.seconds === null ? null : `${displayNumber.format(bout.seconds)} s work`,
                  bout.rest === null ? null : `${displayNumber.format(bout.rest)} s ${bout.restType ?? ""} rest`.replace("  ", " "),
                  bout.restRpe === undefined ? null : `rest RPE ${bout.restRpe}`,
                  bout.effort ? effortLabel(bout.effort) : null,
                  bout.watts === null ? null : `${displayNumber.format(bout.watts)} W`,
                  bout.distance === null ? null : `${displayNumber.format(bout.distance)} m`,
                  bout.source,
                ].filter(Boolean);
                return <ContextLine key={bout.position}>Bout {bout.position + 1}{details.length ? ` · ${details.join(" · ")}` : ""}</ContextLine>;
              })}
            </StimulusCard> : null}
          </>
        ) : null}
      </ScrollView>
      <ConditioningFooter />
    </View>
  );
}

function effortLabel(key: string) {
  const labels: Record<string, string> = { easy: "Easy", moderate: "Moderate", sustained_hard: "Sustained hard",
    repeated_effort: "Repeated effort", sprint: "Sprint" };
  return labels[key.split(".").at(-1) ?? ""] ?? key;
}

function referenceLabel(key: string) {
  const labels: Record<string, string> = { criticalPower: "Critical power test", criticalSpeed: "Critical speed test",
    vo2max: "VO₂max test", sprintBest: "Prior sprint best", intensityBounds: "Intensity test" };
  return labels[key] ?? key;
}

function StimulusCard({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useAppTheme();
  return <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
    <Text accessibilityRole="header" style={[styles.header, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>
    {children}
  </View>;
}

function ContextLine({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  return <Text style={[styles.context, { color: theme.colors.textMuted }]}>{children}</Text>;
}

function Metric({ label, metric, explanation }: { label: string; metric: MetricResult; explanation: string }) {
  const { theme } = useAppTheme();
  return <View style={styles.metric}>
    <Text style={[styles.metricLabel, { color: theme.colors.text }]}>{label}</Text>
    <TrainingMetricValue label={label.toLowerCase()} metric={metric} explanation={explanation} />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.md, padding: tokens.spacing.lg },
  header: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  metric: { gap: 4 },
  metricLabel: { fontSize: 13, fontWeight: "700" },
  context: { fontSize: 13, fontVariant: ["tabular-nums"] },
});
