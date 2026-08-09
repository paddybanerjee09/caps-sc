import { useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import {
  conditioningActivityOptions,
  conditioningAdaptations,
  conditioningProtocolOptions,
  conditioningValidationLimits,
} from "../constants/conditioning";
import type { UnitSystem } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningActivity,
  ConditioningScoreResult,
} from "../types/conditioning";
import {
  formatPace,
  getDistanceUnitLabel,
} from "../utils/conditioningMeasurements";
import {
  changeConditioningDistanceUnit,
  clearConditioningIntensity,
  createDefaultConditioningSessionFormDraft,
  selectConditioningActivity,
  selectConditioningIntensityMethod,
  selectConditioningProtocolType,
  selectIntervalWorkMode,
  updateConditioningDistanceInput,
  type ConditioningIntensityDraft,
  type ConditioningSessionFormDraft,
} from "../utils/conditioningSessionDraft";
import { ConditioningSelectField } from "./ConditioningSelectField";
import { ElapsedDurationField } from "./ElapsedDurationField";
import { PressOpacity } from "./PressOpacity";

export {
  createDefaultConditioningSessionFormDraft,
  type ConditioningIntensityDraft,
  type ConditioningSessionFormDraft,
};

const tokens = themes.dark;

const intensityMethodOptions = [
  { key: "heart_rate", label: "Heart Rate — Recommended" },
  { key: "rpe", label: "RPE" },
] as const;

const intervalWorkOptions = [
  { key: "time", label: "Time" },
  { key: "distance", label: "Distance" },
] as const;

export type ConditioningSessionFormProps = {
  baselines: AthleteConditioningBaselines;
  disabled?: boolean;
  distanceUnit: UnitSystem;
  draft: ConditioningSessionFormDraft;
  onAdaptationPress?: () => void;
  onChange: (draft: ConditioningSessionFormDraft) => void;
  scoreResult: ConditioningScoreResult;
  showHeading?: boolean;
};

export function ConditioningSessionForm({
  baselines,
  disabled = false,
  distanceUnit,
  draft,
  onAdaptationPress,
  onChange,
  scoreResult,
  showHeading = true,
}: ConditioningSessionFormProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const narrow = width < 420;

  useEffect(() => {
    const reformatted = changeConditioningDistanceUnit(draft, distanceUnit);
    if (reformatted !== draft) {
      onChange(reformatted);
    }
  }, [distanceUnit, draft, onChange]);

  function updateDraft(patch: Partial<ConditioningSessionFormDraft>) {
    onChange({ ...draft, ...patch });
  }

  function changeActivity(activity: ConditioningActivity) {
    onChange(selectConditioningActivity(draft, activity));
  }

  return (
    <View style={styles.container}>
      {showHeading ? (
        <View style={styles.heading}>
          <ConditioningTitleInput
            disabled={disabled}
            onChangeText={(titleInput) => updateDraft({ titleInput })}
            value={draft.titleInput}
          />
          <ConditioningAdaptationBadge
            onPress={onAdaptationPress}
            scoreResult={scoreResult}
          />
          <ConditioningScoreHelp scoreResult={scoreResult} />
        </View>
      ) : (
        <ConditioningScoreHelp scoreResult={scoreResult} />
      )}

      <ConditioningSelectField
        disabled={disabled}
        label="Activity"
        onChange={changeActivity}
        options={conditioningActivityOptions}
        value={draft.activity}
      />

      {draft.activeProtocolType === "circuit" ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>Type</Text>
          <View
            accessibilityLabel="Type, Circuit"
            style={[
              styles.informationalValue,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.valueText, { color: theme.colors.text }]}>
              Circuit
            </Text>
          </View>
          {draft.activity !== "circuit" ? (
            <View style={styles.inlineActions}>
              <SmallAction
                disabled={disabled}
                label="Use Continuous"
                onPress={() =>
                  onChange(selectConditioningProtocolType(draft, "continuous"))
                }
              />
              <SmallAction
                disabled={disabled}
                label="Use Intervals"
                onPress={() =>
                  onChange(selectConditioningProtocolType(draft, "intervals"))
                }
              />
            </View>
          ) : null}
        </View>
      ) : (
        <ConditioningSelectField
          disabled={disabled}
          label="Type"
          onChange={(type) =>
            onChange(selectConditioningProtocolType(draft, type))
          }
          options={conditioningProtocolOptions}
          value={draft.activeProtocolType}
        />
      )}

      {draft.activeProtocolType === "continuous" ? (
        <ContinuousFields
          disabled={disabled}
          distanceUnit={distanceUnit}
          draft={draft}
          onChange={onChange}
        />
      ) : draft.activeProtocolType === "intervals" ? (
        <IntervalFields
          disabled={disabled}
          distanceUnit={distanceUnit}
          draft={draft}
          narrow={narrow}
          onChange={onChange}
        />
      ) : (
        <CircuitFields disabled={disabled} draft={draft} onChange={onChange} />
      )}

      <IntensityFields
        baselines={baselines}
        disabled={disabled}
        draft={draft}
        onChange={onChange}
      />

      <FormTextInput
        disabled={disabled}
        label="Notes"
        maxLength={conditioningValidationLimits.notesLength}
        multiline
        onChangeText={(notesInput) => updateDraft({ notesInput })}
        placeholder="Optional notes"
        value={draft.notesInput}
      />
    </View>
  );
}

export function ConditioningTitleInput({
  compact = false,
  disabled = false,
  onChangeText,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <FormTextInput
      disabled={disabled}
      hideLabel={compact}
      label="Session title"
      maxLength={conditioningValidationLimits.titleLength}
      onChangeText={onChangeText}
      placeholder="Session title"
      textAlign={compact ? "left" : "center"}
      value={value}
    />
  );
}

export function ConditioningAdaptationBadge({
  compact = false,
  onPress,
  scoreResult,
}: {
  compact?: boolean;
  onPress?: () => void;
  scoreResult: ConditioningScoreResult;
}) {
  const { theme } = useAppTheme();
  const adaptation =
    scoreResult.status === "scored" && scoreResult.primaryAdaptation
      ? conditioningAdaptations[scoreResult.primaryAdaptation]
      : null;
  const adaptationLabel = adaptation?.label ?? "Adaptation pending";

  return (
    <PressOpacity
      accessibilityHint="Shows how this session is expected to affect conditioning"
      accessibilityLabel={`Primary adaptation, ${adaptationLabel}`}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.adaptationBadge,
        compact && styles.compactAdaptationBadge,
        {
          backgroundColor: adaptation?.color ?? theme.colors.surfaceMuted,
          borderColor: adaptation?.color ?? theme.colors.borderStrong,
        },
      ]}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={2}
        style={[
          styles.adaptationBadgeText,
          { color: adaptation?.contentColor ?? theme.colors.textMuted },
        ]}
      >
        {adaptationLabel}
      </Text>
    </PressOpacity>
  );
}

function ConditioningScoreHelp({
  scoreResult,
}: {
  scoreResult: ConditioningScoreResult;
}) {
  const { theme } = useAppTheme();
  return scoreResult.status === "insufficient" &&
    scoreResult.reasons.length > 0 ? (
    <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
      {scoreResult.reasons[0]}
    </Text>
  ) : null;
}

type SharedDraftProps = {
  disabled: boolean;
  draft: ConditioningSessionFormDraft;
  onChange: (draft: ConditioningSessionFormDraft) => void;
};

function ContinuousFields({
  disabled,
  distanceUnit,
  draft,
  onChange,
}: SharedDraftProps & { distanceUnit: UnitSystem }) {
  const continuous = draft.continuous;

  return (
    <View style={styles.section}>
      <ElapsedDurationField
        disabled={disabled}
        label="Duration"
        onChange={(durationSeconds) =>
          onChange({
            ...draft,
            continuous: { ...continuous, durationSeconds },
          })
        }
        valueSeconds={continuous.durationSeconds}
      />
      <DistanceField
        disabled={disabled}
        label="Distance"
        onChangeText={(displayInput) =>
          onChange({
            ...draft,
            continuous: {
              ...continuous,
              distance: updateConditioningDistanceInput(
                continuous.distance,
                displayInput,
                distanceUnit,
              ),
            },
          })
        }
        unit={distanceUnit}
        value={continuous.distance.displayInput}
      />
      <ReadOnlyValue
        label="Pace"
        value={formatPace(
          continuous.durationSeconds ?? Number.NaN,
          continuous.distance.canonicalMeters ?? Number.NaN,
          distanceUnit,
        )}
      />
    </View>
  );
}

function IntervalFields({
  disabled,
  distanceUnit,
  draft,
  narrow,
  onChange,
}: SharedDraftProps & { distanceUnit: UnitSystem; narrow: boolean }) {
  const intervals = draft.intervals;
  const distanceWork = intervals.distanceWork;

  return (
    <View style={styles.section}>
      <View style={styles.workRestRow}>
        <View style={styles.flexField}>
          <ConditioningSelectField
            compact
            disabled={disabled}
            label="Work"
            onChange={(workMode) =>
              onChange(selectIntervalWorkMode(draft, workMode))
            }
            options={intervalWorkOptions}
            value={intervals.workMode}
          />

          {intervals.workMode === "time" ? (
            <ElapsedDurationField
              disabled={disabled}
              label="Work duration"
              onChange={(timeWorkDurationSeconds) =>
                onChange({
                  ...draft,
                  intervals: { ...intervals, timeWorkDurationSeconds },
                })
              }
              valueSeconds={intervals.timeWorkDurationSeconds}
            />
          ) : (
            <View style={styles.subsection}>
              <DistanceField
                disabled={disabled}
                label="Distance per interval"
                onChangeText={(displayInput) =>
                  onChange({
                    ...draft,
                    intervals: {
                      ...intervals,
                      distanceWork: {
                        ...distanceWork,
                        distance: updateConditioningDistanceInput(
                          distanceWork.distance,
                          displayInput,
                          distanceUnit,
                        ),
                      },
                    },
                  })
                }
                unit={distanceUnit}
                value={distanceWork.distance.displayInput}
              />
              <ElapsedDurationField
                disabled={disabled}
                label="Duration per interval"
                onChange={(durationSeconds) =>
                  onChange({
                    ...draft,
                    intervals: {
                      ...intervals,
                      distanceWork: {
                        ...distanceWork,
                        durationDirty: true,
                        durationSeconds,
                        legacyTotalDurationSeconds: undefined,
                        provenance: "explicit",
                      },
                    },
                  })
                }
                valueSeconds={distanceWork.durationSeconds}
              />
            </View>
          )}
        </View>

        <View style={styles.flexField}>
          <ElapsedDurationField
            allowZero
            disabled={disabled}
            label="Rest Time"
            onChange={(restBetweenIntervalsSeconds) =>
              onChange({
                ...draft,
                intervals: { ...intervals, restBetweenIntervalsSeconds },
              })
            }
            valueSeconds={intervals.restBetweenIntervalsSeconds}
          />
        </View>
      </View>

      <View style={[styles.structureRow, narrow && styles.wrappedRow]}>
        <View style={styles.flexField}>
          <FormTextInput
            disabled={disabled}
            keyboardType="number-pad"
            label="Intervals"
            maxLength={3}
            onChangeText={(intervalCountInput) =>
              onChange({
                ...draft,
                intervals: { ...intervals, intervalCountInput },
              })
            }
            value={intervals.intervalCountInput}
          />
        </View>
        <View style={styles.flexField}>
          <FormTextInput
            disabled={disabled}
            keyboardType="number-pad"
            label="Rounds"
            maxLength={2}
            onChangeText={(roundCountInput) =>
              onChange({
                ...draft,
                intervals: { ...intervals, roundCountInput },
              })
            }
            value={intervals.roundCountInput}
          />
        </View>
        <View style={[styles.flexField, narrow && styles.fullWidth]}>
          <ElapsedDurationField
            allowZero
            disabled={disabled}
            label="Rest between Rounds"
            onChange={(restBetweenRoundsSeconds) =>
              onChange({
                ...draft,
                intervals: { ...intervals, restBetweenRoundsSeconds },
              })
            }
            valueSeconds={intervals.restBetweenRoundsSeconds}
          />
        </View>
      </View>
    </View>
  );
}

function CircuitFields({ disabled, draft, onChange }: SharedDraftProps) {
  const { theme } = useAppTheme();
  const circuit = draft.circuit;

  function updateCircuit(patch: Partial<typeof circuit>) {
    onChange({ ...draft, circuit: { ...circuit, ...patch } });
  }

  return (
    <View style={styles.section}>
      <View style={styles.stationHeadingRow}>
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
          Stations
        </Text>
        <SmallAction
          disabled={
            disabled ||
            circuit.stations.length >= conditioningValidationLimits.stations
          }
          label="Add station"
          onPress={() =>
            updateCircuit({
              stations: [
                ...circuit.stations,
                { nameInput: "", workSeconds: null },
              ],
            })
          }
        />
      </View>

      {circuit.stations.map((station, index) => (
        <View
          key={index}
          style={[
            styles.stationCard,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.stationHeadingRow}>
            <Text style={[styles.stationTitle, { color: theme.colors.text }]}>
              Station {index + 1}
            </Text>
            {circuit.stations.length > 1 ? (
              <SmallAction
                disabled={disabled}
                label={`Remove station ${index + 1}`}
                onPress={() =>
                  updateCircuit({
                    stations: circuit.stations.filter(
                      (_candidate, candidateIndex) => candidateIndex !== index,
                    ),
                  })
                }
              />
            ) : null}
          </View>
          <FormTextInput
            disabled={disabled}
            label="Name"
            maxLength={conditioningValidationLimits.stationNameLength}
            onChangeText={(nameInput) =>
              updateCircuit({
                stations: circuit.stations.map((candidate, candidateIndex) =>
                  candidateIndex === index
                    ? { ...candidate, nameInput }
                    : candidate,
                ),
              })
            }
            value={station.nameInput}
          />
          <ElapsedDurationField
            disabled={disabled}
            label="Work duration"
            onChange={(workSeconds) =>
              updateCircuit({
                stations: circuit.stations.map((candidate, candidateIndex) =>
                  candidateIndex === index
                    ? { ...candidate, workSeconds }
                    : candidate,
                ),
              })
            }
            valueSeconds={station.workSeconds}
          />
        </View>
      ))}

      <View style={styles.structureRow}>
        <View style={styles.flexField}>
          <ElapsedDurationField
            allowZero
            disabled={disabled}
            label="Rest between Stations"
            onChange={(restBetweenStationsSeconds) =>
              updateCircuit({ restBetweenStationsSeconds })
            }
            valueSeconds={circuit.restBetweenStationsSeconds}
          />
        </View>
        <View style={styles.flexField}>
          <FormTextInput
            disabled={disabled}
            keyboardType="number-pad"
            label="Rounds"
            maxLength={2}
            onChangeText={(roundCountInput) =>
              updateCircuit({ roundCountInput })
            }
            value={circuit.roundCountInput}
          />
        </View>
      </View>
      <ElapsedDurationField
        allowZero
        disabled={disabled}
        label="Rest between Rounds"
        onChange={(restBetweenRoundsSeconds) =>
          updateCircuit({ restBetweenRoundsSeconds })
        }
        valueSeconds={circuit.restBetweenRoundsSeconds}
      />
    </View>
  );
}

function IntensityFields({
  baselines,
  disabled,
  draft,
  onChange,
}: SharedDraftProps & { baselines: AthleteConditioningBaselines }) {
  const { theme } = useAppTheme();
  const intensity = draft.intensity;

  function updateIntensity(patch: Partial<ConditioningIntensityDraft>) {
    onChange({
      ...draft,
      intensity: {
        ...intensity,
        ...patch,
        dirty: true,
        historicalSnapshot: null,
      },
    });
  }

  return (
    <View style={styles.section}>
      {intensity.activeMethod === "legacy_pace" ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Intensity
          </Text>
          <View
            accessibilityLabel="Intensity, Pace, legacy value"
            style={[
              styles.informationalValue,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.valueText, { color: theme.colors.text }]}>
              Pace — Legacy value
            </Text>
          </View>
          <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
            This saved value is preserved until Heart Rate or RPE is selected.
          </Text>
          <View style={styles.inlineActions}>
            <SmallAction
              disabled={disabled}
              label="Use Heart Rate"
              onPress={() =>
                onChange(
                  selectConditioningIntensityMethod(draft, "heart_rate"),
                )
              }
            />
            <SmallAction
              disabled={disabled}
              label="Use RPE"
              onPress={() =>
                onChange(selectConditioningIntensityMethod(draft, "rpe"))
              }
            />
          </View>
        </View>
      ) : (
        <>
          <ConditioningSelectField
            accessibilityHint="Intensity is optional"
            disabled={disabled}
            label="Intensity"
            onChange={(method) =>
              onChange(selectConditioningIntensityMethod(draft, method))
            }
            options={intensityMethodOptions}
            placeholder="Choose intensity (optional)"
            value={intensity.activeMethod}
          />
          {intensity.activeMethod !== null ? (
            <SmallAction
              disabled={disabled}
              label="Clear intensity"
              onPress={() => onChange(clearConditioningIntensity(draft))}
            />
          ) : null}
        </>
      )}

      {intensity.activeMethod === "heart_rate" ? (
        <View style={styles.fieldWithHelp}>
          <FormTextInput
            disabled={disabled}
            keyboardType="number-pad"
            label="Average Heart Rate"
            maxLength={3}
            onChangeText={(heartRateInput) =>
              updateIntensity({ heartRateInput })
            }
            suffix="BPM"
            value={intensity.heartRateInput}
          />
          <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
            {baselines.maximumHeartRateBpm === null
              ? "Set Maximum Heart Rate in Athlete Information first."
              : `Valid range: ${conditioningValidationLimits.sessionHeartRateBpm.minimum}–${baselines.maximumHeartRateBpm} BPM.`}
          </Text>
        </View>
      ) : intensity.activeMethod === "rpe" ? (
        <FormTextInput
          disabled={disabled}
          keyboardType="decimal-pad"
          label="RPE"
          maxLength={4}
          onChangeText={(rpeInput) => updateIntensity({ rpeInput })}
          placeholder="1–10"
          value={intensity.rpeInput}
        />
      ) : null}
    </View>
  );
}

type FormTextInputProps = {
  disabled?: boolean;
  hideLabel?: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  textAlign?: "auto" | "left" | "right" | "center" | "justify";
  value: string;
};

function FormTextInput({
  disabled = false,
  hideLabel = false,
  keyboardType = "default",
  label,
  maxLength,
  multiline = false,
  onChangeText,
  placeholder,
  suffix,
  textAlign,
  value,
}: FormTextInputProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      {!hideLabel ? (
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
            opacity: disabled ? tokens.opacity.disabled : 1,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          editable={!disabled}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.tertiary}
          style={[
            styles.input,
            multiline && styles.notesInput,
            { color: theme.colors.text, textAlign },
          ]}
          value={value}
        />
        {suffix ? (
          <Text style={[styles.suffix, { color: theme.colors.textMuted }]}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DistanceField({
  disabled,
  label,
  onChangeText,
  unit,
  value,
}: {
  disabled: boolean;
  label: string;
  onChangeText: (value: string) => void;
  unit: UnitSystem;
  value: string;
}) {
  return (
    <FormTextInput
      disabled={disabled}
      keyboardType="decimal-pad"
      label={label}
      onChangeText={onChangeText}
      suffix={getDistanceUnitLabel(unit)}
      value={value}
    />
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View
        accessibilityLabel={`${label}, ${value}`}
        style={[
          styles.informationalValue,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.valueText, { color: theme.colors.textMuted }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SmallAction({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <PressOpacity
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.smallButton}
    >
      <Text style={[styles.smallButtonText, { color: theme.colors.tertiary }]}>
        {label}
      </Text>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.spacing.lg },
  heading: { alignItems: "center", gap: tokens.spacing.sm },
  adaptationBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 0,
    maxWidth: "80%",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  adaptationBadgeText: {
    flexShrink: 1,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  compactAdaptationBadge: {
    flexShrink: 1,
    maxWidth: "52%",
    minWidth: 0,
  },
  section: { gap: tokens.spacing.md },
  subsection: { gap: tokens.spacing.md, paddingTop: tokens.spacing.sm },
  field: { flexShrink: 1, gap: tokens.spacing.sm, minWidth: 0 },
  fieldWithHelp: { gap: tokens.spacing.xs },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  inputShell: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  notesInput: { minHeight: 92, textAlignVertical: "top" },
  suffix: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    paddingRight: tokens.spacing.md,
  },
  informationalValue: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  valueText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  workRestRow: { flexDirection: "row", gap: tokens.spacing.md },
  structureRow: { flexDirection: "row", gap: tokens.spacing.sm },
  wrappedRow: { flexWrap: "wrap" },
  flexField: { flex: 1, minWidth: 112 },
  fullWidth: { flexBasis: "100%" },
  stationHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  sectionHeading: { fontSize: 18, fontWeight: "700" },
  stationTitle: { fontSize: 16, fontWeight: "700" },
  stationCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
  },
  smallButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
  },
  smallButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
  },
  helpText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
