import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { WorkflowFooter, WorkflowHeader } from "../../components/WorkflowChrome";
import { PressOpacity } from "../../components/PressOpacity";
import { saveQuestionnaire } from "../../data/recoveryRepository";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";
import { formatDisplayDate } from "../../utils/displayDate";
import { calculateSRI, createEmptyQuestionnaire, manualSleep } from "../calculations";
import { validateSleepTimes } from "../dates";
import type { Questionnaire } from "../types";
import { RatingSlider } from "./RatingSlider";
import { SleepTimeRangeSlider } from "./SleepTimeRangeSlider";

type Props = { initial: Questionnaire | null; localDate: string; timezone: string; onClose: () => void; onBack?: () => void; onSaved: () => void; registerExitGuard?: (guard: ((proceed: () => void) => void) | null) => void };
const ratings = [
  ["sleepQuality", "Sleep quality", "terrible", "excellent"], ["fatigue", "Fatigue", "none", "extreme"],
  ["soreness", "Soreness", "none", "extreme"], ["stress", "Stress", "none", "extreme"],
  ["motivation", "Training motivation", "none", "very motivated"], ["mood", "Mood", "very poor", "excellent"],
] as const;

export function MorningQuestionnaire({ initial, localDate, timezone, onClose, onBack, onSaved, registerExitGuard }: Props) {
  const db = useSQLiteContext();
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState<Questionnaire>(() => {
    const base = initial ? { ...initial } : createEmptyQuestionnaire(localDate, timezone);
    return { ...base, sriVersion: "sri_v2", awakenings: base.awakenings ?? 0, awakeningsAtLeast: base.awakeningsAtLeast ?? false,
      sleepQuality: base.sleepQuality ?? 5, fatigue: base.fatigue ?? 5, soreness: base.soreness ?? 5,
      stress: base.stress ?? 5, motivation: base.motivation ?? 5, mood: base.mood ?? 5 };
  });
  const [awakeMinutes, setAwakeMinutes] = useState(initial?.minutesAwake?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    registerExitGuard?.((proceed) => {
      if (pending.current) return;
      if (!dirty) { proceed(); return; }
      Alert.alert("Unsaved answers", "Save or discard your edits.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Save draft", onPress: () => { void save(false, proceed); } },
        { text: "Discard edits", style: "destructive", onPress: proceed },
      ]);
    });
    return () => registerExitGuard?.(null);
  });
  function leave(destination: () => void) {
    if (pending.current) return;
    if (!dirty) { destination(); return; }
    Alert.alert("Unsaved answers", "Keep editing or discard?", [
      { text: "Keep editing", style: "cancel" }, { text: "Discard edits", style: "destructive", onPress: destination },
    ]);
  }
  function close() { leave(onClose); }
  function back() { leave(onBack ?? onClose); }
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => subscription.remove();
  });
  function update<K extends keyof Questionnaire>(key: K, value: Questionnaire[K]) {
    setDirty(true); setDraft((old) => ({ ...old, [key]: value })); setError(null);
  }
  async function save(complete: boolean, afterSave?: () => void) {
    if (pending.current) return;
    const validInteger = (text: string) => text === "" || /^\d+$/.test(text) && Number.isSafeInteger(Number(text));
    if (!validInteger(awakeMinutes)) { setError("Minutes awake must be a whole, nonnegative number."); feedbackWarn(); return; }
    const candidate = { ...draft, minutesAwake: awakeMinutes === "" ? null : Number(awakeMinutes) };
    const errors = validateSleepTimes(candidate, complete);
    if ([candidate.sleepOnset, candidate.wakeTime].some((value) => value && Date.parse(value) > Date.now())) errors.push("Reported sleep times cannot be in the future.");
    if (complete && calculateSRI(candidate) === null) errors.push("Complete all ratings to calculate SRI.");
    if (errors.length) { setError(errors.join("\n")); feedbackWarn(); return; }
    pending.current = true; setSaving(true); setError(null);
    try {
      await saveQuestionnaire(db, candidate, complete);
      feedbackConfirm(); onSaved(); (onBack ?? onClose)(); afterSave?.();
    } catch { setError("Couldn’t save. Try again."); feedbackWarn(); }
    finally { pending.current = false; setSaving(false); }
  }
  const sleep = manualSleep({ ...draft, minutesAwake: awakeMinutes === "" ? null : /^\d+$/.test(awakeMinutes) ? Number(awakeMinutes) : Number.NaN });
  const duration = sleep.asleepMinutes ?? sleep.intervalMinutes;
  const durationText = duration === null ? "--" : `${Math.floor(duration / 60)} h ${Math.round(duration % 60)} min`;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, zIndex: 10 }]}>
    <WorkflowHeader title="Morning questionnaire" topInset={0} onClose={close} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text selectable style={{ color: theme.colors.text, fontWeight: "700" }}>{formatDisplayDate(localDate)} · {deviceTimezone}{draft.timezone !== deviceTimezone ? ` · Day: ${draft.timezone}` : ""}</Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SleepTimeRangeSlider localDate={localDate} onset={draft.sleepOnset} wake={draft.wakeTime} disabled={saving} onChange={update} />
        <View style={styles.durationRow}><Text style={[styles.label, { color: theme.colors.textMuted }]}>{sleep.asleepMinutes === null ? "Total sleep (interval)" : "Total sleep (estimated)"}</Text><Text selectable style={[styles.duration, { color: theme.colors.text }]}>{durationText}</Text></View>
        <RatingSlider label="Awakenings" value={draft.awakenings} onChange={value => { setDirty(true); setDraft(old => ({ ...old, awakenings: value, awakeningsAtLeast: value === 10 })); setError(null); }} minLabel="none" maxLabel="10 or more" maxValueLabel="10+" disabled={saving} />
        <Text style={[styles.label, { color: theme.colors.text }]}>Minutes awake (optional)</Text>
        <TextInput accessibilityLabel="Approximate minutes awake during sleep interval" keyboardType="number-pad" editable={!saving} value={awakeMinutes} onChangeText={(text) => { setAwakeMinutes(text); setDirty(true); }} placeholder="--" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]} />
      </View>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {ratings.map(([key, label, minLabel, maxLabel]) => <RatingSlider key={key} label={label} value={draft[key]} onChange={(value) => update(key, value)} minLabel={minLabel} maxLabel={maxLabel} disabled={saving} />)}
      </View>
      {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.text }}>{error}</Text> : null}
    </ScrollView>
    <WorkflowFooter onBack={back} backLabel={onBack ? "Back" : "Cancel"} disabled={saving}>
      <PressOpacity disabled={saving} onPress={() => void save(false)} style={[styles.action, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}><Text style={{ color: theme.colors.text, fontWeight: "700" }}>Save draft</Text></PressOpacity>
      <PressOpacity disabled={saving} onPress={() => void save(true)} style={[styles.action, { borderColor: theme.colors.tertiary, backgroundColor: theme.colors.tertiary }]}><Text style={{ color: readableTextColor(theme.colors.tertiary), fontWeight: "700" }}>{saving ? "Saving…" : "Submit"}</Text></PressOpacity>
    </WorkflowFooter>
  </View>;
}
const styles = StyleSheet.create({ content: { padding: 12, gap: 12, paddingBottom: 16 }, card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 12 }, label: { fontSize: 14, fontWeight: "700" }, durationRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, duration: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }, input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16, fontVariant: ["tabular-nums"] }, action: { minWidth: 72, minHeight: 52, flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 } });
