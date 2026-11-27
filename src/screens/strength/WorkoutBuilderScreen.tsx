import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { useExerciseTable } from "../../components/strength/ExerciseTable";
import { EstimatedFocusButton } from "../../components/training/EstimatedFocusButton";
import { createId } from "../../conditioning/ids";
import { archiveStrengthTemplate, completeStrengthSession, saveStrengthTemplate, listSameLiftReferences, logStrengthSession } from "../../data/strengthRepository";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { addCatalogExercise, MAX_EXERCISES, removeExercise, strengthSessionTime, TITLE_MAX, updateExercise, validateStrengthDraft } from "../../strength/drafts";
import { estimateDraftDurationSeconds, formatDurationSeconds } from "../../strength/duration";
import { emphasisFromDraft, emphasisHeadline, emphasisMarkerColor, type EmphasisReference } from "../../strength/emphasis";
import type { StrengthDraft } from "../../strength/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;
const noReferences = new Map<string, EmphasisReference>();

function templateContent(draft: StrengthDraft) {
  return JSON.stringify({
    title: draft.title.trim(),
    exercises: draft.exercises.map((exercise) => ({
      id: exercise.id,
      notes: exercise.notes.trim(),
      target: exercise.target,
    })),
  });
}

export function WorkoutBuilderScreen({ completingPlan = false }: { completingPlan?: boolean }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useStrengthWorkspace();
  const { draft, saving, updateDraft } = workspace;
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ key: string; references: Map<string, EmphasisReference> } | null>(null);
  const writing = useRef(false);
  const pageRef = useRef<ComponentRef<typeof View>>(null);
  const mode = draft?.sessionMode ?? "completed";
  const planned = mode === "planned";
  const exercises = draft?.exercises ?? [];
  const timestamp = draft ? strengthSessionTime(draft) : 0;
  const exerciseIds = JSON.stringify(exercises.flatMap((exercise) =>
    exercise.catalogExerciseId ? [exercise.catalogExerciseId] : [],
  ));
  const historyKey = JSON.stringify([exerciseIds, timestamp]);

  const { exerciseTable, exerciseOverlay, dismissExerciseOverlay, onExerciseOverlayLayout } = useExerciseTable({
    pageRef,
    exercises,
    mode,
    disabled: saving,
    prescriptionReadOnly: completingPlan,
    onAddExercise: (exercise) => {
      if (exercises.length >= MAX_EXERCISES) {
        setError("A workout can contain up to 40 exercises.");
        feedbackWarn();
        return;
      }
      setError(null);
      updateDraft((current) => addCatalogExercise(current, exercise));
    },
    onChangeExercise: (id, update) => {
      setError(null);
      updateDraft((current) => updateExercise(current, id, update));
    },
    onRemoveExercise: (id) => {
      workspace.requestConfirm({
        confirmLabel: "Remove",
        message: `${exercises.find((exercise) => exercise.id === id)?.name ?? "This exercise"} will leave this workout.`,
        title: "Remove exercise?",
        onConfirm: () => {
          setError(null);
          updateDraft((current) => removeExercise(current, id));
        },
      });
    },
  });

  useEffect(() => {
    if (workspace.stack.at(-1)?.name !== "builder") return;
    workspace.registerBackHandler(() => {
      if (!dismissExerciseOverlay()) workspace.backFromBuilder();
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [dismissExerciseOverlay, workspace]);

  useEffect(() => {
    let cancelled = false;
    void listSameLiftReferences(db, JSON.parse(exerciseIds) as string[], timestamp)
      .then((references) => {
        if (!cancelled) setHistory({ key: historyKey, references });
      })
      .catch(() => {
        if (!cancelled) setHistory(null);
      });
    return () => { cancelled = true; };
  }, [db, exerciseIds, historyKey, timestamp]);

  if (!draft) return null;

  const savedDraft = !completingPlan && workspace.savedSnapshot ? JSON.parse(workspace.savedSnapshot) as StrengthDraft : null;
  const invalidTargetInput = exercises.some(({ restSecondsInput, target }) =>
    restSecondsInput?.trim() && target?.restSeconds == null,
  );
  const isSaved = draft.sourceTemplateId != null && draft.saveAsTemplate && savedDraft != null
    && !invalidTargetInput && templateContent(draft) === templateContent(savedDraft);
  const preview = emphasisFromDraft(exercises, history?.key === historyKey ? history.references : noReferences, mode);

  async function toggleSaved() {
    if (!draft || writing.current) return;
    dismissExerciseOverlay();
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
    dismissExerciseOverlay();
    Keyboard.dismiss();
    const now = Date.now();
    const validation = validateStrengthDraft(draft, "log", now);
    if (validation) {
      feedbackWarn();
      setError(validation);
      return;
    }
    writing.current = true;
    workspace.setSaving(true);
    setError(null);
    try {
      if (completingPlan) {
        await completeStrengthSession(db, draft, { now });
      } else {
        await logStrengthSession(db, draft, { now, persistTemplate: false });
      }
      feedbackConfirm();
      bumpTimeline();
      workspace.bumpRevision();
      workspace.setSaving(false);
      if (completingPlan) {
        workspace.openDetail(draft.sessionId);
      } else {
        workspace.resetWorkspace();
      }
    } catch (cause) {
      feedbackWarn();
      setError(cause instanceof Error ? cause.message : "Couldn’t save session. Try again.");
    } finally {
      writing.current = false;
      workspace.setSaving(false);
    }
  }

  function close() {
    dismissExerciseOverlay();
    workspace.closeBranch();
  }

  return (
    <View ref={pageRef} collapsable={false} onLayout={onExerciseOverlayLayout} style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        title={planned ? "Plan Session" : "Log Session"}
        onClose={close}
        right={
          <View pointerEvents={saving ? "none" : "auto"}>
            <LogTimeChanger
              label={planned ? "Workout start time" : "Workout end time"}
              timeBoundary={planned ? "future" : "past"}
              onChange={(date) => {
                if (saving) return;
                setError(null);
                const instant = date.getTime();
                updateDraft((current) => planned ? { ...current, scheduledStartAt: instant } : { ...current, endedAt: instant });
              }}
              value={new Date(timestamp)}
            />
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.page}>
        <View style={styles.titleBlock}>
          {completingPlan ? (
            <Text style={[styles.title, { color: theme.colors.text }]}>{draft.title}</Text>
          ) : (
            <TextInput
              accessibilityLabel="Workout title"
              editable={!saving}
              maxLength={TITLE_MAX}
              onChangeText={(title) => {
                setError(null);
                updateDraft((current) => ({ ...current, title }));
              }}
              placeholder="Workout title"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, color: theme.colors.text }]}
              value={draft.title}
            />
          )}
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {planned ? "Start time" : "End time"} · Estimated duration {formatDurationSeconds(estimateDraftDurationSeconds(exercises, mode))}
          </Text>
        </View>
        {exerciseTable}
        <EstimatedFocusButton
          disabled={saving}
          value={emphasisHeadline(preview)}
          onPress={() => workspace.push({ key: createId(), name: "emphasis", sessionId: null })}
          color={preview.workSets ? emphasisMarkerColor(preview) : theme.colors.textMuted}
        />
      </ScrollView>
      {error ? <Text accessibilityRole="alert" selectable style={[styles.error, { color: theme.colors.text }]}>{error}</Text> : null}
      <WorkflowFooter
        backLabel={workspace.stack.length > 1 ? "Back" : "Cancel"}
        disabled={saving}
        equalActions
        onBack={() => {
          dismissExerciseOverlay();
          workspace.backFromBuilder();
        }}
      >
        {!completingPlan ? <ActionButton disabled={saving} label={isSaved ? "Unsave" : "Save"} onPress={() => { void toggleSaved(); }} tone="secondary" style={styles.flex} /> : null}
        <ActionButton disabled={saving} label={planned ? "Plan Session" : "Log Session"} onPress={() => { void log(); }} style={styles.flex} />
      </WorkflowFooter>
      {exerciseOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 12, fontSize: 16 },
  title: { paddingHorizontal: 4, fontSize: 20, fontWeight: "800" },
  titleBlock: { gap: 6 },
  subtitle: { paddingHorizontal: 4, fontSize: 12, fontVariant: ["tabular-nums"] },
  error: { fontSize: 14, paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.xs },
  flex: { flex: 1, minWidth: 0 },
});
