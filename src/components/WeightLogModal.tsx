import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import type { TimelineEntry } from "../data/timelineRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, themes } from "../theme/theme";
import { formatDisplayDate } from "../utils/displayDate";
import { feedbackConfirm, feedbackWarn } from "../utils/feedback";
import { parseDecimalInput } from "../utils/numericInput";
import { convertKilogramsToWeight, weightInputToKilograms } from "../utils/weight";
import { FormModal } from "./FormModal";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
type WeightLogModalProps = {
  entryToEdit?: TimelineEntry;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

/** The same modal owns new logs from Home and Athlete Information and history edits. */
export function WeightLogModal(props: WeightLogModalProps) {
  const { unitSettings } = useAppState();
  return props.visible ? <WeightLogForm key={`${props.entryToEdit?.id ?? "new"}-${unitSettings.weight}`} {...props} /> : null;
}

function WeightLogForm({ entryToEdit, onClose, onDeleted, onSaved }: WeightLogModalProps) {
  const { theme } = useAppTheme();
  const { athleteProfile, deleteWeightLog, logWeight, unitSettings, updateWeightLog } = useAppState();
  const editing = entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null;
  const [initialKg] = useState(() => editing ? entryToEdit.weightKg : athleteProfile.weightKg);
  const [draftWeight, setDraftWeight] = useState(() => initialKg === null ? "" : String(Math.round(convertKilogramsToWeight(initialKg, unitSettings.weight) * 10) / 10));
  const [draftLoggedAt, setDraftLoggedAt] = useState(() => new Date(editing ? entryToEdit.startAt : Date.now()));
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const weight = parseDecimalInput(draftWeight);
  const valid = weight !== null && weight > 0 && Number.isFinite(draftLoggedAt.getTime());
  const unitLabel = unitSettings.weight === "metric" ? "kg" : "lb";

  async function saveWeight() {
    if (busy.current || !valid) return;
    if (draftLoggedAt.getTime() > Date.now()) { setError("Choose a weigh-in time that is not in the future."); return; }
    const weightKg = weightInputToKilograms(draftWeight, unitSettings.weight, initialKg);
    if (weightKg === null) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const loggedAt = draftLoggedAt.getTime();
    try {
      if (editing) await updateWeightLog(entryToEdit.id, weightKg, loggedAt);
      else await logWeight(weightKg, loggedAt);
    } catch {
      busy.current = false;
      setSaving(false);
      setError("Couldn't save weight log. Please try again.");
      return;
    }
    feedbackConfirm();
    // Storage has committed. A consumer refresh error must never re-enable a
    // second insert of this draft. AppState also invalidates all weight readers.
    try { await onSaved?.(loggedAt); }
    finally { onClose(); }
  }

  async function deleteExistingWeightLog() {
    if (!editing || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try { await deleteWeightLog(entryToEdit.id); }
    catch {
      busy.current = false;
      setSaving(false);
      setError("Couldn't delete weight log. Please try again.");
      return;
    }
    feedbackWarn();
    try { await onDeleted?.(); }
    finally { onClose(); }
  }

  const deleteAction = editing ? (
    <PressOpacity accessibilityLabel="Delete weight log" disabled={saving} onPress={() => Alert.alert("Delete weight log?", "This cannot be undone.", [
      { style: "cancel", text: "Cancel" },
      { onPress: () => { void deleteExistingWeightLog().catch(() => {}); }, style: "destructive", text: "Delete" },
    ])} style={[styles.deleteButton, { borderColor: appColorPalette.red }]}>
      <Ionicons color={appColorPalette.red} name="trash-outline" size={18} />
      <Text style={[styles.actionText, { color: appColorPalette.red }]}>Delete</Text>
    </PressOpacity>
  ) : undefined;

  return (
    <FormModal title={editing ? "Edit Weight Log" : "Log Bodyweight"} onClose={() => { if (!busy.current) onClose(); }} onSave={() => void saveWeight().catch(() => {})} saving={saving} saveDisabled={!valid} footer={deleteAction} error={error}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text }]}>Weight ({unitLabel})</Text>
        <TextInput accessibilityLabel={`Bodyweight in ${unitLabel}`} editable={!saving} inputMode="decimal" keyboardType="decimal-pad" onChangeText={setDraftWeight} placeholder="Enter weight" placeholderTextColor={theme.colors.textMuted} selectTextOnFocus style={[styles.input, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, color: theme.colors.text }]} value={draftWeight} />
        {weight === null || weight <= 0 ? <Text accessibilityRole="alert" style={{ color: appColorPalette.red }}>Enter a weight greater than zero.</Text> : null}
      </View>
      <View pointerEvents={saving ? "none" : "auto"} style={styles.timestamp}>
        <View style={styles.timestampText}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Weigh-in date and time</Text>
          <Text style={[styles.date, { color: theme.colors.textMuted }]}>{formatDisplayDate(draftLoggedAt)}</Text>
        </View>
        <LogTimeChanger label="Weigh-in date and time" maximumDate={new Date()} onChange={setDraftLoggedAt} value={draftLoggedAt} />
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  field: { gap: tokens.spacing.sm },
  label: { fontSize: 14, fontWeight: "700" },
  input: { borderRadius: tokens.radius.md, borderWidth: 1, fontSize: 22, fontVariant: ["tabular-nums"], minHeight: 52, paddingHorizontal: tokens.spacing.md },
  timestamp: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.md },
  timestampText: { flex: 1, gap: 4, minWidth: 120 },
  date: { fontSize: 13, fontVariant: ["tabular-nums"] },
  deleteButton: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 52, paddingHorizontal: tokens.spacing.sm },
  actionText: { fontSize: 14, fontWeight: "700" },
});
