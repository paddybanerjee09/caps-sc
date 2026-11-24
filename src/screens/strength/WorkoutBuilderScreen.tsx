import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { createId } from "../../conditioning/ids";
import { archiveStrengthTemplate, saveStrengthTemplate, listSameLiftReferences, logStrengthSession } from "../../data/strengthRepository";
import { MAX_EXERCISES, projectTemplateDraft, removeExercise, tableField, validateStrengthDraft } from "../../strength/drafts";
import { estimateDraftDurationSeconds, formatDurationSeconds } from "../../strength/duration";
import { emphasisFromDraft, emphasisHeadline, emphasisMarkerColor, type StrengthEmphasis } from "../../strength/emphasis";
import type { StrengthDraft } from "../../strength/types";
import { formatRestSeconds, formatRpe } from "../../strength/units";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

function templateContent(draft: StrengthDraft) {
  const projected = projectTemplateDraft(draft);
  return JSON.stringify({ title: projected.title.trim(), exercises: projected.exercises });
}

export function WorkoutBuilderScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useStrengthWorkspace();
  const { draft, saving } = workspace;
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<StrengthEmphasis | null>(null);
  const writing = useRef(false);

  useEffect(() => {
    if (workspace.stack.at(-1)?.name !== "builder") return;
    workspace.registerBackHandler(() => { workspace.closeBranch(); return true; });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  useEffect(() => {
    if (!draft) return;
    let cancelled = false;
    void listSameLiftReferences(db, draft.exercises.flatMap((exercise) => exercise.catalogExerciseId ? [exercise.catalogExerciseId] : []), draft.endedAt)
      .then((references) => { if (!cancelled) setPreview(emphasisFromDraft(draft.exercises, references)); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [db, draft]);

  if (!draft) return null;

  const savedDraft = workspace.savedSnapshot ? JSON.parse(workspace.savedSnapshot) as typeof draft : null;
  const isSaved = draft.sourceTemplateId != null && draft.saveAsTemplate && savedDraft != null && templateContent(draft) === templateContent(savedDraft);
  const exercises = draft.exercises.filter((exercise) => `${exercise.name} ${exercise.equipment}`.toLowerCase().includes(query.trim().toLowerCase()));
  const focusColor = preview ? emphasisMarkerColor(preview) : theme.colors.textMuted;
  const inputStyle = [styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, color: theme.colors.text }];
  const cardStyle = [styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }];

  async function toggleSaved() {
    if (!draft || writing.current) return;
    writing.current = true;
    workspace.setSaving(true);
    setError(null);
    try {
      if (isSaved && draft.sourceTemplateId) {
        await archiveStrengthTemplate(db, draft.sourceTemplateId);
        workspace.markSaved({ ...draft, sourceTemplateId: null, saveAsTemplate: false });
      } else {
        const templateId = await saveStrengthTemplate(db, draft);
        workspace.markSaved({ ...draft, sourceTemplateId: templateId, saveAsTemplate: true });
      }
      workspace.bumpRevision();
      feedbackConfirm();
    } catch (cause) {
      feedbackWarn();
      setError(cause instanceof Error ? cause.message : "Couldn’t save workout. Try again.");
    } finally {
      writing.current = false;
      workspace.setSaving(false);
    }
  }

  async function log() {
    if (!draft || writing.current) return;
    const now = Date.now();
    const validation = validateStrengthDraft(draft, "log", now);
    if (validation) { feedbackWarn(); setError(validation); return; }
    writing.current = true;
    workspace.setSaving(true);
    setError(null);
    try {
      await logStrengthSession(db, draft, { now, persistTemplate: false });
      feedbackConfirm();
      bumpTimeline();
      workspace.bumpRevision();
      workspace.setSaving(false);
      workspace.resetWorkspace();
    } catch (cause) {
      feedbackWarn();
      setError(cause instanceof Error ? cause.message : "Couldn’t log session. Try again.");
    } finally {
      writing.current = false;
      workspace.setSaving(false);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title="Log Session" onClose={workspace.closeBranch} right={<LogTimeChanger maximumDate={new Date()} onChange={(date) => { if (!saving) workspace.updateDraft({ ...draft, endedAt: date.getTime() }); }} value={new Date(draft.endedAt)} />} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scroller}>
        <TextInput accessibilityLabel="Workout title" editable={!saving} maxLength={80} onChangeText={(title) => { setError(null); workspace.updateDraft({ ...draft, title }); }} placeholder="Workout title" placeholderTextColor={theme.colors.textMuted} style={inputStyle} value={draft.title} />
        <View style={cardStyle}>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>ESTIMATED DURATION</Text>
          <Text style={[styles.duration, { color: theme.colors.text }]}>{formatDurationSeconds(estimateDraftDurationSeconds(draft.exercises))}</Text>
        </View>
        <TextInput accessibilityLabel="Search exercises in this workout" editable={!saving} onChangeText={setQuery} placeholder="Search exercises" placeholderTextColor={theme.colors.textMuted} style={inputStyle} value={query} />
        <View style={cardStyle}>
          <Text accessibilityRole="header" style={[styles.kicker, { color: theme.colors.textMuted }]}>EXERCISES</Text>
          <ActionButton disabled={saving || draft.exercises.length >= MAX_EXERCISES} label="Add Exercises" onPress={() => { workspace.setSearchQuery(""); workspace.push({ key: createId(), name: "picker" }); }} tone="secondary" />
          {exercises.length === 0 ? <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{query.trim() ? "No matching exercises." : "No exercises."}</Text> : exercises.map((exercise) => (
            <View key={exercise.id} style={[styles.exercise, { borderColor: theme.colors.border }]}>
              <Text style={[styles.exerciseName, { color: theme.colors.text }]}>{exercise.name}</Text>
              <Text style={[styles.metrics, { color: theme.colors.textMuted }]}>{exercise.sets.length} sets · {tableField(exercise.sets, (set) => String(set.reps))} reps · RPE {tableField(exercise.sets, (set) => formatRpe(set.rpe))} · {tableField(exercise.sets, (set) => formatRestSeconds(set.restSeconds))} rest</Text>
              {exercise.notes ? <Text numberOfLines={2} style={[styles.hint, { color: theme.colors.textMuted }]}>{exercise.notes}</Text> : null}
              <View style={styles.row}>
                <ActionButton disabled={saving} label="Edit" onPress={() => workspace.push({ baseline: JSON.stringify(draft), exerciseId: exercise.id, fresh: false, key: createId(), name: "editor" })} tone="secondary" style={styles.flex} />
                <ActionButton disabled={saving} label="Remove" onPress={() => workspace.requestConfirm({ confirmLabel: "Remove", message: `${exercise.name} will leave this workout.`, onConfirm: () => workspace.updateDraft(removeExercise(draft, exercise.id)), title: "Remove exercise?" })} tone="quiet" style={styles.flex} />
              </View>
            </View>
          ))}
        </View>
        <ActionButton disabled={saving} label={`Estimated focus · ${preview ? emphasisHeadline(preview) : "Not enough evidence"}`} onPress={() => workspace.push({ key: createId(), name: "emphasis", sessionId: null })} style={{ borderColor: focusColor }} tone="secondary" />
        {error ? <Text accessibilityRole="alert" selectable style={[styles.error, { color: theme.colors.tertiary }]}>{error}</Text> : null}
      </ScrollView>
      <WorkflowFooter disabled={saving} onBack={workspace.closeBranch}>
        <ActionButton disabled={saving} label={isSaved ? "Unsave" : "Save"} onPress={() => { void toggleSaved(); }} tone="secondary" style={styles.flex} />
        <ActionButton disabled={saving} label="Log Session" onPress={() => { void log(); }} style={styles.flex} />
      </WorkflowFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  content: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  card: { borderWidth: 1, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, gap: tokens.spacing.md },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 12, fontSize: 16 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  duration: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  exercise: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  exerciseName: { fontSize: 16, fontWeight: "700" },
  metrics: { fontSize: 13, lineHeight: 19, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 14 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1, minWidth: 0 },
});
