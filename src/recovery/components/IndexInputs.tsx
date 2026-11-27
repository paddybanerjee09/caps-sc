import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressOpacity } from "../../components/PressOpacity";
import { TrainingNumberField } from "../../components/training/TrainingNumberField";
import { saveTrainingOutputTest, setCompletedTrainingLoad, setSleepTarget, setTrainingDayConfirmation } from "../../data/trainingIndexRepository";
import { sessionLoad, type CompletedTraining, type TrainingDayConfirmation } from "../../domain/training/fatigue";
import { useAppTheme } from "../../theme/ThemeContext";
import { formatDisplayDate } from "../../utils/displayDate";
import { shiftDate } from "../dates";

function numeric(value: string) {
  return /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : Number.NaN;
}

function InputButton({ label, onPress, disabled, selected, icon }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean; icon?: "chevron-back" | "chevron-forward" }) {
  const { theme } = useAppTheme();
  return <PressOpacity accessibilityLabel={label} accessibilityState={selected === undefined ? undefined : { selected }} disabled={disabled} onPress={onPress}
      style={[styles.button, { borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}>
    {icon ? <Ionicons name={icon} size={18} color={theme.colors.text} /> : <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{label}</Text>}
  </PressOpacity>;
}

function InputCard({ children, title }: { children: ReactNode; title: string }) {
  const { theme } = useAppTheme();
  return <View style={[styles.card, { borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface }]}>
    <Text accessibilityRole="header" style={[styles.header, { color: theme.colors.textMuted }]}>{title}</Text>{children}
  </View>;
}

function useSave(onSaved: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  async function save(action: () => Promise<unknown>) {
    setBusy(true); setError(null); setSuccess(false);
    try { await action(); await onSaved(); setSuccess(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t save. Try again."); }
    finally { setBusy(false); }
  }
  return { busy, error, success, save };
}

function SaveStatus({ error, success }: { error: string | null; success: boolean }) {
  const { theme } = useAppTheme();
  return error || success ? <Text accessibilityRole={error ? "alert" : undefined} accessibilityLiveRegion="polite" style={{ color: theme.colors.text }}>{error ?? "Saved"}</Text> : null;
}

export function SleepTargetInput({ date, timezone, initial, onSaved }: { date: string; timezone: string; initial: number | null; onSaved: () => Promise<void> }) {
  const db = useSQLiteContext();
  const [hours, setHours] = useState(initial?.toString() ?? "");
  const { busy, error, success, save } = useSave(onSaved);
  return <InputCard title="SLEEP TARGET">
    <TrainingNumberField label="Personal sleep target (hours)" value={hours} onChangeText={setHours} editable={!busy} decimal />
    <View style={styles.row}>
      <InputButton label="Save sleep target" disabled={busy || !hours.trim()} onPress={() => void save(() => setSleepTarget(db, date, timezone, numeric(hours)))} />
      {initial !== null ? <InputButton label="Clear sleep target" disabled={busy} onPress={() => void save(async () => { await setSleepTarget(db, date, timezone, null); setHours(""); })} /> : null}
    </View>
    <SaveStatus error={error} success={success} />
  </InputCard>;
}

function SessionLoadInput({ workout, onSaved }: { workout: CompletedTraining; onSaved: () => Promise<void> }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [minutes, setMinutes] = useState(workout.minutes?.toString() ?? "");
  const [rpe, setRpe] = useState(workout.sessionRpe?.toString() ?? "");
  const { busy, error, success, save } = useSave(onSaved);
  return <View style={styles.fields}>
    <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{workout.title}</Text>
    <View style={styles.row}>
      <TrainingNumberField label={`${workout.title} elapsed minutes`} value={minutes} onChangeText={setMinutes} editable={!busy} maxLength={10} decimal />
      <TrainingNumberField label={`${workout.title} session RPE (0–10)`} value={rpe} onChangeText={setRpe} editable={!busy} decimal />
    </View>
    <InputButton label={`Save load for ${workout.title}`} disabled={busy} onPress={() => void save(() => setCompletedTrainingLoad(db, workout.id, numeric(minutes), numeric(rpe)))} />
    <SaveStatus error={error} success={success} />
  </View>;
}

export function TrainingDayInput({ today, timezone, sessions, confirmations, onSaved }: { today: string; timezone: string; sessions: CompletedTraining[]; confirmations: TrainingDayConfirmation[]; onSaved: () => Promise<void> }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const yesterday = shiftDate(today, -1);
  const [day, setDay] = useState(yesterday);
  const { busy, error, success, save } = useSave(onSaved);
  const workouts = sessions.filter(item => item.localDate === day);
  const confirmation = confirmations.find(item => item.localDate === day)?.kind;
  const conflicting = confirmation === "rest" && workouts.length > 0;
  const canConfirm = workouts.every(workout => sessionLoad(workout.minutes, workout.sessionRpe) !== null);
  return <InputCard title="TRAINING DAY LOG">
    <View style={styles.navigation}>
      <InputButton label="Previous training day" icon="chevron-back" disabled={busy} onPress={() => setDay(value => shiftDate(value, -1))} />
      <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{formatDisplayDate(day)}</Text>
      <InputButton label="Next training day" icon="chevron-forward" disabled={busy || day >= today} onPress={() => setDay(value => shiftDate(value, 1))} />
    </View>
    {workouts.map(workout => <SessionLoadInput key={workout.id} workout={workout} onSaved={onSaved} />)}
    {!workouts.length ? <Text style={{ color: theme.colors.textMuted }}>No completed workouts logged.</Text> : null}
    {day < today ? <View style={styles.row}>
      <InputButton label={workouts.length ? "Confirm day complete" : "Confirm rest day"} selected={confirmation !== undefined && !conflicting && canConfirm} disabled={busy || !canConfirm}
        onPress={() => void save(() => setTrainingDayConfirmation(db, day, workouts.length ? "complete" : "rest", timezone))} />
      {confirmation ? <InputButton label="Clear confirmation" disabled={busy} onPress={() => void save(() => setTrainingDayConfirmation(db, day, null, timezone))} /> : null}
    </View> : null}
    <SaveStatus error={error} success={success} />
  </InputCard>;
}

export function OutputTestInput({ onSaved }: { onSaved: () => Promise<void> }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [protocol, setProtocol] = useState("");
  const [output, setOutput] = useState("");
  const [direction, setDirection] = useState<"higher" | "elapsed-time">("higher");
  const { busy, error, success, save } = useSave(onSaved);
  return <InputCard title="LOG A COMPARABLE OUTPUT TEST">
    <Text style={{ color: theme.colors.textMuted }}>Include the test, setup and unit in its name. Use the same name and setup when repeating it.</Text>
    <TextInput accessibilityLabel="Test name, setup and unit" editable={!busy} maxLength={100} value={protocol} onChangeText={setProtocol} placeholder="e.g. 30 m track sprint · seconds" placeholderTextColor={theme.colors.textMuted} style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.borderStrong }]} />
    <View style={styles.row}>
      <InputButton label="Higher is better" selected={direction === "higher"} disabled={busy} onPress={() => setDirection("higher")} />
      <InputButton label="Elapsed time" selected={direction === "elapsed-time"} disabled={busy} onPress={() => setDirection("elapsed-time")} />
    </View>
    <TrainingNumberField label="Measured result" value={output} onChangeText={setOutput} editable={!busy} maxLength={14} decimal />
    <InputButton label="Save output test" disabled={busy} onPress={() => void save(() => saveTrainingOutputTest(db, { observedAt: Date.now(), comparisonKey: protocol, direction, output: numeric(output) }))} />
    <SaveStatus error={error} success={success} />
  </InputCard>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 12 }, header: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }, navigation: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fields: { gap: 8 }, button: { borderWidth: 1, borderRadius: 12, minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, alignSelf: "flex-start" },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12 },
});
