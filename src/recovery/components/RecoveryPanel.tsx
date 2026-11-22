import { useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { PressOpacity } from "../../components/PressOpacity";
import { deleteImportedHealth, listQuestionnaires, setPreferredSources } from "../../data/recoveryRepository";
import { connectHealth, deleteHealthData, disconnectHealth, syncHealth } from "../../health/healthService";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor } from "../../theme/theme";
import { calculateSRI, manualSleep } from "../calculations";
import { calculateORI } from "../objectiveRecovery";
import type { HealthMetric, Questionnaire } from "../types";
import type { useRecoveryData } from "../useRecoveryData";

type RecoveryData = ReturnType<typeof useRecoveryData>;
const labels: Record<HealthMetric, string> = { rhr: "Resting heart rate", hrv: "HRV", hrr60: "60s heart rate recovery", sleep_duration: "Sleep duration", sleep_efficiency: "Sleep efficiency", respiratory_rate: "Respiratory rate", temperature_deviation: "Skin temperature deviation" };
const descriptions: Record<HealthMetric, string> = { rhr: "Heart rate at rest.", hrv: "Beat-to-beat variation.", hrr60: "Heart-rate drop after exercise.", sleep_duration: "Time spent asleep.", sleep_efficiency: "Time asleep vs. time in bed.", respiratory_rate: "Breaths per minute.", temperature_deviation: "Change from your usual skin temperature." };
const requirements: Record<HealthMetric, string> = { rhr: "Needs a device that records resting heart rate.", hrv: "Needs a device that records HRV.", hrr60: "Needs a standardized heart-rate recovery test.", sleep_duration: "Sync sleep or report sleep times and minutes awake.", sleep_efficiency: "Needs measured sleep and time in bed.", respiratory_rate: "Needs a device that records breathing rate.", temperature_deviation: "Needs comparable skin-temperature readings." };
const metricOrder: HealthMetric[] = ["rhr", "hrv", "hrr60", "sleep_duration", "sleep_efficiency", "respiratory_rate", "temperature_deviation"];

export function RecoveryPanel({ recovery, onQuestionnaire, onChanged }: { recovery: RecoveryData; onQuestionnaire: (historical?: Questionnaire) => void; onChanged: () => void }) {
  const { theme } = useAppTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Questionnaire[] | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [managing, setManaging] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, loading, error, reload } = recovery;
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setActionError(null);
    try { await work(); await reload(); onChanged(); }
    catch { setActionError("Couldn’t finish. Try again."); }
    finally { setBusy(false); }
  }
  const text = { color: theme.colors.text };
  const muted = { color: theme.colors.textMuted };
  if (!data || error) return <View style={styles.block}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading recovery" /> : <Text accessibilityRole="alert" style={text}>Couldn’t load Recovery.</Text>}
    {!loading ? <PressOpacity onPress={() => void reload()} style={styles.button}><Text style={text}>Retry</Text></PressOpacity> : null}
  </View>;
  const questionnaire = data.questionnaire;
  const completed = questionnaire?.status === "completed";
  const sri = completed ? calculateSRI(questionnaire) : null;
  const manual = completed ? manualSleep(questionnaire) : { intervalMinutes: null, asleepMinutes: null };
  function latest(metric: HealthMetric) {
    return data!.measurements.filter(m => m.metric === metric && m.quality === "valid" && m.localDate === data!.localDate && (!data!.preferred[metric] || m.source === data!.preferred[metric]) && Date.parse(m.measuredAt) <= Date.now()).sort((a,b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt) || a.source.localeCompare(b.source))[0];
  }
  const ori = calculateORI(data.localDate, data.measurements, data.preferred);
  const oriDescription = ori.score !== null ? "Biometric recovery estimate." : ori.contributors.some(c => c.value === null) ? "Sync HRV, resting heart rate and measured sleep." : "Needs 14 prior days of comparable readings.";
  const sleep = latest("sleep_duration");
  const sleepStart = typeof sleep?.metadata?.onset === "string" ? sleep.metadata.onset : completed ? questionnaire.sleepOnset : null;
  const sleepEnd = typeof sleep?.metadata?.wake === "string" ? sleep.metadata.wake : completed ? questionnaire.wakeTime : null;
  const connected = data.health?.status === "ready" || data.health?.status === "sync_error";
  const provider = Platform.OS === "ios" ? "Apple Health" : "Health Connect";
  const connectionHint = data.health?.status === "unsupported" ? /build|Expo Go|bridge/i.test(data.health.error ?? "") ? "Requires a CAPS development build." : "Check health support on this device." : data.health?.status === "sync_error" ? "Check health permissions and retry." : null;
  return <View style={styles.block}>
    <View style={[styles.card, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.heading, muted]}>RECOVERY · {data.localDate}</Text>
      <View style={styles.row}>
        <Text style={[styles.status, text]}>{completed ? `Completed${questionnaire.completedAt ? ` · ${new Date(questionnaire.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}` : questionnaire?.status === "in_progress" ? "Draft saved" : "Morning check-in due"}</Text>
        <PressOpacity disabled={busy || loading} onPress={onQuestionnaire} style={[styles.button, { backgroundColor: theme.colors.tertiary }]}><Text style={{ color: readableTextColor(theme.colors.tertiary), fontWeight: "700" }}>{completed ? "Edit" : "Questionnaire"}</Text></PressOpacity>
      </View>
      <PressOpacity disabled={busy} accessibilityState={{ expanded: history !== null }} onPress={() => { if (history) setHistory(null); else void action(async () => { setHistory((await listQuestionnaires(db)).filter(q => q.localDate !== data.localDate).reverse()); setHistoryPage(0); }); }} style={styles.historyButton}><Text style={[styles.small, text]}>{history ? "Hide history" : "Questionnaire history"}</Text></PressOpacity>
      {history ? <>
        {!history.length ? <Text style={[styles.small, muted]}>No earlier entries.</Text> : null}
        {history.slice(historyPage * 7, historyPage * 7 + 7).map(q => <PressOpacity key={q.localDate} onPress={() => onQuestionnaire(q)} style={styles.button}><Text style={text}>{q.localDate} · {q.status === "completed" ? "Completed" : "Draft"}</Text></PressOpacity>)}
        {history.length > 7 ? <View style={styles.row}><PressOpacity disabled={historyPage === 0} onPress={() => setHistoryPage(page => page - 1)} style={styles.button}><Text style={text}>Newer</Text></PressOpacity><PressOpacity disabled={(historyPage + 1) * 7 >= history.length} onPress={() => setHistoryPage(page => page + 1)} style={styles.button}><Text style={text}>Earlier</Text></PressOpacity></View> : null}
      </> : null}
    </View>
    <View style={styles.grid}>
      <Metric title="Subjective Recovery Index" value={sri === null ? "--" : `${sri} / 100`} detail={sri === null ? "Complete the morning questionnaire." : "Your morning check-in score."} />
      <Metric title="Objective Recovery Index · Experimental" value={ori.score === null ? "--" : `${ori.score} / 100`} detail={oriDescription} />
      {metricOrder.map(metric => {
        const reading = latest(metric);
        const manualSleep = !reading && metric === "sleep_duration" && manual.asleepMinutes !== null;
        const value = reading ? metric === "sleep_duration" ? `${(reading.value / 60).toFixed(1)} h` : `${reading.value.toFixed(1)} ${reading.unit}` : manualSleep ? `${(manual.asleepMinutes! / 60).toFixed(1)} h` : "--";
        const detail = reading ? descriptions[metric] : manualSleep ? "Estimated from your sleep answers." : requirements[metric];
        return <Metric key={metric} title={`${labels[metric]}${metric === "hrv" && reading ? ` · ${reading.subtype}` : ""}`} value={value} detail={detail} />;
      })}
      <Metric title="Sleep / wake times" value={sleepStart && sleepEnd ? `${new Date(sleepStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} → ${new Date(sleepEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}` : "--"} detail={sleepStart && sleepEnd ? "Sleep onset and waking · local time." : "Sync sleep or complete your sleep questions."} />
    </View>
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
function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.metric, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <Text style={[styles.heading, { color: theme.colors.textMuted }]}>{title}</Text>
    <Text selectable style={[styles.value, { color: theme.colors.text }]}>{value}</Text>
    <Text style={[styles.small, { color: theme.colors.textMuted }]}>{detail}</Text>
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 8 }, card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 }, row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, status: { flexGrow: 1, fontSize: 13, fontVariant: ["tabular-nums"] }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6, flexGrow: 1, flexBasis: "46%", minWidth: 140 }, heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }, value: { fontSize: 21, fontWeight: "800", fontVariant: ["tabular-nums"] }, small: { fontSize: 12, lineHeight: 16 }, button: { minHeight: 48, minWidth: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, grow: { flexGrow: 1 }, historyButton: { alignSelf: "flex-start", minHeight: 48, minWidth: 48, justifyContent: "center" }, sources: { gap: 4 }, source: { borderWidth: 1, borderRadius: 8, minHeight: 48, minWidth: 48, justifyContent: "center", padding: 8 } });
