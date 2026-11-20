import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { TimelineEntry } from "../data/timelineRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, readableTextColor, themes } from "../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../utils/feedback";
import { convertKilogramsToWeight, convertWeightToKilograms } from "../utils/weight";
import { parseDecimalInput } from "../utils/numericInput";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";
import { WorkflowFooter, WorkflowHeader } from "./WorkflowChrome";

const tokens = themes.dark;

type WeightLogModalProps = {
  entryToEdit?: TimelineEntry;
  onClose: () => void;
  onDeleted?: () => Promise<void> | void;
  onSaved?: (loggedAt: number) => Promise<void> | void;
  visible: boolean;
};

export function WeightLogModal(props: WeightLogModalProps) {
  const { unitSettings } = useAppState();
  return props.visible ? <WeightLogForm key={`${props.entryToEdit?.id ?? "new"}-${unitSettings.weight}`} {...props} /> : null;
}

function WeightLogForm({ entryToEdit, onClose, onDeleted, onSaved, visible }: WeightLogModalProps) {
  const { theme } = useAppTheme();
  const { athleteProfile, deleteWeightLog, logWeight, unitSettings, updateWeightLog } = useAppState();
  const [draftWeight, setDraftWeight] = useState(() => {
    const baseKg = entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null
      ? entryToEdit.weightKg : athleteProfile.weightKg ?? 70;
    return String(Math.round(convertKilogramsToWeight(baseKg, unitSettings.weight) * 10) / 10);
  });
  const [draftLoggedAt, setDraftLoggedAt] = useState(() => new Date(entryToEdit?.kind === "weight" ? entryToEdit.startAt : Date.now()));
  const [saving, setSaving] = useState(false);
  const weight = parseDecimalInput(draftWeight);
  const valid = weight !== null && weight > 0;
  const editing = entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null;

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!saving) onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, saving, visible]);

  if (!visible) return null;
  const unitLabel = unitSettings.weight === "metric" ? "kg" : "lbs";
  const primaryText = readableTextColor(theme.colors.tertiary);

  async function saveWeight() {
    if (saving || weight === null || weight <= 0) return;
    const loggedAt = Math.min(draftLoggedAt.getTime(), Date.now());
    let weightKg = convertWeightToKilograms(weight, unitSettings.weight);
    setSaving(true);
    try {
      if (entryToEdit?.kind === "weight" && entryToEdit.weightKg !== null) {
        const originalDisplay = Math.round(convertKilogramsToWeight(entryToEdit.weightKg, unitSettings.weight) * 10) / 10;
        if (Math.abs(weight - originalDisplay) < 0.01) weightKg = entryToEdit.weightKg;
        await updateWeightLog(entryToEdit.id, weightKg, loggedAt);
      } else {
        await logWeight(weightKg, loggedAt);
      }
      feedbackConfirm();
      await onSaved?.(loggedAt);
      onClose();
    } catch {
      Alert.alert("Couldn't save weight log", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteExistingWeightLog() {
    if (entryToEdit?.kind !== "weight" || entryToEdit.weightKg === null || saving) return;
    setSaving(true);
    try {
      await deleteWeightLog(entryToEdit.id);
      feedbackWarn();
      await onDeleted?.();
      onClose();
    } catch {
      Alert.alert("Couldn't delete weight log", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteWeightLog() {
    feedbackWarn();
    Alert.alert("Delete weight log?", "This cannot be undone.", [
      { style: "cancel", text: "Cancel" },
      { onPress: () => { void deleteExistingWeightLog(); }, style: "destructive", text: "Delete" },
    ]);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        topInset={0}
        title={editing ? "Edit Weight Log" : "Log Bodyweight"}
        onClose={() => { if (!saving) onClose(); }}
        right={<LogTimeChanger label="Weigh-in time" maximumDate={new Date()} onChange={setDraftLoggedAt} value={draftLoggedAt} />}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Weight ({unitLabel})</Text>
          <TextInput
            accessibilityLabel={`Bodyweight in ${unitLabel}`}
            editable={!saving}
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setDraftWeight}
            placeholder="Enter weight"
            placeholderTextColor={theme.colors.textMuted}
            selectTextOnFocus
            style={[styles.input, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
            value={draftWeight}
          />
          {!valid ? <Text accessibilityRole="alert" style={{ color: appColorPalette.red }}>Enter a weight greater than zero.</Text> : null}
        </View>
      </ScrollView>
      <WorkflowFooter onBack={onClose} disabled={saving}>
        {editing ? (
          <PressOpacity accessibilityLabel="Delete weight log" disabled={saving} onPress={confirmDeleteWeightLog} style={[styles.deleteButton, { borderColor: appColorPalette.red }]}>
            <Ionicons color={appColorPalette.red} name="trash-outline" size={18} />
            <Text style={[styles.actionText, { color: appColorPalette.red }]}>Delete</Text>
          </PressOpacity>
        ) : null}
        <PressOpacity accessibilityLabel="Save weight log" disabled={saving || !valid} onPress={() => void saveWeight()} style={[styles.saveButton, { backgroundColor: theme.colors.tertiary }]}>
          <Text style={[styles.actionText, { color: primaryText }]}>{saving ? "Saving…" : "Save"}</Text>
        </PressOpacity>
      </WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill },
  body: { flexGrow: 1, padding: tokens.spacing.lg, gap: tokens.spacing.md },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.md, padding: tokens.spacing.lg },
  label: { fontSize: 14, fontWeight: "700" },
  input: { borderRadius: tokens.radius.md, borderWidth: 1, fontSize: 22, fontVariant: ["tabular-nums"], minHeight: 52, paddingHorizontal: tokens.spacing.md },
  saveButton: { alignItems: "center", borderRadius: tokens.radius.md, flex: 1, justifyContent: "center", minHeight: 52, paddingHorizontal: tokens.spacing.md },
  deleteButton: { flexDirection: "row", gap: 6, alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: tokens.spacing.md },
  actionText: { fontSize: 14, fontWeight: "700" },
});
