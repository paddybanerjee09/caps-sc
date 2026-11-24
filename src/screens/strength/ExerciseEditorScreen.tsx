import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { ExerciseImage } from "../../components/strength/ExerciseImage";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { listStrengthExercises } from "../../data/strengthRepository";
import { MAX_NOTES, updateExercise } from "../../strength/drafts";
import { exerciseFormValues, exerciseFromForm, type ExerciseForm } from "../../strength/exerciseForm";
import { strengthExerciseImageUrl } from "../../strength/media";
import type { StrengthDraft } from "../../strength/types";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;
const fields = [
  ["sets", "Sets"],
  ["reps", "Reps"],
  ["rpe", "RPE"],
  ["restSeconds", "Rest between sets (s)"],
] as const;

export function ExerciseEditorScreen({ baseline, exerciseId, fresh }: {
  baseline: string;
  exerciseId: string;
  fresh: boolean;
}) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useStrengthWorkspace();
  const { draft } = workspace;
  const source = draft?.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
  const form: ExerciseForm = workspace.editorForm?.exerciseId === exerciseId ? workspace.editorForm.value : source ? exerciseFormValues(source) : { sets: "1", reps: "5", rpe: "", restSeconds: "", notes: "" };
  function setForm(update: (current: ExerciseForm) => ExerciseForm) {
    workspace.setEditorForm({ exerciseId, value: update(form) });
  }
  const [error, setError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const changed = source != null && JSON.stringify(form) !== JSON.stringify(exerciseFormValues(source));

  useEffect(() => {
    let cancelled = false;
    if (source?.catalogExerciseId) {
      void listStrengthExercises(db).then((catalog) => {
        const exercise = catalog.find((item) => item.id === source.catalogExerciseId);
        if (!cancelled) setImageUri(exercise ? strengthExerciseImageUrl(exercise) : null);
      }).catch(() => { if (!cancelled) setImageUri(null); });
    }
    return () => { cancelled = true; };
  }, [db, source?.catalogExerciseId]);

  function back() {
    if (!fresh && !changed) { workspace.setEditorForm(null); workspace.pop(); return; }
    workspace.requestConfirm({
      confirmLabel: fresh ? "Remove" : "Discard",
      message: fresh ? "This exercise will leave the workout." : "Changes to this exercise will be discarded.",
      onConfirm: () => { workspace.setEditorForm(null); workspace.updateDraft(JSON.parse(baseline) as StrengthDraft); workspace.pop(); },
      title: fresh ? "Remove exercise?" : "Discard exercise changes?",
    });
  }

  useEffect(() => {
    workspace.registerBackHandler(() => { back(); return true; });
    return () => workspace.registerBackHandler(null);
  });

  function close() {
    if (!changed) { workspace.closeBranch(); return; }
    workspace.requestConfirm({ confirmLabel: "Discard", message: "Unlogged changes will be discarded.", onConfirm: workspace.resetWorkspace, title: "Leave session?" });
  }

  function complete() {
    if (!draft || !source) return;
    const result = exerciseFromForm(source, form);
    if (!result.exercise) { feedbackWarn(); setError(result.error); return; }
    workspace.updateDraft(updateExercise(draft, source.id, () => result.exercise!));
    feedbackConfirm();
    workspace.setEditorForm(null);
    workspace.pop(workspace.stack.at(-2)?.name === "picker" ? 2 : 1);
  }

  if (!draft || !source) return null;
  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={source.name} onClose={close} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroller}>
        {imageUri ? <ExerciseImage uri={imageUri} name={source.name} large /> : null}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text accessibilityRole="header" style={[styles.name, { color: theme.colors.text }]}>{source.name}</Text>
          <View style={styles.grid}>
            {fields.map(([field, label]) => (
              <View key={field} style={styles.field}>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="number-pad"
                  maxLength={field === "restSeconds" ? 5 : 3}
                  onChangeText={(value) => { setError(null); setForm((current) => ({ ...current, [field]: value })); }}
                  placeholder={field === "rpe" || field === "restSeconds" ? "Optional" : ""}
                  placeholderTextColor={theme.colors.textMuted}
                  selectTextOnFocus={form[field] === "Mixed"}
                  style={[styles.input, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
                  value={form[field]}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>NOTES</Text>
          <TextInput accessibilityLabel="Exercise notes" maxLength={MAX_NOTES} multiline onChangeText={(notes) => { setError(null); setForm((current) => ({ ...current, notes })); }} placeholder="Optional" placeholderTextColor={theme.colors.textMuted} style={[styles.input, styles.notes, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong, color: theme.colors.text }]} value={form.notes} />
        </View>
        {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.tertiary }}>{error}</Text> : null}
      </ScrollView>
      <WorkflowFooter backLabel="Back" onBack={back}>
        <ActionButton label={fresh ? "Add Exercise" : "Done"} onPress={complete} style={styles.action} />
      </WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  content: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  card: { borderWidth: 1, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: tokens.spacing.md },
  name: { fontSize: 18, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  field: { flexGrow: 1, flexBasis: "44%", gap: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, fontSize: 16, fontVariant: ["tabular-nums"] },
  notes: { minHeight: 80, paddingTop: 12, textAlignVertical: "top" },
  action: { flex: 1 },
});
