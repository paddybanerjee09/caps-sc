import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { SegmentedSelector } from "../components/nutrition/SegmentedSelector";
import { PressOpacity } from "../components/PressOpacity";
import { listMeasurements, listQuestionnaires, listSnapshots, listWeights } from "../data/recoveryRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { buildPeriod, dateKey, shiftPeriod, type Timeframe } from "./chartAggregation";
import { SynchronizedSubgraphGroup } from "./ProgressCharts";
import { aggregateGraphs, buildRawGraphs, emptyProgressRecords, firstProgressDate, type ProgressGroup, type ProgressRecords } from "./progressSeries";

const GROUPS: { value: ProgressGroup; label: string }[] = [{ value: "weight", label: "Body Weight" }, { value: "recovery", label: "Recovery Indices" }, { value: "cardiac", label: "Cardiac Indices" }, { value: "sleep", label: "Sleep Indices" }, { value: "fatigue", label: "Fatigue Indices" }];
const TIMEFRAMES: { value: Timeframe; label: string }[] = [{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }, { value: "lifetime", label: "Lifetime" }];

export function ProgressPanel({ revision, active = true }: { revision: number; active?: boolean }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { unitSettings, timelineRevision } = useAppState();
  const [records, setRecords] = useState<ProgressRecords>(emptyProgressRecords);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [anchor, setAnchor] = useState(today);
  const [timeframe, setTimeframe] = useState<Timeframe>("week");
  const [group, setGroup] = useState<ProgressGroup>("weight");
  const [graphMenuOpen, setGraphMenuOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const request = useRef(0);
  const cancelPending = useCallback(() => { request.current++; }, []);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const [questionnaires, measurements, snapshots, weights] = await Promise.all([listQuestionnaires(db), listMeasurements(db), listSnapshots(db), listWeights(db)]);
      if (request.current === id) setRecords({ questionnaires, measurements, snapshots, weights });
    } catch {
      if (request.current === id) setError("Couldn’t load progress.");
    } finally { if (request.current === id) setLoading(false); }
  }, [db]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; cancelPending(); };
  }, [active, cancelPending, load, revision, timelineRevision]);
  useEffect(() => {
    if (!active) return;
    const refreshDay = () => setToday(dateKey(new Date()));
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") { refreshDay(); void load(); } });
    const timer = setInterval(refreshDay, 30_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [active, load]);
  useEffect(() => {
    if (!active || !graphMenuOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setGraphMenuOpen(false); return true; });
    return () => subscription.remove();
  }, [active, graphMenuOpen]);
  const period = useMemo(() => buildPeriod(timeframe, anchor, firstProgressDate(records), today), [anchor, records, timeframe, today]);
  const rawGraphs = useMemo(() => buildRawGraphs(records, group, unitSettings.weight === "imperial", today), [group, records, today, unitSettings.weight]);
  const graphs = useMemo(() => aggregateGraphs(rawGraphs, period), [rawGraphs, period]);
  const selected = period.buckets.findIndex((bucket) => bucket.key === selectedKey);
  const lastEligible = period.buckets.findLastIndex((bucket) => bucket.start <= today);
  const cursor = selected >= 0 ? selected : Math.max(0, lastEligible);
  const select = useCallback((index: number) => setSelectedKey(period.buckets[index]?.key ?? null), [period]);
  const nextAnchor = shiftPeriod(anchor, timeframe, 1);
  const nextPeriod = buildPeriod(timeframe, nextAnchor, null, today);
  if (!active) return null;
  return <View style={styles.panel}>
    <View style={[styles.graphChooser, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
      <PressOpacity accessibilityLabel={`Choose graph, ${GROUPS.find(option => option.value === group)!.label}`} accessibilityState={{ expanded: graphMenuOpen }} onPress={() => setGraphMenuOpen(open => !open)} style={styles.graphTrigger}>
        <Text style={[styles.chooserLabel, { color: theme.colors.textMuted }]}>Choose graph</Text>
        <Text style={[styles.graphValue, { color: theme.colors.text }]}>{GROUPS.find(option => option.value === group)!.label}</Text>
        <Ionicons name={graphMenuOpen ? "chevron-up" : "chevron-down"} color={theme.colors.textMuted} size={18} />
      </PressOpacity>
      {graphMenuOpen ? <View style={[styles.graphMenu, { borderTopColor: theme.colors.border }]}>{GROUPS.map(option => <PressOpacity key={option.value} accessibilityLabel={option.label} accessibilityState={{ selected: option.value === group }} onPress={() => { setGroup(option.value); setGraphMenuOpen(false); }} style={styles.graphOption}>
        <Text style={[styles.graphOptionText, { color: option.value === group ? theme.colors.tertiary : theme.colors.text }]}>{option.label}</Text>
        {option.value === group ? <Ionicons name="checkmark" size={18} color={theme.colors.tertiary} /> : null}
      </PressOpacity>)}</View> : null}
    </View>
    <SegmentedSelector accessibilityLabel="Progress timeframe" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
    <View style={styles.periodBar}>
      {timeframe !== "lifetime" ? <PressOpacity accessibilityLabel="Previous progress period" onPress={() => setAnchor(shiftPeriod(anchor, timeframe, -1))} style={styles.iconButton}><Ionicons name="chevron-back" size={20} color={theme.colors.text} /></PressOpacity> : null}
      <PressOpacity accessibilityLabel={`${period.title}. Show current period`} onPress={() => { setAnchor(today); setSelectedKey(null); }} style={styles.currentPeriod}><Text style={[styles.periodTitle, { color: theme.colors.text }]}>{period.title}</Text></PressOpacity>
      {timeframe !== "lifetime" ? <PressOpacity accessibilityLabel="Next progress period" disabled={nextPeriod.start > today} onPress={() => setAnchor(nextAnchor)} style={styles.iconButton}><Ionicons name="chevron-forward" size={20} color={theme.colors.text} /></PressOpacity> : null}
      <PressOpacity accessibilityLabel="Refresh progress" disabled={loading} onPress={() => void load()} style={styles.iconButton}><Ionicons name="refresh" size={19} color={theme.colors.text} /></PressOpacity>
    </View>
    {loading ? <View style={styles.loading}><ActivityIndicator accessibilityLabel="Loading progress" color={theme.colors.tertiary} /></View> : error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error} Tap refresh to retry.</Text> : <SynchronizedSubgraphGroup graphs={graphs} period={period} hidden={hidden} onToggle={(id) => setHidden((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} cursor={cursor} onSelect={select} />}
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: 8 },
  graphChooser: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  graphTrigger: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  chooserLabel: { fontSize: 12 }, graphValue: { flex: 1, fontSize: 13, fontWeight: "700", textAlign: "right" },
  graphMenu: { borderTopWidth: 1 }, graphOption: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, graphOptionText: { flex: 1, fontSize: 14, fontWeight: "600" },
  periodBar: { flexDirection: "row", alignItems: "center" }, periodTitle: { fontSize: 12, textAlign: "center", fontWeight: "700", fontVariant: ["tabular-nums"] },
  currentPeriod: { flex: 1, minHeight: 48, minWidth: 48, justifyContent: "center", paddingHorizontal: 4 }, iconButton: { minHeight: 48, width: 48, alignItems: "center", justifyContent: "center" },
  loading: { alignItems: "center", padding: 16 },
});
