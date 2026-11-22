import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressOpacity } from "../../components/PressOpacity";
import { WorkflowFooter, WorkflowHeader } from "../../components/WorkflowChrome";
import { listQuestionnaires } from "../../data/recoveryRepository";
import { useAppTheme } from "../../theme/ThemeContext";
import { formatDisplayDate } from "../../utils/displayDate";
import { calculateSRI } from "../calculations";
import type { Questionnaire } from "../types";

export function QuestionnaireHistoryScreen({ active, revision, onClose, onEdit }: { active: boolean; revision: number; onClose: () => void; onEdit: (entry: Questionnaire) => void }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [entries, setEntries] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(null);
    try { const rows = await listQuestionnaires(db); if (request.current === id) setEntries(rows.reverse()); }
    catch { if (request.current === id) setError("Couldn’t load history."); }
    finally { if (request.current === id) setLoading(false); }
  }, [db]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const counter = request;
    void Promise.resolve().then(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; counter.current++; };
  }, [active, load, revision]);
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => subscription.remove();
  }, [active, onClose]);
  return <View pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: theme.colors.background }]}>
    <WorkflowHeader title="Questionnaire history" topInset={0} onClose={onClose} />
    {loading ? <View style={styles.empty}><ActivityIndicator accessibilityLabel="Loading questionnaire history" /></View> : error ? <View style={styles.empty}><Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text><PressOpacity onPress={() => void load()} style={styles.retry}><Text style={{ color: theme.colors.text }}>Retry</Text></PressOpacity></View> : <FlatList
      data={entries} keyExtractor={entry => entry.localDate} contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={{ color: theme.colors.textMuted }}>No questionnaires yet.</Text>}
      renderItem={({ item }) => {
        const score = item.status === "completed" ? calculateSRI(item) : null;
        return <PressOpacity accessibilityLabel={`Edit questionnaire, ${formatDisplayDate(item.localDate)}`} onPress={() => onEdit(item)} style={[styles.entry, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.copy}><Text style={[styles.date, { color: theme.colors.text }]}>{formatDisplayDate(item.localDate)}</Text><Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.status === "completed" ? "Completed" : "Draft"}</Text></View>
          <Text style={[styles.score, { color: theme.colors.text }]}>{score === null ? "--" : `${score}/100`}</Text><Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </PressOpacity>;
      }} />}
    <WorkflowFooter onBack={onClose} />
  </View>;
}
const styles = StyleSheet.create({ page: { zIndex: 10 }, list: { padding: 12, gap: 8, flexGrow: 1 }, entry: { borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, minWidth: 48 }, copy: { flex: 1, gap: 4 }, date: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }, score: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }, empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, retry: { minHeight: 48, minWidth: 48, justifyContent: "center", padding: 12 } });
