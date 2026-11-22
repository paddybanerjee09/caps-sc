import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { convertKilogramsToWeight, convertWeightToKilograms } from "../../utils/weight";
import { parseDecimalInput } from "../../utils/numericInput";
import { PressOpacity } from "../../components/PressOpacity";
import { SimpleSwitch } from "../../components/SimpleSwitch";
import {
  MAX_REPS,
  MAX_REST_SECONDS,
  MAX_SETS,
  applyRepeat,
  customizeSet,
  matchSetToRepeat,
  moveExercise,
  removeExercise,
  resizeSets,
  setLoadMode,
  updateExercise,
  updateSet,
} from "../../strength/drafts";
import type { ExerciseDraft, LoadMode, RepeatTarget, SetDraft, StrengthDraft } from "../../strength/types";
import { useAppState } from "../../state/AppStateContext";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackStep, feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;
const loadModes: { label: string; mode: LoadMode }[] = [
  { label: "External", mode: "external" },
  { label: "Bodyweight", mode: "bodyweight" },
  { label: "Assisted", mode: "assisted" },
];

export function ExerciseEditorScreen({
  baseline,
  exerciseId,
  fresh,
}: {
  baseline: string;
  exerciseId: string;
  fresh: boolean;
}) {
  const { theme } = useAppTheme();
  const { unitSettings } = useAppState();
  const workspace = useStrengthWorkspace();
  const draft = workspace.draft;
  const source = draft?.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
  const [exercise, setExercise] = useState<ExerciseDraft | null>(source);
  const primaryText = readableTextColor(theme.colors.tertiary);
  const unit = unitSettings.weight;
  const dirty = draft != null && JSON.stringify(draft) !== baseline;

  useEffect(() => {
    if (!draft || !exercise) {
      return;
    }
    const current = draft.exercises.find((item) => item.id === exercise.id);
    if (!current || JSON.stringify(current) === JSON.stringify(exercise)) {
      return;
    }
    workspace.updateDraft(updateExercise(draft, exercise.id, () => exercise));
  }, [draft, exercise, workspace]);

  function closeEditor() {
    if (!dirty) {
      workspace.pop();
      return;
    }
    workspace.requestConfirm({
      confirmLabel: fresh ? "Remove" : "Discard",
      message: fresh
        ? "This exercise will leave the workout."
        : "Changes to this exercise will be dropped.",
      onConfirm: () => {
        workspace.updateDraft(JSON.parse(baseline) as StrengthDraft);
        workspace.pop();
      },
      title: fresh ? "Remove exercise?" : "Discard exercise changes?",
    });
  }

  useEffect(() => {
    workspace.registerBackHandler(() => {
      closeEditor();
      return true;
    });
    return () => workspace.registerBackHandler(null);
  });

  if (!draft || !exercise) {
    return null;
  }

  function save() {
    if (!draft || !exercise) {
      return;
    }
    workspace.updateDraft(updateExercise(draft, exercise.id, () => exercise));
    workspace.pop();
  }

  function patchRepeat(patch: Partial<RepeatTarget>) {
    setExercise((current) =>
      current ? applyRepeat(current, { ...current.repeat, ...patch }) : current,
    );
  }

  const weightKg =
    exercise.loadMode === "assisted" ? exercise.repeat.assistanceKg : exercise.repeat.loadKg;
  const weightLabel =
    exercise.loadMode === "assisted"
      ? "Assistance*"
      : exercise.loadMode === "bodyweight"
        ? "Added weight"
        : "Weight*";

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title={exercise.name} onClose={workspace.closeBranch} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>LOAD</Text>
          <View style={styles.presetRow}>
            {loadModes.map((option) => {
              const selected = exercise.loadMode === option.mode;
              return (
                <PressOpacity
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  key={option.mode}
                  onPress={() => setExercise((current) => (current ? setLoadMode(current, option.mode) : current))}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.colors.tertiary : theme.colors.surfaceMuted,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text style={{ color: selected ? primaryText : theme.colors.text, fontWeight: "700" }}>
                    {option.label}
                  </Text>
                </PressOpacity>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {exercise.loadMode === "bodyweight"
              ? "Added weight per implement."
              : exercise.loadMode === "assisted"
                ? "Assistance weight."
                : "Weight per implement."}
          </Text>
          <WeightInput
            label={weightLabel}
            unit={unit}
            value={weightKg}
            onChange={(next) => patchRepeat(exercise.loadMode === "assisted" ? { assistanceKg: next } : { loadKg: next })}
          />
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: theme.colors.text }]}>Reps per side</Text>
            </View>
            <SimpleSwitch
              accessibilityLabel="Reps per side"
              onValueChange={(unilateral) =>
                setExercise((current) => (current ? { ...current, unilateral } : current))
              }
              value={exercise.unilateral}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={[styles.switchTitle, { color: theme.colors.text }]}>Explosive intent</Text>
            </View>
            <SimpleSwitch
              accessibilityLabel="Explosive intent"
              onValueChange={(explosiveIntent) =>
                setExercise((current) => (current ? { ...current, explosiveIntent } : current))
              }
              value={exercise.explosiveIntent}
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>REPEAT FOR EACH SET</Text>
          <CountStepper
            label="Sets*"
            maximum={MAX_SETS}
            minimum={1}
            onChange={(sets) => {
              if (sets == null) {
                return;
              }
              setExercise((current) => (current ? resizeSets(current, sets) : current));
            }}
            presets={[1, 3, 4, 5, 6, 8]}
            value={exercise.sets.length}
          />
          <CountStepper
            label="Reps*"
            maximum={MAX_REPS}
            minimum={1}
            onChange={(reps) => {
              if (reps != null) {
                patchRepeat({ reps });
              }
            }}
            presets={[1, 3, 5, 8, 10, 12, 15, 20]}
            value={exercise.repeat.reps}
          />
          <CountStepper
            allowEmpty
            label="RPE"
            maximum={10}
            minimum={1}
            onChange={(rpe) => patchRepeat({ rpe })}
            presets={[6, 7, 8, 9, 10]}
            value={exercise.repeat.rpe}
          />
          <CountStepper
            allowEmpty
            allowZero
            label="Rest between sets"
            maximum={MAX_REST_SECONDS}
            minimum={0}
            onChange={(restSeconds) => patchRepeat({ restSeconds })}
            presets={[0, 30, 60, 90, 120, 180]}
            step={15}
            suffix="s"
            value={exercise.repeat.restSeconds}
          />
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>NOTES</Text>
          <TextInput
            accessibilityLabel="Exercise notes"
            maxLength={1000}
            multiline
            onChangeText={(notes) => setExercise((current) => (current ? { ...current, notes } : current))}
            placeholder="Optional"
            placeholderTextColor={theme.colors.textMuted}
            style={[
              styles.notes,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
                color: theme.colors.text,
              },
            ]}
            value={exercise.notes}
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>SETS</Text>
          {exercise.sets.map((set, index) => (
            <SetRow
              index={index}
              key={set.id}
              loadMode={exercise.loadMode}
              onChange={(next) =>
                setExercise((current) =>
                  current ? updateSet(current, set.id, () => next) : current,
                )
              }
              onCustomize={() =>
                setExercise((current) => (current ? customizeSet(current, set.id) : current))
              }
              onMatch={() =>
                setExercise((current) => (current ? matchSetToRepeat(current, set.id) : current))
              }
              set={set}
              unit={unit}
            />
          ))}
        </View>

        <View style={styles.row}>
          <PressOpacity
            accessibilityLabel="Move exercise earlier"
            onPress={() => workspace.updateDraft(moveExercise(draft, exercise.id, -1))}
            style={[styles.secondary, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Move earlier</Text>
          </PressOpacity>
          <PressOpacity
            accessibilityLabel="Move exercise later"
            onPress={() => workspace.updateDraft(moveExercise(draft, exercise.id, 1))}
            style={[styles.secondary, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
          >
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Move later</Text>
          </PressOpacity>
        </View>
        <PressOpacity
          accessibilityLabel={`Remove ${exercise.name}`}
          onPress={() =>
            workspace.requestConfirm({
              confirmLabel: "Remove",
              message: `${exercise.name} will leave this workout.`,
              onConfirm: () => {
                workspace.updateDraft(removeExercise(draft, exercise.id));
                workspace.pop();
              },
              title: "Remove exercise?",
            })
          }
          style={[styles.danger, { borderColor: theme.colors.tertiary }]}
        >
          <Text style={[styles.actionText, { color: theme.colors.tertiary }]}>Remove exercise</Text>
        </PressOpacity>
      </ScrollView>
      <WorkflowFooter onBack={closeEditor} backLabel="Back">
        <PressOpacity
          accessibilityLabel="Save exercise"
          onPress={save}
          style={[styles.primary, { backgroundColor: theme.colors.tertiary }]}
        >
          <Text style={[styles.actionText, { color: primaryText }]}>Save</Text>
        </PressOpacity>
      </WorkflowFooter>
    </View>
  );
}

function SetRow({
  index,
  loadMode,
  onChange,
  onCustomize,
  onMatch,
  set,
  unit,
}: {
  index: number;
  loadMode: LoadMode;
  onChange: (set: SetDraft) => void;
  onCustomize: () => void;
  onMatch: () => void;
  set: SetDraft;
  unit: "metric" | "imperial";
}) {
  const { theme } = useAppTheme();
  const loadKg = loadMode === "assisted" ? set.assistanceKg : set.loadKg;
  function changeLoad(next: number | null) {
    onChange({
      ...set,
      assistanceKg: loadMode === "assisted" ? next : null,
      followsRepeat: false,
      loadKg: loadMode === "assisted" ? null : next,
    });
  }
  return (
    <View style={[styles.setCard, { borderColor: theme.colors.border }]}>
      <View style={styles.switchRow}>
        <Text style={[styles.switchTitle, { color: theme.colors.text }]}>Set {index + 1}</Text>
        <PressOpacity
          accessibilityLabel={set.skipped ? `Include set ${index + 1}` : `Skip set ${index + 1}`}
          onPress={() => onChange({ ...set, followsRepeat: false, skipped: !set.skipped })}
          style={[styles.chip, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
            {set.skipped ? "Include" : "Skip"}
          </Text>
        </PressOpacity>
      </View>
      {set.followsRepeat ? (
        <PressOpacity accessibilityLabel={`Customize set ${index + 1}`} onPress={onCustomize} style={styles.linkHit}>
          <Text style={[styles.hint, { color: theme.colors.text }]}>Customize set</Text>
        </PressOpacity>
      ) : (
        <View style={styles.setEditor}>
          <WeightInput label={loadMode === "assisted" ? "Assistance" : loadMode === "bodyweight" ? "Added weight" : "Weight"} onChange={changeLoad} value={loadKg} unit={unit} />
          <CountStepper
            label="Reps"
            maximum={MAX_REPS}
            minimum={1}
            onChange={(reps) => {
              if (reps != null) {
                onChange({ ...set, followsRepeat: false, reps });
              }
            }}
            presets={[3, 5, 8, 10]}
            value={set.reps}
          />
          <CountStepper
            allowEmpty
            label="RPE"
            maximum={10}
            minimum={1}
            onChange={(rpe) => onChange({ ...set, followsRepeat: false, rpe })}
            presets={[6, 7, 8, 9, 10]}
            value={set.rpe}
          />
          <CountStepper
            allowEmpty
            allowZero
            label="Rest"
            maximum={MAX_REST_SECONDS}
            minimum={0}
            onChange={(restSeconds) => onChange({ ...set, followsRepeat: false, restSeconds })}
            presets={[0, 30, 60, 90, 120, 180]}
            step={15}
            suffix="s"
            value={set.restSeconds}
          />
          <PressOpacity accessibilityLabel={`Match set ${index + 1} to default`} onPress={onMatch} style={styles.linkHit}>
            <Text style={[styles.hint, { color: theme.colors.tertiary }]}>Match default</Text>
          </PressOpacity>
        </View>
      )}
    </View>
  );
}

function WeightInput({ label, onChange, unit, value }: {
  label: string;
  onChange: (value: number | null) => void;
  unit: "metric" | "imperial";
  value: number | null;
}) {
  const { theme } = useAppTheme();
  const editing = useRef(false);
  const display = value == null ? "" : String(Math.round(convertKilogramsToWeight(value, unit) * 1000) / 1000);
  const [text, setText] = useState(display);
  useEffect(() => { if (!editing.current) setText(display); }, [display]);
  return (
    <View style={styles.stepBlock}>
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>{label.toUpperCase()} ({unit === "metric" ? "kg" : "lb"})</Text>
      <TextInput
        accessibilityLabel={label + (unit === "metric" ? " in kilograms" : " in pounds")}
        keyboardType="decimal-pad"
        maxLength={10}
        onFocus={() => { editing.current = true; }}
        onBlur={() => { editing.current = false; setText(display); }}
        onChangeText={(next) => {
          if (!/^\d*(?:[.,]\d*)?$/.test(next)) return;
          setText(next);
          const parsed = parseDecimalInput(next);
          onChange(parsed == null ? null : convertWeightToKilograms(parsed, unit));
        }}
        placeholder="Enter weight"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.weightInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
        value={text}
      />
    </View>
  );
}

function CountStepper({
  allowEmpty = false,
  allowZero = false,
  label,
  maximum,
  minimum,
  onChange,
  presets,
  step = 1,
  suffix = "",
  value,
}: {
  allowEmpty?: boolean;
  allowZero?: boolean;
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number | null) => void;
  presets: readonly number[];
  step?: number;
  suffix?: string;
  value: number | null;
}) {
  const { theme } = useAppTheme();
  function change(next: number | null) {
    if (next == null) {
      onChange(null);
      return;
    }
    onChange(Math.min(maximum, Math.max(allowZero ? 0 : minimum, Math.round(next))));
  }
  return (
    <View style={styles.stepBlock}>
      <View style={styles.switchRow}>
        <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>
        <Text style={[styles.readout, { color: theme.colors.text }]}>
          {value == null ? "Not set" : `${value}${suffix}`}
        </Text>
      </View>
      <View style={styles.row}>
        <StepButton
          label={`-${step}`}
          onPress={() => {
            if (value == null) {
              feedbackWarn();
              return;
            }
            const next = value - step;
            if (next < minimum && allowEmpty) {
              change(null);
              return;
            }
            if (allowZero && next < minimum) {
              change(0);
              return;
            }
            change(next);
          }}
        />
        <StepButton
          label={`+${step}`}
          onPress={() => change((value ?? (allowZero ? 0 : minimum - step)) + step)}
        />
        {allowEmpty && value != null ? (
          <PressOpacity
            accessibilityLabel={`Clear ${label}`}
            onPress={() => {
              feedbackStep("down");
              change(null);
            }}
            silent
            style={[styles.chip, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Omit</Text>
          </PressOpacity>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.presetRow}>
          {presets.map((preset) => (
            <PressOpacity
              accessibilityLabel={`${label} ${preset}`}
              key={preset}
              onPress={() => {
                feedbackStep("up");
                change(preset);
              }}
              silent
              style={[
                styles.chip,
                {
                  backgroundColor: value === preset ? theme.colors.tertiary : theme.colors.surfaceMuted,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={{
                  color: value === preset ? readableTextColor(theme.colors.tertiary) : theme.colors.text,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "700",
                }}
              >
                {preset}
                {suffix}
              </Text>
            </PressOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity
      accessibilityLabel={label}
      onPress={() => {
        feedbackStep(label.startsWith("-") ? "down" : "up");
        onPress();
      }}
      silent
      style={[
        styles.step,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong },
      ]}
    >
      <Text style={[styles.actionText, { color: theme.colors.text }]}>{label}</Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  headerHit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 64,
  },
  headerAction: { fontSize: 16, fontWeight: "700" },
  title: { flex: 1, fontSize: 20, fontWeight: "800" },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  presetRow: { flexDirection: "row", gap: tokens.spacing.sm },
  chip: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
    minHeight: 48,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchTitle: { fontSize: 15, fontWeight: "700" },
  notes: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
    padding: tokens.spacing.md,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
  secondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
  danger: {
    alignItems: "center",
    backgroundColor: "rgba(211, 21, 22, 0.14)",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  actionText: { fontSize: 15, fontWeight: "700" },
  footer: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  primary: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 90,
  },
  weightInput: { borderRadius: 12, borderWidth: 1, fontSize: 18, fontVariant: ["tabular-nums"], minHeight: 52, paddingHorizontal: 12 },
  stepBlock: { gap: tokens.spacing.sm },
  readout: { fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "800" },
  step: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 64,
    paddingHorizontal: tokens.spacing.sm,
  },
  setCard: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
  },
  setEditor: { gap: tokens.spacing.sm },
  linkHit: { justifyContent: "center", minHeight: 48 },
});
