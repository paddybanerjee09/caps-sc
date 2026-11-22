import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { PressOpacity } from "../../components/PressOpacity";
import { deleteImportedHealth, listQuestionnaires, setPreferredSources } from "../../data/recoveryRepository";
import { connectHealth, deleteHealthData, disconnectHealth, syncHealth } from "../../health/healthService";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor } from "../../theme/theme";
import { calculateSRI, manualSleep, personalBaseline } from "../calculations";
import type { HealthMetric, Questionnaire } from "../types";
import type { useRecoveryData } from "../useRecoveryData";

type RecoveryData = ReturnType<typeof useRecoveryData>;
const labels: Record<HealthMetric, string> = { rhr: "Resting heart rate", hrv: "HRV", hrr60: "60s heart rate recovery", sleep_duration: "Sleep duration", sleep_efficiency: "Sleep efficiency", respiratory_rate: "Respiratory rate", temperature_deviation: "Skin temperature deviation" };
const metricOrder: HealthMetric[] = ["rhr", "hrv", "hrr60", "sleep_duration", "sleep_efficiency", "respiratory_rate", "temperature_deviation"];

export function RecoveryPanel({ recovery, onQuestionnaire, onChanged }: { recovery: RecoveryData; onQuestionnaire: (historical?: Questionnaire) => void; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Questionnaire[] | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = recovery;
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setActionError(null);
    try { await work(); await reload(); onChanged(); }
    catch { setActionError("Couldn’t finish that action. Existing records are retained; try again."); }
    finally { setBusy(false); }
  }
  const text = { color: theme.colors.text };
  const muted = { color: theme.colors.textMuted };
  if (!data || error) return <View style={styles.block}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading recovery" /> : <Text accessibilityRole="alert" style={text}>{error ?? "Recovery unavailable"}</Text>}
    {!loading ? <PressOpacity onPress={() => void reload()} style={styles.button}><Text style={text}>Retry recovery</Text></PressOpacity> : null}
  </View>;
  const questionnaire = data.questionnaire;
  const completed = questionnaire?.status === "completed";
  const sri = completed ? calculateSRI(questionnaire) : null;
  const manual = completed ? manualSleep(questionnaire) : { intervalMinutes: null, asleepMinutes: null };
  function latest(metric: HealthMetric) {
    const candidates = data!.measurements.filter((m) => m.metric === metric && m.quality === "valid" && (!data!.preferred[metric] || m.source === data!.preferred[metric]) && Date.parse(m.measuredAt) <= Date.now());
    // Preserve acquisition day assignments: a historical value is never relabeled as today's.
    return candidates.filter((m) => m.localDate === data!.localDate).sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt) || a.source.localeCompare(b.source))[0];
  }
  function changeSource(metric: HealthMetric, source: string) { void action(() => setPreferredSources(db, { ...data!.preferred, [metric]: source })); }
  const sleep = latest("sleep_duration");
  const sleepStart = typeof sleep?.metadata?.onset === "string" ? sleep.metadata.onset : completed ? questionnaire.sleepOnset : null;
  const sleepEnd = typeof sleep?.metadata?.wake === "string" ? sleep.metadata.wake : completed ? questionnaire.wakeTime : null;
  return <View style={styles.block}>
    <View style={[styles.card, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, muted]}>DAILY RECOVERY · {data.localDate}</Text>
      <Text style={text}>{completed ? `Questionnaire completed ${questionnaire.completedAt ? new Date(questionnaire.completedAt).toLocaleTimeString() : ""}` : questionnaire?.status === "in_progress" ? "Morning questionnaire · draft saved" : "● Morning questionnaire due"}</Text>
      <PressOpacity disabled={busy || loading} onPress={onQuestionnaire} style={[styles.button, { backgroundColor: theme.colors.tertiary }]}><Text style={{ color: readableTextColor(theme.colors.tertiary), fontWeight: "700" }}>{completed ? "Edit questionnaire" : "Complete morning questionnaire"}</Text></PressOpacity>
      <Text style={[styles.small, muted]}>Current local recovery day · {data.timezone}. Earlier answers remain stored when the day changes.</Text>
    </View>
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <PressOpacity disabled={busy} onPress={() => { if (history) setHistory(null); else void action(async () => { setHistory((await listQuestionnaires(db)).filter((q) => q.localDate !== data.localDate).reverse()); setHistoryPage(0); }); }} style={styles.button}><Text style={text}>{history ? "Hide questionnaire history" : "Edit a previous questionnaire"}</Text></PressOpacity>
      {history ? <><Text style={[styles.small, muted]}>{history.length ? "Edits preserve revision history and recalculate that day’s SRI and charts." : "No earlier questionnaires."}</Text>{history.slice(historyPage * 7, historyPage * 7 + 7).map((q) => <PressOpacity key={q.localDate} onPress={() => onQuestionnaire(q)} style={styles.button}><Text style={text}>{q.localDate} · {q.status.replaceAll("_", " ")} · revision {q.revision}</Text></PressOpacity>)}<View style={styles.sources}><PressOpacity disabled={historyPage === 0} onPress={() => setHistoryPage((page) => page - 1)} style={styles.button}><Text style={text}>Newer days</Text></PressOpacity><PressOpacity disabled={(historyPage + 1) * 7 >= history.length} onPress={() => setHistoryPage((page) => page + 1)} style={styles.button}><Text style={text}>Earlier days</Text></PressOpacity></View></> : null}
    </View>
    <View style={styles.grid}>
      <Metric title="Subjective Recovery Index" value={sri === null ? "—" : `${sri} / 100`} detail={sri === null ? "Complete the six required scoring inputs and submit." : "sri_v1 · CAPS subjective wellness composite; not the Hooper Index."} />
      <Metric title="Experimental Objective Recovery Index" value="—" detail={`No approved model or weights. ${new Set(data.measurements.filter((m) => m.localDate === data.localDate && m.quality === "valid").map((m) => m.metric)).size} objective marker types recorded today; no scoring contributors configured. This is never a percentage recovered.`} />
      {metricOrder.map((metric) => {
        const reading = latest(metric);
        const sources = [...new Set(data.measurements.filter((m) => m.metric === metric && m.quality === "valid").map((m) => m.source))].sort();
        const baseline = reading ? personalBaseline(reading, data.measurements) : null;
        const historical = data.measurements.filter((m) => m.metric === metric && m.localDate < data.localDate && m.quality === "valid" && (!data.preferred[metric] || data.preferred[metric] === m.source)).at(-1);
        let value = reading ? metric === "sleep_duration" ? `${(reading.value / 60).toFixed(1)} h` : `${reading.value.toFixed(1)} ${reading.unit}` : "—";
        let detail = reading ? `${reading.subtype ?? ""} · ${reading.source}\n${new Date(reading.measuredAt).toLocaleString()} (device time) · day zone ${reading.timezone}` : data.health?.capabilities[metric] ?? "No suitable reading for this recovery day.";
        if (!reading && metric === "sleep_duration" && manual.asleepMinutes !== null) { value = `${(manual.asleepMinutes / 60).toFixed(1)} h`; detail = "Estimated/manual · reported interval minus reported minutes awake."; }
        if (!reading && historical) detail += `\nHistorical only: ${historical.localDate}; ${historical.value.toFixed(1)} ${historical.unit} · ${historical.source}.`;
        if (baseline) detail += baseline.zScore === null ? `\nInsufficient baseline: ${baseline.count}/14 comparable prior days, or zero variance.` : `\n${reading.subtype === "RMSSD" ? "lnRMSSD " : ""}z ${baseline.zScore >= 0 ? "+" : ""}${baseline.zScore.toFixed(2)} · ${baseline.count} prior days (${baseline.windowStart}–${baseline.windowEnd}).`;
        return <View key={metric} style={styles.metricWrap}>
          <Metric title={`${labels[metric]}${metric === "hrv" && reading ? ` · ${reading.subtype}` : ""}`} value={value} detail={detail} state={reading ? baseline?.zScore === null ? "insufficient_baseline" : "available" : loading ? "loading" : data.health?.status === "sync_error" ? "sync_error" : historical ? "stale" : "unavailable"} />
          {sources.length > 1 ? <View style={styles.sources}><Text style={[styles.small, muted]}>Preferred source</Text>{sources.map((source) => <PressOpacity key={source} disabled={busy} onPress={() => changeSource(metric, source)} accessibilityState={{ selected: data.preferred[metric] === source }} style={[styles.source, { borderColor: data.preferred[metric] === source ? theme.colors.tertiary : theme.colors.borderStrong }]}><Text style={[styles.small, text]}>{source}</Text></PressOpacity>)}</View> : null}
        </View>;
      })}
      <Metric title="Sleep / wake times" value={sleepStart && sleepEnd ? `${new Date(sleepStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} → ${new Date(sleepEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}` : "—"} detail={sleepStart && sleepEnd ? `${new Date(sleepStart).toLocaleDateString()} → ${new Date(sleepEnd).toLocaleDateString()} · ${sleep ? sleep.source : "Manual questionnaire"}. Times displayed in current device timezone.` : "No reported or measured sleep times."} />
    </View>
    {!sleep && manual.intervalMinutes !== null ? <Text style={[styles.small, muted]}>Reported sleep interval: {(manual.intervalMinutes / 60).toFixed(1)} h. Unknown minutes awake leave asleep duration and efficiency unavailable.</Text> : null}
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.heading, muted]}>HEALTH CONNECTION</Text>
      <Text selectable style={text}>{data.health?.status ?? "not_connected"}{data.health?.error ? ` · ${data.health.error}` : ""}</Text>
      <Text style={[styles.small, muted]}>Read-only import: resting heart rate, HRV, respiratory rate and sleep. Availability depends on your device and source app. HealthKit read denial may be indistinguishable from no data.</Text>
      <Text selectable style={[styles.small, muted]}>Last successful sync: {data.health?.lastSuccessfulSync ? new Date(data.health.lastSuccessfulSync).toLocaleString() : "—"}</Text>
      <PressOpacity disabled={busy} onPress={() => void action(() => data.health?.status === "ready" || data.health?.status === "sync_error" ? syncHealth(db) : connectHealth(db))} style={[styles.button, { borderColor: theme.colors.borderStrong, borderWidth: 1 }]}><Text style={text}>{busy ? "Working…" : data.health?.status === "ready" || data.health?.status === "sync_error" ? "Refresh health data" : "Connect health data"}</Text></PressOpacity>
      <PressOpacity disabled={busy || !data.health || data.health.status === "not_connected"} onPress={() => void action(() => disconnectHealth(db))} style={styles.button}><Text style={text}>Disconnect · retain imported data</Text></PressOpacity>
      <PressOpacity disabled={busy} onPress={() => Alert.alert("Delete imported health data?", "This removes imported readings and their baselines on this device and disconnects the importer. Questionnaires and weight logs remain.", [{ text: "Cancel", style: "cancel" }, { text: "Delete imported data", style: "destructive", onPress: () => void action(async () => { await deleteHealthData(db); await deleteImportedHealth(db); }) }])} style={styles.button}><Text style={text}>Delete imported health data</Text></PressOpacity>
      {actionError ? <Text accessibilityRole="alert" style={text}>{actionError}</Text> : null}
    </View>
    <Text style={[styles.small, muted]}>Baselines use the preceding 28 calendar days, at least 14 valid comparable days, excluding today. HRV subtype, source and HRR protocol remain separate. A deviation alone does not establish readiness.</Text>
  </View>;
}
function Metric({ title, value, detail, state }: { title: string; value: string; detail: string; state?: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <Text style={[styles.heading, { color: theme.colors.textMuted }]}>{title}</Text>
    <Text selectable style={[styles.value, { color: theme.colors.text }]}>{value}</Text>
    {state ? <Text style={[styles.small, { color: theme.colors.textMuted }]}>{state.replaceAll("_", " ")}</Text> : null}
    <Text selectable style={[styles.small, { color: theme.colors.textMuted }]}>{detail}</Text>
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 12 }, card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, metricWrap: { flexGrow: 1, flexBasis: "46%", minWidth: 140 }, metric: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8, flexGrow: 1, flexBasis: "46%", minWidth: 140 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }, value: { fontSize: 21, fontWeight: "800", fontVariant: ["tabular-nums"] }, small: { fontSize: 12, lineHeight: 18 }, button: { minHeight: 48, minWidth: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 12 }, sources: { gap: 4, paddingTop: 8 }, source: { borderWidth: 1, borderRadius: 8, minHeight: 48, minWidth: 48, justifyContent: "center", padding: 8 } });
