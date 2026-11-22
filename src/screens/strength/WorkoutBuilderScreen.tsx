import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { LogTimeChanger } from "../../components/LogTimeChanger";
import { PressOpacity } from "../../components/PressOpacity";
import { SimpleSwitch } from "../../components/SimpleSwitch";
import { createId } from "../../conditioning/ids";
import { formatLocalDate } from "../../conditioning/dates";
import {
  createCustomExercise,
  createStrengthTemplate,
  getStrengthTemplate,
  listSameLiftReferences,
  listStrengthExercises,
  listStrengthTemplates,
  logStrengthSession,
  type StrengthTemplateSummary,
} from "../../data/strengthRepository";
import { STRENGTH_SEARCH_PAGE, searchExercises } from "../../strength/catalog";
import {
  MAX_EXERCISES,
  addCatalogExercise,
  draftFromTemplate,
  projectTemplateDraft,
  removeExercise,
  saveWorkoutConsequence,
  tableField,
  validateStrengthDraft,
} from "../../strength/drafts";
import {
  estimateDraftDurationSeconds,
  formatDurationSeconds,
  sessionStartMs,
} from "../../strength/duration";
import {
  emphasisFromDraft,
  emphasisHeadline,
  emphasisMarkerColor,
  type StrengthEmphasis,
} from "../../strength/emphasis";
import type { CatalogExercise, ExerciseDraft, StrengthDraft } from "../../strength/types";
import { formatRestSeconds, formatRpe, formatSetLoad } from "../../strength/units";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

function clockNow() {
  return Date.now();
}

function savedLogDraft(
  template: NonNullable<Awaited<ReturnType<typeof getStrengthTemplate>>>,
  sessionId: string,
) {
  return draftFromTemplate(template, Date.now(), sessionId);
}

export function WorkoutBuilderScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline, unitSettings } = useAppState();
  const workspace = useStrengthWorkspace();
  const draft = workspace.draft;
  const mode = workspace.mode;
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [templates, setTemplates] = useState<StrengthTemplateSummary[]>([]);
  const [fromSavedOpen, setFromSavedOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<StrengthEmphasis | null>(null);
  const draftRef = useRef(draft);
  const snapshotRef = useRef(workspace.savedSnapshot);
  const primaryText = readableTextColor(theme.colors.tertiary);

  useEffect(() => {
    draftRef.current = draft;
    snapshotRef.current = workspace.savedSnapshot;
  }, [draft, workspace.savedSnapshot]);

  useEffect(() => {
    const top = workspace.stack.at(-1);
    if (!draft || top?.name !== "builder") {
      return;
    }
    workspace.registerBackHandler(() => {
      const current = draftRef.current;
      if (!current || JSON.stringify(current) === snapshotRef.current) {
        workspace.resetWorkspace();
        return true;
      }
      workspace.requestConfirm({
        confirmLabel: "Discard",
        message: "This workout has unsaved changes.",
        onConfirm: () => workspace.resetWorkspace(),
        title: "Discard changes?",
      });
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [draft, workspace]);

  useEffect(() => {
    let cancelled = false;
    void listStrengthExercises(db).then((rows) => {
      if (!cancelled) {
        setCatalog(rows);
      }
    });
    void listStrengthTemplates(db).then((rows) => {
      if (!cancelled) {
        setTemplates(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, workspace.revision]);

  useEffect(() => {
    if (!draft) {
      return;
    }
    let cancelled = false;
    const cutoff = mode === "log" ? draft.endedAt : clockNow();
    void listSameLiftReferences(
      db,
      draft.exercises
        .map((exercise) => exercise.catalogExerciseId)
        .filter((id): id is string => id != null),
      cutoff,
    ).then((references) => {
      if (!cancelled) {
        setPreview(emphasisFromDraft(draft.exercises, references));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, draft, mode]);

  const results = useMemo(
    () => searchExercises(catalog, workspace.searchQuery, workspace.searchLimit),
    [catalog, workspace.searchLimit, workspace.searchQuery],
  );

  if (!draft || !mode) {
    return null;
  }

  const duration = estimateDraftDurationSeconds(draft.exercises);
  const dirty = JSON.stringify(draft) !== workspace.savedSnapshot;
  const focusColor = preview ? emphasisMarkerColor(preview) : theme.colors.textMuted;

  function requestClose() {
    if (!dirty) {
      workspace.resetWorkspace();
      return;
    }
    workspace.requestConfirm({
      confirmLabel: "Discard",
      message: "This workout has unsaved changes.",
      onConfirm: () => workspace.resetWorkspace(),
      title: "Discard changes?",
    });
  }

  function update(next: StrengthDraft) {
    setFormError(null);
    workspace.updateDraft(next);
  }

  async function applySaved(templateId: string) {
    const template = await getStrengthTemplate(db, templateId);
    if (!draft || !template || template.archivedAt) {
      feedbackWarn();
      setFormError("That saved workout is no longer available.");
      return;
    }
    update(savedLogDraft(template, draft.sessionId));
    setFromSavedOpen(false);
  }

  function addExercise(exercise: CatalogExercise) {
    if (draft!.exercises.length >= MAX_EXERCISES) {
      feedbackWarn();
      setFormError("This workout already has 40 exercises.");
      return;
    }
    const baseline = JSON.stringify(draft);
    const next = addCatalogExercise(draft!, exercise);
    const created = next.exercises.at(-1);
    update(next);
    if (created) {
      workspace.push({
        baseline,
        exerciseId: created.id,
        fresh: true,
        key: createId(),
        name: "editor",
      });
    }
  }

  async function addCustom() {
    try {
      const created = await createCustomExercise(db, workspace.searchQuery);
      workspace.bumpRevision();
      addExercise(created);
    } catch (error) {
      feedbackWarn();
      setFormError(error instanceof Error ? error.message : "Couldn’t add that exercise.");
    }
  }

  async function commit() {
    const now = clockNow();
    const checked = mode === "template" ? projectTemplateDraft(draft!) : draft!;
    const error = validateStrengthDraft(checked, mode === "template" ? "template" : "log", now);
    if (error) {
      feedbackWarn();
      setFormError(error);
      return;
    }
    if (mode === "log" && draft!.sourceTemplateId && !draft!.saveAsTemplate) {
      workspace.requestConfirm({
        confirmLabel: "Log and remove saved",
        message:
          "Logging removes this workout from Saved Workouts. The session stays on your calendar. Cancel leaves the saved workout in place.",
        onConfirm: () => {
          void writeSession(now);
        },
        title: "Remove saved workout?",
      });
      return;
    }
    await writeSession(now);
  }

  async function writeSession(now: number) {
    setSaving(true);
    try {
      if (mode === "template") {
        await createStrengthTemplate(db, draft!);
      } else {
        await logStrengthSession(db, draft!, { now });
        bumpTimeline();
      }
      feedbackConfirm();
      workspace.bumpRevision();
      workspace.resetWorkspace();
    } catch (error) {
      feedbackWarn();
      setFormError(error instanceof Error ? error.message : "Couldn’t save.");
      setSaving(false);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader
        title={mode === "template" ? "Create Workout" : "Log Workout"}
        onClose={requestClose}
        right={mode === "log" ? (
          <LogTimeChanger maximumDate={new Date()} onChange={(date) => update({ ...draft, endedAt: date.getTime() })} value={new Date(draft.endedAt)} />
        ) : undefined}
      />
      <FlatList
        contentContainerStyle={styles.results}
        data={results.matches}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
        style={styles.scroller}
        ListHeaderComponent={
      <View style={styles.top}>
        <TextInput
          accessibilityLabel="Workout title"
          maxLength={80}
          onChangeText={(title) => update({ ...draft, title })}
          placeholder="Workout title"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
              color: theme.colors.text,
            },
          ]}
          value={draft.title}
        />
        {mode === "log" ? (
          <View style={styles.fromSaved}>
            <PressOpacity
              accessibilityLabel="From saved workout"
              accessibilityState={{ expanded: fromSavedOpen }}
              onPress={() => setFromSavedOpen((open) => !open)}
              style={[
                styles.secondary,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                From saved workout
              </Text>
            </PressOpacity>
            {fromSavedOpen ? (
              <View style={styles.fromSaved}>
                {templates.length === 0 ? (
                  <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                    No saved workouts.
                  </Text>
                ) : (
                  templates.map((item) => (
                    <PressOpacity
                      accessibilityLabel={`Use saved workout ${item.title}`}
                      key={item.id}
                      onPress={() => {
                        void applySaved(item.id);
                      }}
                      style={[
                        styles.result,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.resultName, { color: theme.colors.text }]}>
                        {item.title}
                      </Text>
                    </PressOpacity>
                  ))
                )}
              </View>
            ) : null}
          </View>
        ) : null}
        {mode === "log" ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.duration, { color: theme.colors.text }]}>
              Estimated duration {formatDurationSeconds(duration)}
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
              Starts {duration == null ? "--" : formatClock(new Date(sessionStartMs(draft.endedAt, duration)))}
              {duration != null &&
              formatLocalDate(new Date(sessionStartMs(draft.endedAt, duration))) !==
                formatLocalDate(new Date(draft.endedAt))
                ? " the day before"
                : ""}
            </Text>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Search exercises"
          onChangeText={(query) => {
            workspace.setSearchQuery(query);
            workspace.setSearchLimit(STRENGTH_SEARCH_PAGE);
          }}
          placeholder="Search exercises"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
              color: theme.colors.text,
            },
          ]}
          value={workspace.searchQuery}
        />
      </View>
        }
        ListEmptyComponent={
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {workspace.searchQuery.trim() ? "No matches." : "No exercises in the catalog."}
          </Text>
        }
        ListFooterComponent={
          <View style={styles.resultFooter}>
            {results.total > results.matches.length ? (
              <PressOpacity
                accessibilityLabel="Load more exercises"
                onPress={() =>
                  workspace.setSearchLimit(workspace.searchLimit + STRENGTH_SEARCH_PAGE)
                }
                style={[
                  styles.secondary,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                  Load more ({results.matches.length} of {results.total})
                </Text>
              </PressOpacity>
            ) : null}
            {workspace.searchQuery.trim().length >= 2 ? (
              <PressOpacity
                accessibilityLabel={`Add custom exercise ${workspace.searchQuery.trim()}`}
                onPress={() => {
                  void addCustom();
                }}
                style={[
                  styles.secondary,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                  Add “{workspace.searchQuery.trim()}”
                </Text>
              </PressOpacity>
            ) : null}
            <View style={styles.tableWrap}>
              {draft.exercises.length === 0 ? (
                <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                  Add an exercise
                </Text>
              ) : (
                draft.exercises.map((exercise) => (
                  <TableRow
                    exercise={exercise}
                    key={exercise.id}
                    onEdit={() =>
                      workspace.push({
                        baseline: JSON.stringify(draft),
                        exerciseId: exercise.id,
                        fresh: false,
                        key: createId(),
                        name: "editor",
                      })
                    }
                    onRemove={() =>
                      workspace.requestConfirm({
                        confirmLabel: "Remove",
                        message: `${exercise.name} will leave this workout.`,
                        onConfirm: () => update(removeExercise(draft, exercise.id)),
                        title: "Remove exercise?",
                      })
                    }
                    unit={unitSettings.weight}
                  />
                ))
              )}
            </View>
            <PressOpacity
              accessibilityLabel={`Estimated focus ${preview ? emphasisHeadline(preview) : "Not enough evidence"}`}
              onPress={() => workspace.push({ key: createId(), name: "emphasis", sessionId: null })}
              style={[
                styles.secondary,
                styles.focus,
                { backgroundColor: theme.colors.surface, borderColor: focusColor },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: focusColor }]} />
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
                Estimated focus · {preview ? emphasisHeadline(preview) : "Not enough evidence"}
              </Text>
            </PressOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <PressOpacity
            accessibilityLabel={`Add ${item.name}`}
            onPress={() => addExercise(item)}
            style={[
              styles.result,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.resultName, { color: theme.colors.text }]}>{item.name}</Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{item.equipment}</Text>
          </PressOpacity>
        )}
      />

      {formError ? <Text style={[styles.error, { color: "#E11D24", paddingHorizontal: 16 }]}>{formError}</Text> : null}
      {mode === "log" ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{saveWorkoutConsequence(draft)}</Text>
          <View style={styles.toggleRow}>
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Save workout</Text>
            <SimpleSwitch accessibilityLabel="Save workout" onValueChange={(saveAsTemplate) => update({ ...draft, saveAsTemplate })} value={draft.saveAsTemplate} />
          </View>
        </View>
      ) : null}
      <WorkflowFooter onBack={requestClose} disabled={saving}>
        <PressOpacity
          accessibilityLabel={mode === "template" ? "Save workout" : "Log workout"}
          disabled={saving}
          onPress={() => { void commit(); }}
          style={[styles.primary, { flex: 1, backgroundColor: theme.colors.tertiary, opacity: saving ? 0.5 : 1 }]}
        >
          <Text style={[styles.primaryText, { color: primaryText }]}>{mode === "template" ? "Save Workout" : "Log Workout"}</Text>
        </PressOpacity>
      </WorkflowFooter>
    </View>
  );
}

function TableRow({
  exercise,
  onEdit,
  onRemove,
  unit,
}: {
  exercise: ExerciseDraft;
  onEdit: () => void;
  onRemove: () => void;
  unit: "metric" | "imperial";
}) {
  const { theme } = useAppTheme();
  const skipped = exercise.sets.filter((set) => set.skipped).length;
  const setsText =
    skipped > 0 ? `${exercise.sets.length} (${skipped} skip)` : String(exercise.sets.length);
  const metrics = [
    ["Weight*", tableField(exercise.sets, (set) =>
      formatSetLoad(exercise.loadMode, set.loadKg, set.assistanceKg, unit),
    )],
    ["Sets*", setsText],
    ["Reps*", tableField(exercise.sets, (set) => String(set.reps))],
    ["RPE", tableField(exercise.sets, (set) => formatRpe(set.rpe))],
    ["Rest", tableField(exercise.sets, (set) => formatRestSeconds(set.restSeconds))],
    ["Notes", exercise.notes.trim() || "--"],
  ] as const;
  const name = exercise.unilateral ? `${exercise.name} / side` : exercise.name;
  return (
    <View
      style={[
        styles.exerciseCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={styles.nameLine}>
        <PressOpacity accessibilityLabel={`Edit ${exercise.name}`} onPress={onEdit} style={styles.nameHit}>
          <Text numberOfLines={2} style={[styles.resultName, { color: theme.colors.text }]}>
            {name}
          </Text>
        </PressOpacity>
        <PressOpacity accessibilityLabel={`Remove ${exercise.name}`} onPress={onRemove} style={styles.removeHit}>
          <Text style={[styles.chipText, { color: theme.colors.tertiary }]}>Remove</Text>
        </PressOpacity>
      </View>
      <View style={styles.metricWrap}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.metricCell}>
            <Text style={[styles.tableHead, { color: theme.colors.textMuted }]}>{label}</Text>
            <Text
              style={[
                styles.tableCell,
                { color: value === "Mixed" ? theme.colors.tertiary : theme.colors.text },
              ]}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  top: {
    gap: tokens.spacing.sm,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  closeHit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  dateReadout: {
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  chip: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  secondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  duration: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  fromSaved: {
    gap: tokens.spacing.sm,
  },
  results: {
    padding: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  result: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "700",
  },
  resultFooter: {
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
  },
  tableWrap: {
    flex: 1,
    minHeight: 96,
  },
  exerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  nameLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  metricWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricCell: {
    minWidth: 88,
  },
  tableHead: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  tableCell: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  nameHit: {
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  removeHit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 72,
  },
  focus: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  dot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  footer: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    paddingBottom: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  footerActions: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  footerButton: {
    flex: 1,
    minWidth: 90,
  },
  primary: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 90,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    fontWeight: "700",
  },
});
