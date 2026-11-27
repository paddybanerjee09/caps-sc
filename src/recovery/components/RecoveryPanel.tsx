import { formatDisplayDate } from "../../utils/displayDate";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { PressOpacity } from "../../components/PressOpacity";
import { TrainingMetricValue } from "../../components/training/TrainingMetricValue";
import { deleteImportedHealth, setPreferredSources } from "../../data/recoveryRepository";
import { recentTrainingExposure } from "../../data/recentTrainingExposure";
import { fatigueHistory, observedOutputLoss } from "../../domain/training/fatigue";
import { trainingMetric, type MetricResult } from "../../domain/training/metric";
import { connectHealth, deleteHealthData, disconnectHealth, syncHealth } from "../../health/healthService";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor } from "../../theme/theme";
import { recoveryInputs } from "../indexData";
import { localDateInZone } from "../dates";
import type { HealthMetric } from "../types";
import type { useRecoveryData } from "../useRecoveryData";
import { OutputTestInput, SleepTargetInput, TrainingDayInput } from "./IndexInputs";

type RecoveryData = ReturnType<typeof useRecoveryData>;
const labels: Record<HealthMetric, string> = { rhr: "Resting heart rate", hrv: "HRV", hrr60: "60s heart rate recovery", sleep_duration: "Sleep duration", sleep_efficiency: "Sleep efficiency", respiratory_rate: "Respiratory rate", temperature_deviation: "Skin temperature deviation" };
const descriptions: Record<HealthMetric, string> = { rhr: "Heart rate at rest.", hrv: "Beat-to-beat variation.", hrr60: "Heart-rate drop after exercise.", sleep_duration: "Time spent asleep.", sleep_efficiency: "Time asleep vs. time in bed.", respiratory_rate: "Breaths per minute.", temperature_deviation: "Change from your usual skin temperature." };
const requirements: Record<HealthMetric, string> = { rhr: "Needs a device that records resting heart rate.", hrv: "Needs a device that records HRV.", hrr60: "Needs a standardized heart-rate recovery test.", sleep_duration: "Sync sleep or report sleep times and minutes awake.", sleep_efficiency: "Needs measured sleep and time in bed.", respiratory_rate: "Needs a device that records breathing rate.", temperature_deviation: "Needs comparable skin-temperature readings." };
const metricOrder: HealthMetric[] = ["rhr", "hrv", "hrr60", "sleep_duration", "sleep_efficiency", "respiratory_rate", "temperature_deviation"];

export function RecoveryPanel({ recovery, onQuestionnaire, onHistory, onChanged }: { recovery: RecoveryData; onQuestionnaire: () => void; onHistory: () => void; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState(false);
  const [inputs, setInputs] = useState<"training" | "sleep" | "output" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exposure, setExposure] = useState<{ asOf: number; items: Awaited<ReturnType<typeof recentTrainingExposure>> | null } | null>(null);
  const { data, loading, error, reload } = recovery;
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void recentTrainingExposure(db, data.localDate, data.asOf, data.sessions).then(
      items => { if (!cancelled) setExposure({ asOf: data.asOf, items }); },
      () => { if (!cancelled) setExposure({ asOf: data.asOf, items: null }); },
    );
    return () => { cancelled = true; };
  }, [data, db]);
  const scores = useMemo(() => {
    if (!data) return null;
    const source = recoveryInputs(data);
    return { source, recovery: source.calculate(data.localDate, data.asOf), fatigue: fatigueHistory(data.localDate, data.asOf, data.sessions, data.confirmations).at(-1)! };
  }, [data]);
  async function refresh() { await reload(); onChanged(); }
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setActionError(null);
    try { await work(); await refresh(); }
    catch { setActionError("Couldn’t finish. Try again."); }
    finally { setBusy(false); }
  }
  const text = { color: theme.colors.text };
  const muted = { color: theme.colors.textMuted };
  if (!data || !scores || error) return <View style={styles.block}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading recovery" /> : <Text accessibilityRole="alert" style={text}>Couldn’t load Recovery.</Text>}
    {!loading ? <PressOpacity onPress={() => void reload()} style={styles.button}><Text style={text}>Retry</Text></PressOpacity> : null}
  </View>;
  const questionnaire = data.questionnaire;
  const completed = questionnaire?.status === "completed";
  const { source, recovery: index, fatigue } = scores;
  const current = data.outputs[0];
  const previous = current ? data.outputs.find(item => item.observedAt < current.observedAt && item.comparisonKey === current.comparisonKey && item.direction === current.direction) : undefined;
  const outputLoss = current && previous ? observedOutputLoss(current, previous) : null;
  const recoveryHelp = index.checkIn.readiness === null
    ? "Enter today’s readiness in the morning questionnaire. The index also needs sleep with a personal target or a comparable autonomic reading."
    : index.sleep.latest === null ? "Enter hours asleep for the latest night and set a personal sleep target to calculate the index without a device."
    : index.sleep.targetHours === null ? "Set a personal sleep target to use the latest logged night alongside your check-in."
    : "A current readiness rating and one usable sleep or autonomic domain are required.";
  function latest(metric: HealthMetric) {
    return source.permitted.filter(m => m.metric === metric && m.quality === "valid" && m.localDate === data!.localDate && (!data!.preferred[metric] || m.source === data!.preferred[metric]) && Date.parse(m.measuredUntil ?? m.measuredAt) <= data!.asOf).sort((a,b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt) || a.source.localeCompare(b.source))[0];
  }
  const sleep = latest("sleep_duration");
  const sleepStart = completed && questionnaire.sleepOnset ? questionnaire.sleepOnset : typeof sleep?.metadata?.onset === "string" ? sleep.metadata.onset : null;
  const sleepEnd = completed && questionnaire.wakeTime ? questionnaire.wakeTime : typeof sleep?.metadata?.wake === "string" ? sleep.metadata.wake : null;
  const connected = data.health?.status === "ready" || data.health?.status === "sync_error";
  const provider = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  const connectionHint = data.health?.status === "unsupported" ? /build|Expo Go|bridge/i.test(data.health.error ?? "") ? "Requires a CAPS development build." : "Check health support on this device." : data.health?.status === "sync_error" ? "Check health permissions and retry." : null;
  return <View style={styles.block}>
    <View style={[styles.card, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, muted]}>RECOVERY · {formatDisplayDate(data.localDate)}</Text>
      <View style={styles.row}>
        <Text style={[styles.status, text]}>{completed ? `Completed${questionnaire.completedAt ? ` · ${new Date(questionnaire.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}` : questionnaire?.status === "in_progress" ? "Draft saved" : "Morning check-in due"}</Text>
        <PressOpacity disabled={busy || loading} onPress={onQuestionnaire} style={[styles.button, { backgroundColor: theme.colors.tertiary }]}><Text style={{ color: readableTextColor(theme.colors.tertiary), fontWeight: "700" }}>{completed ? "Edit" : "Questionnaire"}</Text></PressOpacity>
      </View>
      <PressOpacity onPress={onHistory} style={styles.historyButton}><Text style={[styles.small, text]}>Questionnaire history</Text></PressOpacity>
    </View>
    <View style={styles.grid}>
      <Metric title="Fatigue Index" result={fatigue.index} detail="Personal percentile of recent training burden. Higher means more load." explanation={fatigue.completeDays < 14 ? `Confirm workout logs or rest for each of the preceding 14 days. ${fatigue.completeDays} days are complete.` : `The index needs 14 earlier complete daily snapshots. ${fatigue.referenceCount} are available.`} onAction={() => setInputs("training")} actionLabel="Open training day log" />
      <Metric title="Recovery Index" result={index.index} detail="Higher means fewer modeled deficits. 100 means the included inputs raised no deficit." explanation={recoveryHelp}
        onAction={index.checkIn.readiness === null || index.sleep.latest === null ? onQuestionnaire : () => setInputs("sleep")}
        actionLabel={index.checkIn.readiness === null || index.sleep.latest === null ? "Open morning questionnaire" : "Set sleep target"} />
    </View>
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.row}>{([['training', 'Training day log'], ['sleep', 'Sleep target'], ['output', 'Output tests']] as const).map(([key, label]) => <PressOpacity key={key} onPress={() => setInputs(value => value === key ? null : key)} accessibilityState={{ expanded: inputs === key }} style={styles.button}><Text style={text}>{label}</Text></PressOpacity>)}</View>
      {inputs === "training" ? <TrainingDayInput key={data.localDate} today={data.localDate} timezone={data.timezone} sessions={data.sessions} confirmations={data.confirmations} onSaved={refresh} /> : null}
      {inputs === "sleep" ? <SleepTargetInput key={data.localDate} date={data.localDate} timezone={data.timezone} initial={index.sleep.targetHours} onSaved={refresh} /> : null}
      {inputs === "output" ? <OutputTestInput onSaved={refresh} /> : null}
    </View>
    <View style={styles.grid}>
      <Metric title="Recent training burden" result={fatigue.acute} detail={fatigue.acute.status === "available" ? "2-day half-life" : undefined} explanation="Log elapsed time and session RPE, or confirm a rest day." onAction={() => setInputs("training")} actionLabel="Open training day log" />
      <Metric title="Accumulated training load" result={fatigue.accumulated} detail={fatigue.accumulated.status === "available" ? "7-day half-life" : undefined} explanation="Log elapsed time and session RPE, or confirm a rest day." onAction={() => setInputs("training")} actionLabel="Open training day log" />
      <Metric title="Training frequency" value={`${fatigue.observedSessions} logged · 14 days`} detail={fatigue.daysSinceLastHard !== null ? `Last hard session · ${fatigue.daysSinceLastHard} ${fatigue.daysSinceLastHard === 1 ? "day" : "days"} ago` : "No hard session RPE logged."} />
      <Metric title="Observed output loss" value={outputLoss === null ? undefined : `${outputLoss.toFixed(1)}%`} detail={current ? `${current.comparisonKey} · ${formatDisplayDate(localDateInZone(current.observedAt, data.timezone))}` : undefined}
        explanation="Log at least two measurements of the same test, setup and unit." onAction={() => setInputs("output")} actionLabel="Log output test" />
      <Metric title="Readiness check-in" value={index.checkIn.readiness === null ? undefined : `${index.checkIn.readiness} / 10`}
        explanation="Enter an explicit readiness rating in the morning questionnaire." onAction={onQuestionnaire} actionLabel="Open morning questionnaire" />
      <Metric title="Perceived fatigue and soreness" value={completed && (questionnaire.fatigue !== null || questionnaire.soreness !== null) ? `Fatigue ${questionnaire.fatigue ?? "not logged"} · Soreness ${questionnaire.soreness ?? "not logged"}` : "Not logged"} detail={completed && questionnaire.stress !== null ? `Stress ${questionnaire.stress} / 10` : undefined} />
      <Metric title="Fueling context" value={data.foodLogCount ? `${data.foodLogCount} meals logged` : "Not logged"} detail="Food diary · last 3 days" />
      {index.index.value !== null ? <Metric title="Recovery domains used" value={index.index.usedInputs.join(" · ")} /> : null}
      {metricOrder.map(metric => {
        const reading = latest(metric);
        const night = metric === "sleep_duration" ? index.sleep.latest : null;
        const value = night ? `${night.hours.toFixed(1)} h` : reading && metric !== "sleep_duration" ? `${reading.value.toFixed(1)} ${reading.unit}` : undefined;
        const detail = night ? `${night.source} · ${index.sleep.nights.length} valid ${index.sleep.nights.length === 1 ? "night" : "nights"}${index.sleep.targetHours === null ? " · No target set" : ""}` : value === undefined ? undefined : descriptions[metric];
        return <Metric key={metric} title={`${labels[metric]}${metric === "hrv" && reading ? ` · ${reading.subtype}` : ""}`} value={value} detail={detail} explanation={requirements[metric]} onAction={metric === "sleep_duration" ? onQuestionnaire : undefined} actionLabel={metric === "sleep_duration" ? "Open morning questionnaire" : undefined} />;
      })}
      <Metric title="Sleep / wake times" value={sleepStart && sleepEnd ? `${new Date(sleepStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} → ${new Date(sleepEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}` : undefined} explanation="Sync sleep or enter sleep and wake times in your questionnaire." onAction={onQuestionnaire} actionLabel="Open morning questionnaire" />
    </View>
    {exposure?.asOf === data.asOf && (exposure.items === null || exposure.items.length) ? <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, muted]}>OBSERVED TRAINING EXPOSURE · LAST 14 DAYS</Text>
      {exposure.items ? exposure.items.map(item => <Text key={item.id} style={[styles.small, text]}>{item.label} · {Number(item.value.toFixed(2))} {item.unit} across {item.count} logged {item.count === 1 ? "session" : "sessions"}</Text>) : <Text style={[styles.small, muted]}>Couldn’t load exposure details.</Text>}
    </View> : null}
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.row}><Text style={[styles.heading, muted]}>{provider.toUpperCase()}</Text>{data.health?.lastSuccessfulSync ? <Text style={[styles.small, muted]}>Synced {new Date(data.health.lastSuccessfulSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}</View>
      {connectionHint ? <Text accessibilityRole={data.health?.status === "sync_error" ? "alert" : undefined} style={[styles.small, text]}>{connectionHint}</Text> : null}
      <View style={styles.row}>
        <PressOpacity disabled={busy} onPress={() => void action(() => connected ? syncHealth(db) : connectHealth(db))} style={[styles.button, styles.grow, { borderColor: theme.colors.borderStrong, borderWidth: 1 }]}><Text style={text}>{busy ? "Syncing…" : connected ? "Refresh" : "Connect health data"}</Text></PressOpacity>
        <PressOpacity accessibilityState={{ expanded: managing }} onPress={() => setManaging(value => !value)} style={styles.button}><Text style={text}>{managing ? "Done" : "Manage"}</Text></PressOpacity>
      </View>
      {managing ? <>
        {metricOrder.map(metric => {
          const sources = [...new Set(data.measurements.filter(m => m.metric === metric && m.quality === "valid").map(m => m.source))].sort();
          return sources.length > 1 ? <View key={metric} style={styles.sources}><Text style={[styles.small, muted]}>{labels[metric]} source</Text>{sources.map(source => <PressOpacity key={source} disabled={busy} onPress={() => void action(() => setPreferredSources(db, { ...data.preferred, [metric]: source }))} accessibilityState={{ selected: data.preferred[metric] === source }} style={[styles.source, { borderColor: data.preferred[metric] === source ? theme.colors.tertiary : theme.colors.borderStrong }]}><Text style={[styles.small, text]}>{source}</Text></PressOpacity>)}</View> : null;
        })}
        <PressOpacity disabled={busy || !connected} onPress={() => void action(() => disconnectHealth(db))} style={styles.button}><Text style={text}>Disconnect</Text></PressOpacity>
        <PressOpacity disabled={busy} onPress={() => Alert.alert("Delete imported health data?", "Questionnaires and weight logs stay saved.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void action(async () => { await deleteHealthData(db); await deleteImportedHealth(db); }) }])} style={styles.button}><Text style={text}>Delete imported data</Text></PressOpacity>
      </> : null}
      {actionError ? <Text accessibilityRole="alert" style={text}>{actionError}</Text> : null}
    </View>
  </View>;
}
function Metric({ title, value, detail, result, explanation, onAction, actionLabel }: { title: string; value?: string; detail?: string; result?: MetricResult; explanation?: string; onAction?: () => void; actionLabel?: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <Text style={[styles.heading, { color: theme.colors.textMuted }]}>{title}</Text>
    {value !== undefined ? <Text selectable style={[styles.value, { color: theme.colors.text }]}>{value}</Text> : <TrainingMetricValue label={title} metric={result ?? trainingMetric({ metricId: title, value: null, status: "unavailable", unit: "", method: "Observation", coverage: { valid: 0, total: 1 }, reasonCodes: ["missing"] })} explanation={explanation ?? "A matching observation has not been logged."} onAction={onAction} actionLabel={actionLabel} />}
    {result?.value !== null && result?.status === "available" && title === "Recovery Index" ? <Text style={[styles.small, { color: theme.colors.textMuted }]}>{result.method} · {result.coverage.valid}/{result.coverage.total} domains</Text> : null}
    {detail ? <Text style={[styles.small, { color: theme.colors.textMuted }]}>{detail}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 8 }, card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, status: { flexGrow: 1, fontSize: 13, fontVariant: ["tabular-nums"] }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6, flexGrow: 1, flexBasis: "46%", minWidth: 140 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }, value: { fontSize: 21, fontWeight: "800", fontVariant: ["tabular-nums"] }, small: { fontSize: 12, lineHeight: 16 }, button: { minHeight: 48, minWidth: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, grow: { flexGrow: 1 }, historyButton: { alignSelf: "flex-start", minHeight: 48, minWidth: 48, justifyContent: "center" }, sources: { gap: 4 }, source: { borderWidth: 1, borderRadius: 8, minHeight: 48, minWidth: 48, justifyContent: "center", padding: 8 } });
