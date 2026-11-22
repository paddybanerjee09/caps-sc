import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { SegmentedSelector } from "../components/nutrition/SegmentedSelector";
import { PressOpacity } from "../components/PressOpacity";
import { listMeasurements, listQuestionnaires, listSnapshots, listWeights } from "../data/recoveryRepository";
import { BASELINE_DAYS, BASELINE_MINIMUM } from "../recovery/calculations";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { buildPeriod, dateKey, shiftPeriod, type Timeframe } from "./chartAggregation";
import { SynchronizedSubgraphGroup } from "./ProgressCharts";
import { aggregateGraphs, buildRawGraphs, emptyProgressRecords, firstProgressDate, type ProgressGroup, type ProgressRecords } from "./progressSeries";

const GROUPS: { value: ProgressGroup; label: string }[] = [{ value: "weight", label: "Body weight" }, { value: "recovery", label: "Recovery indices" }, { value: "cardiac", label: "Cardiac" }, { value: "sleep", label: "Sleep" }, { value: "fatigue", label: "Fatigue" }];
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
      if (request.current === id) setError("Couldn’t load progress records. Your saved data has not been changed.");
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
    <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text }]}>Progress</Text>
    <Text style={[styles.caption, { color: theme.colors.textMuted }]}>Recorded observations only. Missing days remain gaps. Scores are indices, not a percentage recovered.</Text>
    <View accessibilityRole="tablist" style={styles.groupSelector}>{GROUPS.map((option) => <PressOpacity key={option.value} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === group }} onPress={() => setGroup(option.value)} style={[styles.groupButton, { backgroundColor: theme.colors.surfaceMuted, borderColor: option.value === group ? theme.colors.tertiary : theme.colors.borderStrong }]}><Text style={[styles.buttonText, { color: theme.colors.text }]}>{option.label}</Text></PressOpacity>)}</View>
    <SegmentedSelector accessibilityLabel="Progress timeframe" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} />
    <View style={styles.periodBar}>
      {timeframe !== "lifetime" ? <PressOpacity accessibilityLabel="Previous progress period" onPress={() => setAnchor(shiftPeriod(anchor, timeframe, -1))} style={[styles.arrow, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>‹</Text></PressOpacity> : null}
      <Text style={[styles.periodTitle, { color: theme.colors.text }]}>{period.title}</Text>
      {timeframe !== "lifetime" ? <PressOpacity accessibilityLabel="Next progress period" disabled={nextPeriod.start > today} onPress={() => setAnchor(nextAnchor)} style={[styles.arrow, { borderColor: theme.colors.borderStrong }]}><Text style={{ color: theme.colors.text }}>›</Text></PressOpacity> : null}
    </View>
    <View style={styles.actions}>
      <PressOpacity accessibilityLabel="Show current progress period" onPress={() => { setAnchor(today); setSelectedKey(null); }} style={[styles.action, { borderColor: theme.colors.borderStrong }]}><Text style={[styles.buttonText, { color: theme.colors.text }]}>Current period</Text></PressOpacity>
      <PressOpacity accessibilityLabel="Refresh progress records" disabled={loading} onPress={() => void load()} style={[styles.action, { borderColor: theme.colors.borderStrong }]}><Text style={[styles.buttonText, { color: theme.colors.text }]}>Refresh</Text></PressOpacity>
    </View>
    <Text style={[styles.caption, { color: theme.colors.textMuted }]}>{period.resolution === "day" ? "Daily readings" : `${period.resolution === "month" ? "Monthly" : "Annual"} means of valid daily readings`} · latest eligible reading per source/day · tap or drag a chart to inspect one date across panels.</Text>
    {group === "weight" ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>7-day average uses at least 4 observed days in the trailing 7 calendar days. Daily weight remains broken at every missing date.</Text> : null}
    {group === "recovery" || group === "fatigue" ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>CAPS ORI v1 is an experimental biometric index, requiring HRV, resting HR and measured sleep with comparable baselines. SRI remains subjective. Neither is a percentage recovered.</Text> : null}
    {group === "cardiac" ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>HRV subtypes, platforms, sources and HRR protocols stay separate. Baselines require {BASELINE_MINIMUM} comparable days in the preceding {BASELINE_DAYS} days and exclude the plotted day.</Text> : null}
    {group === "sleep" ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>Asleep duration and sleep interval differ. Manual estimated asleep time requires reported minutes awake; efficiency requires valid asleep and in-bed measurements. Source lines can be hidden individually.</Text> : null}
    {group === "fatigue" ? <Text style={[styles.caption, { color: theme.colors.textMuted }]}>SRI includes fatigue, soreness, stress and motivation. Their relationship to SRI is partly built into the formula, not independent evidence of recovery.</Text> : null}
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.tertiary} /><Text style={{ color: theme.colors.textMuted }}>Loading saved observations…</Text></View> : error ? <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error} Use Refresh to retry.</Text> : <SynchronizedSubgraphGroup graphs={graphs} period={period} hidden={hidden} onToggle={(id) => setHidden((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} cursor={cursor} onSelect={select} />}
  </View>;
}
const styles = StyleSheet.create({ panel: { gap: 12 }, title: { fontSize: 18, fontWeight: "800" }, caption: { fontSize: 12, lineHeight: 18 }, groupSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, groupButton: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, minHeight: 48, minWidth: 48, justifyContent: "center" }, buttonText: { fontSize: 12, fontWeight: "700" }, periodBar: { flexDirection: "row", alignItems: "center", gap: 8 }, periodTitle: { flex: 1, fontSize: 13, textAlign: "center", fontWeight: "700", fontVariant: ["tabular-nums"] }, arrow: { minHeight: 48, width: 48, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1 }, actions: { flexDirection: "row", gap: 8 }, action: { minHeight: 48, minWidth: 48, borderWidth: 1, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, flex: 1 }, loading: { gap: 12, alignItems: "center", padding: 24 } });



