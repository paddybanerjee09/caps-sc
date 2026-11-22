import { useEffect, useRef, useState } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { WorkflowFooter, WorkflowHeader } from "../../components/WorkflowChrome";
import { PressOpacity } from "../../components/PressOpacity";
import { saveQuestionnaire } from "../../data/recoveryRepository";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";
import { calculateSRI, createEmptyQuestionnaire } from "../calculations";
import { validateSleepTimes } from "../dates";
import type { Questionnaire } from "../types";
import { RatingSlider } from "./RatingSlider";
import { SleepTimeRangeSlider } from "./SleepTimeRangeSlider";

type Props = { initial: Questionnaire | null; localDate: string; timezone: string; onClose: () => void; onSaved: () => void; registerExitGuard?: (guard: ((proceed: () => void) => void) | null) => void };
const ratings = [
  ["sleepQuality", "Sleep quality", "terrible", "excellent"], ["fatigue", "General fatigue", "none", "extreme"],
  ["soreness", "Muscle soreness", "none", "extreme"], ["stress", "Mental stress", "none", "extreme"],
  ["motivation", "Training motivation", "none", "extremely motivated"], ["mood", "Mood (optional)", "very poor", "excellent"],
] as const;

export function MorningQuestionnaire({ initial, localDate, timezone, onClose, onSaved, registerExitGuard }: Props) {
  const db = useSQLiteContext();
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState<Questionnaire>(() => initial ? { ...initial } : createEmptyQuestionnaire(localDate, timezone));
  const [awakenings, setAwakenings] = useState(initial?.awakenings?.toString() ?? "");
  const [awakeMinutes, setAwakeMinutes] = useState(initial?.minutesAwake?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    registerExitGuard?.((proceed) => {
      if (pending.current) return;
      if (!dirty) { proceed(); return; }
      Alert.alert("Leave questionnaire?", "Save a draft before switching screens, or discard these unsaved edits.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Save draft", onPress: () => { void save(false, proceed); } },
        { text: "Discard edits", style: "destructive", onPress: proceed },
      ]);
    });
    return () => registerExitGuard?.(null);
  });
  function close() {
    if (pending.current) return;
    if (!dirty) { onClose(); return; }
    Alert.alert("Keep your answers?", "Save a draft to continue later, or discard these unsaved edits.", [
      { text: "Keep editing", style: "cancel" }, { text: "Discard edits", style: "destructive", onPress: onClose },
    ]);
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => subscription.remove();
  });
  function update<K extends keyof Questionnaire>(key: K, value: Questionnaire[K]) {
    setDirty(true); setDraft((old) => ({ ...old, [key]: value })); setError(null);
  }
  async function save(complete: boolean, afterSave?: () => void) {
    if (pending.current) return;
    const validInteger = (text: string) => text === "" || /^\d+$/.test(text) && Number.isSafeInteger(Number(text));
    if (!validInteger(awakenings) || !validInteger(awakeMinutes)) { setError("Awakenings and minutes awake must be whole, nonnegative numbers."); feedbackWarn(); return; }
    const candidate = { ...draft, awakenings: awakenings === "" ? null : Number(awakenings), minutesAwake: awakeMinutes === "" ? null : Number(awakeMinutes) };
    const errors = validateSleepTimes(candidate, complete);
    if ([candidate.sleepOnset, candidate.wakeTime].some((value) => value && Date.parse(value) > Date.now())) errors.push("Reported sleep times cannot be in the future.");
    if (complete && calculateSRI(candidate) === null) errors.push("Answer awakenings and the five required ratings to calculate SRI.");
    if (errors.length) { setError(errors.join("\n")); feedbackWarn(); return; }
    pending.current = true; setSaving(true); setError(null);
    try {
      await saveQuestionnaire(db, candidate, complete);
      feedbackConfirm(); onSaved(); onClose(); afterSave?.();
    } catch { setError("Couldn’t save your answers. They are still here; try again."); feedbackWarn(); }
    finally { pending.current = false; setSaving(false); }
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, zIndex: 10 }]}>
    <WorkflowHeader title="Morning questionnaire" topInset={0} onClose={close} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text selectable style={{ color: theme.colors.text, fontWeight: "700" }}>{localDate} · saved timezone {draft.timezone}</Text>
      <Text style={{ color: theme.colors.textMuted }}>Answers are stored on this device. Required questions start unanswered. Save a draft anytime; submit after completing your sleep times, awakenings and five required ratings.</Text>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SleepTimeRangeSlider localDate={localDate} onset={draft.sleepOnset} wake={draft.wakeTime} disabled={saving} onChange={update} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>The interval is time between reported onset and waking. It is only an estimated asleep duration if you also report minutes awake. Clock controls display {deviceTimezone}. Saved recovery-day assignment uses {draft.timezone}; check dates when editing after travel.</Text>
        <Text style={[styles.label, { color: theme.colors.text }]}>Number of awakenings (required)</Text>
        <TextInput accessibilityLabel="Number of awakenings" keyboardType="number-pad" editable={!saving} value={awakenings} onChangeText={(text) => { setAwakenings(text); setDirty(true); }} placeholder="Unanswered" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]} />
        <Text style={[styles.label, { color: theme.colors.text }]}>Minutes awake (optional)</Text>
        <TextInput accessibilityLabel="Approximate minutes awake during sleep interval" keyboardType="number-pad" editable={!saving} value={awakeMinutes} onChangeText={(text) => { setAwakeMinutes(text); setDirty(true); }} placeholder="Unknown" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]} />
      </View>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {ratings.map(([key, label, minLabel, maxLabel]) => <RatingSlider key={key} label={label} value={draft[key]} onChange={(value) => update(key, value)} minLabel={minLabel} maxLabel={maxLabel} disabled={saving} />)}
      </View>
      <Text selectable style={{ color: theme.colors.textMuted, fontSize: 12 }}>SRI v1 is a CAPS subjective wellness composite, not the Hooper Index or a percentage recovered. Six equal contributions: sleep quality, inverse fatigue, inverse soreness, inverse stress, motivation and inverse awakenings capped at five. The equal weights and cap are app scoring choices. Mood is excluded.</Text>
      {initial?.status === "completed" ? <Text style={{ color: theme.colors.textMuted }}>Saving these edits as a draft makes this day incomplete until you submit again.</Text> : null}
      {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.text }}>{error}</Text> : null}
    </ScrollView>
    <WorkflowFooter onBack={close} disabled={saving}>
      <PressOpacity disabled={saving} onPress={() => void save(false)} style={[styles.action, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}><Text style={{ color: theme.colors.text, fontWeight: "700" }}>Save draft</Text></PressOpacity>
      <PressOpacity disabled={saving} onPress={() => void save(true)} style={[styles.action, { borderColor: theme.colors.tertiary, backgroundColor: theme.colors.tertiary }]}><Text style={{ color: readableTextColor(theme.colors.tertiary), fontWeight: "700" }}>{saving ? "Saving…" : "Submit"}</Text></PressOpacity>
    </WorkflowFooter>
  </View>;
}
const styles = StyleSheet.create({ content: { padding: 12, gap: 16, paddingBottom: 32 }, card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 }, label: { fontSize: 14, fontWeight: "700" }, input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16, fontVariant: ["tabular-nums"] }, action: { minWidth: 72, minHeight: 52, flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 } });
