import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import { PressOpacity } from "../../components/PressOpacity";
import { SimpleSwitch } from "../../components/SimpleSwitch";
import { createId } from "../../conditioning/ids";
import { formatLocalDate } from "../../conditioning/dates";
import {
  createCustomExercise,
  listSameLiftReferences,
  listStrengthExercises,
  logStrengthSession,
  createStrengthTemplate,
} from "../../data/strengthRepository";
import { STRENGTH_SEARCH_PAGE, searchExercises } from "../../strength/catalog";
import {
  MAX_EXERCISES,
  addCatalogExercise,
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

export function WorkoutBuilderScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { bumpTimeline, unitSettings } = useAppState();
  const workspace = useStrengthWorkspace();
  const draft = workspace.draft;
  const mode = workspace.mode;
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [timeOpen, setTimeOpen] = useState(false);
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
    return () => {
      cancelled = true;
    };
  }, [db, workspace.revision]);

  useEffect(() => {
    if (!draft) {
      return;
    }
    let cancelled = false;
    const cutoff = mode === "log" ? draft.endedAt : Date.now();
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

  function shiftDay(daysAgo: number) {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() - daysAgo);
    const next = new Date(draft!.endedAt);
    next.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
    update({ ...draft!, endedAt: Math.min(next.getTime(), Date.now()) });
  }

  function addExercise(exercise: CatalogExercise) {
    if (draft!.exercises.length >= MAX_EXERCISES) {
      feedbackWarn();
      setFormError("This workout already has 40 exercises.");
      return;
    }
    const next = addCatalogExercise(draft!, exercise);
    const created = next.exercises.at(-1);
    update(next);
    if (created) {
      workspace.push({ exerciseId: created.id, key: createId(), name: "editor" });
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
    const now = Date.now();
    const checked = mode === "template" ? projectTemplateDraft(draft!) : draft!;
    const error = validateStrengthDraft(checked, mode === "template" ? "template" : "log", now);
    if (error) {
      feedbackWarn();
      setFormError(error);
      return;
    }
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.page, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
            {mode === "template" ? "CREATE WORKOUT" : "LOG WORKOUT"}
          </Text>
          <PressOpacity
            accessibilityLabel="Close workout"
            onPress={requestClose}
            style={styles.closeHit}
          >
            <Text style={[styles.closeText, { color: theme.colors.text }]}>Close</Text>
          </PressOpacity>
        </View>
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
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>DATE</Text>
            <Text style={[styles.dateReadout, { color: theme.colors.text }]}>
              {formatDay(new Date(draft.endedAt))}
            </Text>
            <View style={styles.presetRow}>
              <DayChip label="-1 day" onPress={() => shiftDay(daysFromToday(draft.endedAt) + 1)} />
              <DayChip label="Today" onPress={() => shiftDay(0)} />
              <DayChip label="Yesterday" onPress={() => shiftDay(1)} />
              <DayChip label="7 days" onPress={() => shiftDay(7)} />
            </View>
            <PressOpacity
              accessibilityLabel={`Ends at ${formatClock(new Date(draft.endedAt))}`}
              onPress={() => setTimeOpen((open) => !open)}
              style={[
                styles.secondary,
                {
                  backgroundColor: timeOpen ? theme.colors.tertiary : theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.secondaryText,
                  { color: timeOpen ? primaryText : theme.colors.text },
                ]}
              >
                Ends at {formatClock(new Date(draft.endedAt))}
              </Text>
            </PressOpacity>
            {timeOpen ? (
              <LogTimeChanger
                label="Ends at"
                maximumDate={new Date()}
                onChange={(date) => update({ ...draft, endedAt: date.getTime() })}
                value={new Date(draft.endedAt)}
              />
            ) : null}
            <Text style={[styles.duration, { color: theme.colors.text }]}>
              Estimated duration {formatDurationSeconds(duration)}
            </Text>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
              Starts {duration == null ? "—" : formatClock(new Date(sessionStartMs(draft.endedAt, duration)))}
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

      <FlatList
        contentContainerStyle={styles.results}
        data={results.matches}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id}
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
        style={styles.resultList}
      />

      <View style={styles.tableWrap}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableRow}>
                {["Exercise", "Weight*", "Sets*", "Reps*", "RPE", "Rest", "Notes"].map((label) => (
                  <Text
                    key={label}
                    style={[styles.tableHead, { color: theme.colors.textMuted, width: columnWidth(label) }]}
                  >
                    {label}
                  </Text>
                ))}
              </View>
              {draft.exercises.length === 0 ? (
                <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                  Search above and add an exercise.
                </Text>
              ) : (
                draft.exercises.map((exercise) => (
                  <TableRow
                    exercise={exercise}
                    key={exercise.id}
                    onEdit={() =>
                      workspace.push({
                        exerciseId: exercise.id,
                        key: createId(),
                        name: "editor",
                      })
                    }
                    onRemove={() => update(removeExercise(draft, exercise.id))}
                    unit={unitSettings.weight}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </ScrollView>
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

      <View
        style={[
          styles.footer,
          { backgroundColor: theme.colors.background, borderColor: theme.colors.borderStrong },
        ]}
      >
        {formError ? (
          <Text style={[styles.error, { color: theme.colors.tertiary }]}>{formError}</Text>
        ) : null}
        {mode === "log" ? (
          <View style={styles.toggleBlock}>
            <View style={styles.toggleRow}>
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Save workout</Text>
              <SimpleSwitch
                onValueChange={(saveAsTemplate) => update({ ...draft, saveAsTemplate })}
                value={draft.saveAsTemplate}
              />
            </View>
            <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
              {saveWorkoutConsequence(draft)}
            </Text>
          </View>
        ) : null}
        <View style={styles.footerActions}>
          <PressOpacity
            accessibilityLabel="Cancel workout"
            onPress={requestClose}
            style={[
              styles.secondary,
              styles.footerButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Cancel</Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel={mode === "template" ? "Save workout" : "Log workout"}
            disabled={saving}
            onPress={() => {
              void commit();
            }}
            style={[
              styles.primary,
              styles.footerButton,
              { backgroundColor: theme.colors.tertiary, opacity: saving ? 0.5 : 1 },
            ]}
          >
            <Text style={[styles.primaryText, { color: primaryText }]}>
              {mode === "template" ? "Save Workout" : "Log Workout"}
            </Text>
          </PressOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function DayChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
      ]}
    >
      <Text style={[styles.chipText, { color: theme.colors.text }]}>{label}</Text>
    </PressOpacity>
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
  const cells = [
    exercise.unilateral ? `${exercise.name} / side` : exercise.name,
    tableField(exercise.sets, (set) =>
      formatSetLoad(exercise.loadMode, set.loadKg, set.assistanceKg, unit),
    ).text,
    setsText,
    tableField(exercise.sets, (set) => String(set.reps)).text,
    tableField(exercise.sets, (set) => formatRpe(set.rpe)).text,
    tableField(exercise.sets, (set) => formatRestSeconds(set.restSeconds)).text,
    exercise.notes.trim() || "—",
  ];
  return (
    <View style={styles.tableRow}>
      <PressOpacity accessibilityLabel={`Edit ${exercise.name}`} onPress={onEdit} style={styles.nameHit}>
        <Text numberOfLines={2} style={[styles.tableCell, styles.nameCell, { color: theme.colors.text }]}>
          {cells[0]}
        </Text>
      </PressOpacity>
      {cells.slice(1).map((cell, index) => (
        <Text
          key={`${exercise.id}-${index}`}
          numberOfLines={2}
          style={[
            styles.tableCell,
            {
              color: cell === "Mixed" ? theme.colors.tertiary : theme.colors.text,
              width: columnWidth(["Weight*", "Sets*", "Reps*", "RPE", "Rest", "Notes"][index] ?? "Notes"),
            },
          ]}
        >
          {cell}
        </Text>
      ))}
      <PressOpacity accessibilityLabel={`Remove ${exercise.name}`} onPress={onRemove} style={styles.removeHit}>
        <Text style={[styles.chipText, { color: theme.colors.tertiary }]}>Remove</Text>
      </PressOpacity>
    </View>
  );
}

function columnWidth(label: string) {
  if (label === "Exercise") {
    return 168;
  }
  if (label === "Notes" || label === "Weight*") {
    return 112;
  }
  return 72;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function daysFromToday(endedAt: number) {
  const end = new Date(endedAt);
  const today = new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((todayDay - endDay) / 86_400_000);
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
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
  resultList: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 180,
  },
  results: {
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
  tableRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  tableHead: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    paddingVertical: 6,
  },
  tableCell: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    paddingVertical: 8,
  },
  nameCell: {
    width: 168,
  },
  nameHit: {
    justifyContent: "center",
    minHeight: 48,
    width: 168,
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
  toggleBlock: {
    gap: 4,
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
  },
  primary: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 52,
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
