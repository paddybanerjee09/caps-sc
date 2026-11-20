import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import {
  ActionButton,
  ConditioningFooter,
  WeightInput,
  ErrorText,
  FieldLabel,
  FormInput,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import { createStation } from "../../conditioning/drafts";
import {
  applyStationCompletionType,
  incompatibleStationFields,
  validateStation,
} from "../../conditioning/validation";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep } from "../../utils/feedback";
import type {
  StationCompletionType,
  StationConfig,
} from "../../conditioning/types";

const tokens = themes.dark;
const completionTypes: StationCompletionType[] = [
  "time",
  "repetitions",
  "distance",
  "machine_calories",
  "manual",
];

const EXERCISE_PRESETS = [
  "Assault Bike",
  "Row Erg",
  "SkiErg",
  "Burpees",
  "KB Swings",
  "Sled Push",
  "Battle Ropes",
  "Med Ball Slams",
  "Box Jumps",
  "Sprawls",
] as const;

export function StationEditorScreen({
  stationId,
}: {
  stationId: string | null;
}) {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const existing = workspace.editor?.draft.stations.find(
    (station) => station.id === stationId,
  );
  const [station, setStation] = useState<StationConfig>(
    () =>
      existing ?? createStation(workspace.editor?.draft.stations.length ?? 0),
  );
  const [baseline] = useState(() => JSON.stringify(station));
  const [error, setError] = useState<string | null>(null);
  const activeText = readableTextColor(theme.colors.tertiary);

  function requestNavigation(destination: () => void) {
    if (JSON.stringify(station) === baseline) { destination(); return; }
    workspace.requestConfirm({
      confirmLabel: "Discard",
      message: "This station has unsaved changes.",
      onConfirm: destination,
      title: "Discard station changes?",
    });
  }

  useEffect(() => {
    workspace.registerBackHandler(() => { requestNavigation(workspace.pop); return true; });
    return () => workspace.registerBackHandler(null);
  });

  function chooseType(nextType: StationCompletionType) {
    feedbackStep("up");
    const discarded = incompatibleStationFields(station, nextType);
    const apply = () =>
      setStation(applyStationCompletionType(station, nextType));
    if (discarded.length === 0) {
      apply();
      return;
    }
    workspace.requestConfirm({
      confirmLabel: "Change type",
      message: "Changing the completion type clears targets that do not apply.",
      onConfirm: apply,
      title: "Discard entered targets?",
    });
  }

  function save() {
    const errors = validateStation({
      ...station,
      exerciseName: station.exerciseName.trim(),
    });
    if (errors.length > 0) {
      setError(errors[0]?.message ?? "Check this station");
      return;
    }
    const draft = workspace.editor?.draft;
    if (!draft) {
      workspace.pop();
      return;
    }
    const nextStation = {
      ...station,
      exerciseName: station.exerciseName.trim(),
    };
    const stations = existing
      ? draft.stations.map((item) =>
          item.id === nextStation.id ? nextStation : item,
        )
      : [...draft.stations, nextStation].map((item, position) => ({
          ...item,
          position,
        }));
    feedbackConfirm();
    workspace.updateEditor({ ...draft, stations });
    workspace.pop();
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading
        onClose={() => requestNavigation(workspace.closeBranch)}
        title={existing ? "Edit station" : "Add station"}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Exercise Selection */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              STATION EXERCISE
            </Text>
            <Text style={[styles.cardBadge, { color: theme.colors.tertiary }]}>
              SWIPE PRESETS
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.presetStrip}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {EXERCISE_PRESETS.map((preset) => {
              const selected = station.exerciseName === preset;
              return (
                <PressOpacity
                  accessibilityLabel={`Select exercise ${preset}`}
                  key={preset}
                  onPress={() => {
                    feedbackStep("up");
                    setStation({ ...station, exerciseName: preset });
                  }}
                  silent
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.surfaceMuted,
                      borderColor: selected
                        ? theme.colors.tertiary
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      { color: selected ? activeText : theme.colors.text },
                    ]}
                  >
                    {preset}
                  </Text>
                </PressOpacity>
              );
            })}
          </ScrollView>

          <FieldLabel>Exercise</FieldLabel>
          <FormInput
            accessibilityLabel="Exercise name"
            onChangeText={(exerciseName) =>
              setStation({ ...station, exerciseName })
            }
            placeholder="Station name"
            value={station.exerciseName}
          />
        </View>

        {/* Card 2: Completion Type */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              COMPLETION TARGET TYPE
            </Text>
            <Text style={[styles.cardBadge, { color: theme.colors.text }]}>
              {station.completionType.replaceAll("_", " ").toUpperCase()}
            </Text>
          </View>
          <View style={styles.types}>
            {completionTypes.map((type) => (
              <ActionButton
                key={type}
                label={type.replaceAll("_", " ")}
                onPress={() => chooseType(type)}
                tone={station.completionType === type ? "primary" : "secondary"}
              />
            ))}
          </View>
        </View>

        {/* Card 3: Station Parameters & Steppers */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              STATION PRESCRIPTION & RECOVERY
            </Text>
          </View>

          {station.completionType === "time" ? (
            <NullableNumber
              coarseStep={15}
              fineStep={5}
              label="Work seconds"
              onChange={(workSeconds) => setStation({ ...station, workSeconds })}
              presets={[15, 20, 30, 45, 60, 90, 120]}
              value={station.workSeconds}
            />
          ) : null}
          {station.completionType === "repetitions" ? (
            <NullableNumber
              coarseStep={5}
              fineStep={1}
              label="Target reps"
              onChange={(targetReps) => setStation({ ...station, targetReps })}
              presets={[5, 8, 10, 12, 15, 20, 25]}
              value={station.targetReps}
            />
          ) : null}
          {station.completionType === "distance" ? (
            <NullableNumber
              coarseStep={50}
              fineStep={10}
              label="Distance meters"
              onChange={(distanceMeters) =>
                setStation({ ...station, distanceMeters })
              }
              presets={[25, 50, 100, 200, 400, 500]}
              value={station.distanceMeters}
            />
          ) : null}
          {station.completionType === "machine_calories" ? (
            <NullableNumber
              coarseStep={5}
              fineStep={1}
              label="Machine calories"
              onChange={(machineCalories) =>
                setStation({ ...station, machineCalories })
              }
              presets={[10, 12, 15, 20, 25, 30, 50]}
              value={station.machineCalories}
            />
          ) : null}
          {station.completionType === "repetitions" ||
          station.completionType === "distance" ? (
            <NullableNumber
              allowClear
              coarseStep={10}
              fineStep={2}
              label="Load kilograms (optional)"
              onChange={(loadKg) => setStation({ ...station, loadKg })}
              presets={[10, 16, 20, 24, 32, 40, 60]}
              value={station.loadKg}
            />
          ) : null}
          {station.completionType === "manual" ? (
            <>
              <FieldLabel>Instructions</FieldLabel>
              <FormInput
                accessibilityLabel="Instructions"
                onChangeText={(instructions) =>
                  setStation({ ...station, instructions })
                }
                value={station.instructions ?? ""}
              />
            </>
          ) : null}
          <NullableNumber
            coarseStep={15}
            fineStep={5}
            label="Recovery seconds"
            onChange={(recoverySeconds) =>
              setStation({ ...station, recoverySeconds: recoverySeconds ?? 0 })
            }
            presets={[0, 10, 15, 20, 30, 45, 60]}
            value={station.recoverySeconds}
          />
          <NullableNumber
            allowClear
            coarseStep={2}
            fineStep={1}
            label="Target RPE (optional)"
            maximum={10}
            minimum={1}
            onChange={(targetRpe) => setStation({ ...station, targetRpe })}
            presets={[6, 7, 8, 9, 10]}
            value={station.targetRpe}
          />
          <FieldLabel>Notes</FieldLabel>
          <FormInput
            accessibilityLabel="Station notes"
            onChangeText={(notes) => setStation({ ...station, notes })}
            value={station.notes ?? ""}
          />
        </View>

        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <ConditioningFooter onBack={() => requestNavigation(workspace.pop)}>
        <ActionButton label="Save station" onPress={save} />
      </ConditioningFooter>
    </View>
  );
}

function NullableNumber({
  allowClear = false,
  coarseStep = 5,
  fineStep = 1,
  label,
  maximum = 5000,
  minimum = 0,
  onChange,
  presets,
  value,
}: {
  allowClear?: boolean;
  coarseStep?: number;
  fineStep?: number;
  label: string;
  maximum?: number;
  minimum?: number;
  onChange: (value: number | null) => void;
  presets: readonly number[];
  value: number | null;
}) {
  const { theme } = useAppTheme();
  const activeText = readableTextColor(theme.colors.tertiary);
  if (label.toLowerCase().includes("load")) {
    return <WeightInput label={label} value={value} onChange={onChange} />;
  }

  function step(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    const base = value ?? minimum;
    const next = Math.min(maximum, Math.max(minimum, Math.round(base + delta)));
    onChange(next);
  }

  return (
    <View style={styles.numberBlock}>
      <View style={styles.cardHeader}>
        <FieldLabel>{label}</FieldLabel>
        {allowClear && value !== null ? (
          <PressOpacity
            accessibilityLabel={`Clear ${label}`}
            onPress={() => {
              feedbackStep("down");
              onChange(null);
            }}
            silent
            style={[
              styles.clearPill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.clearPillText, { color: theme.colors.textMuted }]}>
              CLEAR
            </Text>
          </PressOpacity>
        ) : null}
      </View>

      <View style={styles.stepperRow}>
        <PressOpacity
          accessibilityLabel={`Decrease ${label} by ${coarseStep}`}
          onPress={() => step(-coarseStep)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            -{coarseStep}
          </Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Decrease ${label} by ${fineStep}`}
          onPress={() => step(-fineStep)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            -{fineStep}
          </Text>
        </PressOpacity>

        <FormInput
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          onChangeText={(text) => onChange(text.trim() ? Number(text) : null)}
          placeholder="—"
          style={styles.centerInput}
          value={value === null ? "" : String(value)}
        />

        <PressOpacity
          accessibilityLabel={`Increase ${label} by ${fineStep}`}
          onPress={() => step(fineStep)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            +{fineStep}
          </Text>
        </PressOpacity>
        <PressOpacity
          accessibilityLabel={`Increase ${label} by ${coarseStep}`}
          onPress={() => step(coarseStep)}
          silent
          style={[
            styles.stepBtn,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: theme.colors.text }]}>
            +{coarseStep}
          </Text>
        </PressOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.presetStrip}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {presets.map((preset) => {
          const selected = value === preset;
          return (
            <PressOpacity
              accessibilityLabel={`Set ${label} to ${preset}`}
              key={preset}
              onPress={() => {
                feedbackStep("up");
                onChange(preset);
              }}
              silent
              style={[
                styles.presetChip,
                {
                  backgroundColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.surfaceMuted,
                  borderColor: selected
                    ? theme.colors.tertiary
                    : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  { color: selected ? activeText : theme.colors.text },
                ]}
              >
                {preset}
              </Text>
            </PressOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  types: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  numberBlock: {
    gap: 6,
    marginTop: 4,
  },
  stepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stepBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 46,
    paddingHorizontal: 6,
  },
  stepBtnText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  centerInput: {
    flex: 1,
    textAlign: "center",
  },
  presetStrip: {
    gap: 6,
  },
  presetChip: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 46,
    paddingHorizontal: tokens.spacing.sm,
  },
  presetChipText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  clearPill: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clearPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
