import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../../components/ActionButton";
import { SegmentedSelector } from "../../components/nutrition/SegmentedSelector";
import { TrainingNumberField } from "../../components/training/TrainingNumberField";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { activityFormValues, activityFromForm, type SkillActivityForm } from "../../skill/activityForm";
import { getSkillActivity } from "../../skill/catalog";
import { updateActivity } from "../../skill/drafts";
import type { SkillDraft } from "../../skill/types";
import { useSkillWorkspace } from "../../state/SkillWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;
const timingOptions = [{ value: "reps", label: "Reps" }, { value: "rounds", label: "Rounds" }] as const;

export function SkillActivityEditorScreen({ activityId, baseline, fresh }: { activityId: string; baseline: string; fresh: boolean }) {
  const { theme } = useAppTheme();
  const workspace = useSkillWorkspace();
  const draft = workspace.draft;
  const source = draft?.activities.find((activity) => activity.id === activityId);
  const [error, setError] = useState<string | null>(null);
  const form = source ? workspace.activityForm?.activityId === activityId ? workspace.activityForm.value : activityFormValues(source) : null;

  function update(patch: Partial<SkillActivityForm>) {
    if (!form) return;
    setError(null);
    workspace.setActivityForm({ activityId, value: { ...form, ...patch } });
  }
  function back() {
    const changed = source && form && JSON.stringify(form) !== JSON.stringify(activityFormValues(source));
    if (!fresh && !changed) { workspace.setActivityForm(null); workspace.pop(); return; }
    workspace.requestConfirm({
      confirmLabel: fresh ? "Remove" : "Discard",
      title: fresh ? "Remove activity?" : "Discard activity changes?",
      message: fresh ? "This activity will leave the session." : "Changes to this activity will be discarded.",
      onConfirm: () => { workspace.setActivityForm(null); workspace.updateDraft(JSON.parse(baseline) as SkillDraft); workspace.pop(); },
    });
  }
  useEffect(() => {
    workspace.registerBackHandler(() => { back(); return true; });
    return () => workspace.registerBackHandler(null);
  });
  function complete() {
    if (!draft || !source || !form) return;
    const result = activityFromForm(source, form);
    if (!result.activity) { feedbackWarn(); setError(result.error); return; }
    workspace.updateDraft(updateActivity(draft, activityId, result.activity));
    workspace.setActivityForm(null);
    feedbackConfirm();
    workspace.pop(workspace.stack.at(-2)?.name === "picker" ? 2 : 1);
  }

  if (!source || !form) return null;
  const definition = getSkillActivity(source.activityKey);
  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={source.name} onClose={workspace.closeBranch} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroller}>
        <SegmentedSelector accessibilityLabel="Activity parameters" onChange={(mode) => update({ mode })} options={timingOptions} value={form.mode} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>PARAMETERS</Text>
          <View style={styles.grid}>
            {form.mode === "reps" ? <>
              <TrainingNumberField label="Sets" value={form.sets} onChangeText={(sets) => update({ sets })} maxLength={3} />
              <TrainingNumberField label="Reps" value={form.reps} onChangeText={(reps) => update({ reps })} maxLength={3} />
              <TrainingNumberField label="Rest between sets (s)" value={form.restBetweenSets} onChangeText={(restBetweenSets) => update({ restBetweenSets })} placeholder="Optional" maxLength={5} />
            </> : <>
              <TrainingNumberField label="Work (s)" value={form.work} onChangeText={(work) => update({ work })} maxLength={6} />
              <TrainingNumberField label="Rest (s)" value={form.rest} onChangeText={(rest) => update({ rest })} maxLength={6} />
              <TrainingNumberField label="Rounds" value={form.rounds} onChangeText={(rounds) => update({ rounds })} maxLength={5} />
            </>}
            <TrainingNumberField label="RPE" value={form.rpe} onChangeText={(rpe) => update({ rpe })} placeholder="Optional" maxLength={3} />
          </View>
          {definition?.modes ? <SegmentedSelector accessibilityLabel="Activity intensity" compact onChange={(sessionMode) => update({ sessionMode })} options={definition.modes.map((mode) => ({ value: mode.mode, label: mode.label }))} value={form.sessionMode ?? "medium"} /> : null}
        </View>
        {error ? <Text accessibilityRole="alert" selectable style={{ color: theme.colors.tertiary }}>{error}</Text> : null}
      </ScrollView>
      <WorkflowFooter backLabel="Back" onBack={back}><ActionButton label={fresh ? "Add Activity" : "Done"} onPress={complete} style={styles.action} /></WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 }, scroller: { flex: 1 },
  content: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  card: { padding: tokens.spacing.lg, gap: tokens.spacing.md, borderWidth: 1, borderRadius: tokens.radius.lg },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  action: { flex: 1 },
});
