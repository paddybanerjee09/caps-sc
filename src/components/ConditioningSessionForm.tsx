import Ionicons from "@expo/vector-icons/Ionicons";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import {
  conditioningActivityOptions,
  conditioningAdaptations,
  conditioningProtocolOptions,
  conditioningValidationLimits,
} from "../constants/conditioning";
import { useAppTheme } from "../theme/ThemeContext";
import { appColorPalette, themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningActivity,
  ConditioningIntensityMethod,
  ConditioningPaceReference,
  ConditioningProtocolDraft,
  ConditioningProtocolType,
  ConditioningScoreResult,
} from "../types/conditioning";
import { ConditioningSelectField } from "./ConditioningSelectField";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

const intensityMethodOptions = [
  { key: "none", label: "No intensity" },
  { key: "rpe", label: "RPE" },
  { key: "heart_rate", label: "Heart Rate" },
  { key: "pace", label: "Pace" },
] as const satisfies readonly {
  key: ConditioningIntensityMethod | "none";
  label: string;
}[];

const paceReferenceOptions = [
  { key: "threshold_pace", label: "Threshold Pace" },
  { key: "maximum_aerobic_speed", label: "Maximum Aerobic Speed" },
] as const satisfies readonly {
  key: ConditioningPaceReference;
  label: string;
}[];

export type ConditioningIntensityDraft =
  | { method: null }
  | { method: "rpe"; valueInput: string }
  | { method: "heart_rate"; valueBpmInput: string }
  | {
      method: "pace";
      reference: ConditioningPaceReference;
      valueInput: string;
    };

export type ConditioningSessionFormDraft = {
  activity: ConditioningActivity;
  intensity: ConditioningIntensityDraft;
  notesInput: string;
  protocol: ConditioningProtocolDraft;
  titleInput: string;
};

export type ConditioningSessionFormProps = {
  baselines: AthleteConditioningBaselines;
  disabled?: boolean;
  draft: ConditioningSessionFormDraft;
  onAdaptationPress?: () => void;
  onChange: (draft: ConditioningSessionFormDraft) => void;
  scoreResult: ConditioningScoreResult;
};

export function createDefaultConditioningProtocolDraft(
  type: ConditioningProtocolType,
): ConditioningProtocolDraft {
  if (type === "continuous") {
    return {
      type,
      distanceMetersInput: "",
      durationSecondsInput: "",
    };
  }

  if (type === "time_intervals") {
    return {
      type,
      repetitionsPerSetInput: "1",
      restBetweenRepetitionsSecondsInput: "0",
      restBetweenSetsSecondsInput: "0",
      setCountInput: "1",
      workSecondsInput: "",
    };
  }

  if (type === "distance_intervals") {
    return {
      type,
      elapsedDurationSecondsInput: "",
      repetitionsPerSetInput: "1",
      restBetweenRepetitionsSecondsInput: "0",
      restBetweenSetsSecondsInput: "0",
      setCountInput: "1",
      workDistanceMetersInput: "",
    };
  }

  return {
    type,
    restBetweenRoundsSecondsInput: "0",
    restBetweenStationsSecondsInput: "0",
    roundCountInput: "1",
    stations: [{ nameInput: "", workSecondsInput: "" }],
  };
}

export function createDefaultConditioningSessionFormDraft(): ConditioningSessionFormDraft {
  return {
    activity: "running",
    intensity: { method: null },
    notesInput: "",
    protocol: createDefaultConditioningProtocolDraft("continuous"),
    titleInput: "",
  };
}

export function ConditioningSessionForm({
  baselines,
  disabled = false,
  draft,
  onAdaptationPress,
  onChange,
  scoreResult,
}: ConditioningSessionFormProps) {
  const { theme } = useAppTheme();
  const primaryPresentation =
    scoreResult.status === "scored"
      ? conditioningAdaptations[scoreResult.primaryAdaptation]
      : null;
  const paceAllowed = isPaceActivity(draft.activity);
  const availableIntensityOptions = paceAllowed
    ? intensityMethodOptions
    : intensityMethodOptions.filter((option) => option.key !== "pace");

  function updateDraft(changes: Partial<ConditioningSessionFormDraft>) {
    onChange({ ...draft, ...changes });
  }

  function changeActivity(activity: ConditioningActivity) {
    updateDraft({
      activity,
      intensity:
        draft.intensity.method === "pace" && !isPaceActivity(activity)
          ? { method: null }
          : draft.intensity,
    });
  }

  function changeIntensityMethod(
    method: ConditioningIntensityMethod | "none",
  ) {
    if (method === "none") {
      updateDraft({ intensity: { method: null } });
      return;
    }

    if (method === "rpe") {
      updateDraft({ intensity: { method, valueInput: "" } });
      return;
    }

    if (method === "heart_rate") {
      updateDraft({ intensity: { method, valueBpmInput: "" } });
      return;
    }

    updateDraft({
      intensity: {
        method,
        reference: "threshold_pace",
        valueInput: "",
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <FormTextInput
          accessibilityLabel="Conditioning session title"
          disabled={disabled}
          maxLength={conditioningValidationLimits.titleLength}
          onChangeText={(titleInput) => updateDraft({ titleInput })}
          placeholder="Session title"
          textAlign="center"
          value={draft.titleInput}
        />

        <PressOpacity
          accessibilityLabel={
            primaryPresentation
              ? `View all adaptation scores. Primary adaptation ${primaryPresentation.label}. ${scoreResult.evidence} evidence.`
              : "Adaptation is undetermined"
          }
          disabled={
            disabled || primaryPresentation === null || !onAdaptationPress
          }
          onPress={onAdaptationPress}
          style={[
            styles.adaptationBadge,
            {
              backgroundColor:
                primaryPresentation?.color ?? theme.colors.surfaceMuted,
              borderColor:
                primaryPresentation?.color ?? theme.colors.borderStrong,
            },
          ]}
        >
          <Text
            style={[
              styles.adaptationBadgeText,
              {
                color:
                  primaryPresentation?.contentColor ?? theme.colors.textMuted,
              },
            ]}
          >
            {primaryPresentation?.label ?? "Undetermined"}
          </Text>

          {primaryPresentation ? (
            <Ionicons
              accessible={false}
              color={primaryPresentation.contentColor}
              name="stats-chart"
              size={15}
            />
          ) : null}
        </PressOpacity>

        {scoreResult.status === "insufficient" &&
        scoreResult.reasons.length > 0 ? (
          <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
            {scoreResult.reasons[0]}
          </Text>
        ) : null}
      </View>

      <ConditioningSelectField
        disabled={disabled}
        label="Activity"
        onChange={changeActivity}
        options={conditioningActivityOptions}
        value={draft.activity}
      />

      <ConditioningSelectField
        disabled={disabled}
        label="Type"
        onChange={(type) =>
          updateDraft({ protocol: createDefaultConditioningProtocolDraft(type) })
        }
        options={conditioningProtocolOptions}
        value={draft.protocol.type}
      />

      <ProtocolFields
        disabled={disabled}
        onChange={(protocol) => updateDraft({ protocol })}
        protocol={draft.protocol}
      />

      <ConditioningSelectField
        accessibilityHint="Intensity is optional"
        disabled={disabled}
        label="Intensity"
        onChange={changeIntensityMethod}
        options={availableIntensityOptions}
        value={draft.intensity.method ?? "none"}
      />

      {!paceAllowed ? (
        <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
          Pace intensity is available for Running and Hill Sprints.
        </Text>
      ) : null}

      <IntensityFields
        baselines={baselines}
        disabled={disabled}
        intensity={draft.intensity}
        onChange={(intensity) => updateDraft({ intensity })}
      />

      <FormTextInput
        accessibilityLabel="Conditioning session notes"
        disabled={disabled}
        label="Notes (optional)"
        maxLength={conditioningValidationLimits.notesLength}
        multiline
        onChangeText={(notesInput) => updateDraft({ notesInput })}
        placeholder="Add session notes"
        value={draft.notesInput}
      />
    </View>
  );
}

function ProtocolFields({
  disabled,
  onChange,
  protocol,
}: {
  disabled: boolean;
  onChange: (protocol: ConditioningProtocolDraft) => void;
  protocol: ConditioningProtocolDraft;
}) {
  const { theme } = useAppTheme();

  if (protocol.type === "continuous") {
    return (
      <View style={styles.section}>
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Duration (seconds)"
          onChangeText={(durationSecondsInput) =>
            onChange({ ...protocol, durationSecondsInput })
          }
          placeholder="1800"
          value={protocol.durationSecondsInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="decimal-pad"
          label="Distance (metres, optional)"
          onChangeText={(distanceMetersInput) =>
            onChange({ ...protocol, distanceMetersInput })
          }
          placeholder="5000"
          value={protocol.distanceMetersInput}
        />
      </View>
    );
  }

  if (protocol.type === "time_intervals") {
    return (
      <View style={styles.section}>
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Work duration (seconds)"
          onChangeText={(workSecondsInput) =>
            onChange({ ...protocol, workSecondsInput })
          }
          placeholder="30"
          value={protocol.workSecondsInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Rest between repetitions (seconds)"
          onChangeText={(restBetweenRepetitionsSecondsInput) =>
            onChange({ ...protocol, restBetweenRepetitionsSecondsInput })
          }
          placeholder="30"
          value={protocol.restBetweenRepetitionsSecondsInput}
        />
        <CountFields
          disabled={disabled}
          onRepetitionsChange={(repetitionsPerSetInput) =>
            onChange({ ...protocol, repetitionsPerSetInput })
          }
          onSetsChange={(setCountInput) =>
            onChange({ ...protocol, setCountInput })
          }
          repetitionsInput={protocol.repetitionsPerSetInput}
          setsInput={protocol.setCountInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Rest between sets (seconds)"
          onChangeText={(restBetweenSetsSecondsInput) =>
            onChange({ ...protocol, restBetweenSetsSecondsInput })
          }
          placeholder="120"
          value={protocol.restBetweenSetsSecondsInput}
        />
      </View>
    );
  }

  if (protocol.type === "distance_intervals") {
    return (
      <View style={styles.section}>
        <FormTextInput
          disabled={disabled}
          keyboardType="decimal-pad"
          label="Distance per repetition (metres)"
          onChangeText={(workDistanceMetersInput) =>
            onChange({ ...protocol, workDistanceMetersInput })
          }
          placeholder="400"
          value={protocol.workDistanceMetersInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Total elapsed duration (seconds)"
          onChangeText={(elapsedDurationSecondsInput) =>
            onChange({ ...protocol, elapsedDurationSecondsInput })
          }
          placeholder="1800"
          value={protocol.elapsedDurationSecondsInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Rest between repetitions (seconds)"
          onChangeText={(restBetweenRepetitionsSecondsInput) =>
            onChange({ ...protocol, restBetweenRepetitionsSecondsInput })
          }
          placeholder="60"
          value={protocol.restBetweenRepetitionsSecondsInput}
        />
        <CountFields
          disabled={disabled}
          onRepetitionsChange={(repetitionsPerSetInput) =>
            onChange({ ...protocol, repetitionsPerSetInput })
          }
          onSetsChange={(setCountInput) =>
            onChange({ ...protocol, setCountInput })
          }
          repetitionsInput={protocol.repetitionsPerSetInput}
          setsInput={protocol.setCountInput}
        />
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Rest between sets (seconds)"
          onChangeText={(restBetweenSetsSecondsInput) =>
            onChange({ ...protocol, restBetweenSetsSecondsInput })
          }
          placeholder="120"
          value={protocol.restBetweenSetsSecondsInput}
        />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.stationHeadingRow}>
        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>
          Stations
        </Text>
        <PressOpacity
          accessibilityLabel="Add circuit station"
          disabled={
            disabled ||
            protocol.stations.length >= conditioningValidationLimits.stations
          }
          onPress={() =>
            onChange({
              ...protocol,
              stations: [
                ...protocol.stations,
                { nameInput: "", workSecondsInput: "" },
              ],
            })
          }
          style={styles.smallButton}
        >
          <Ionicons
            color={theme.colors.tertiary}
            name="add"
            size={18}
          />
          <Text
            style={[
              styles.smallButtonText,
              { color: theme.colors.tertiary },
            ]}
          >
            Add station
          </Text>
        </PressOpacity>
      </View>

      {protocol.stations.map((station, index) => (
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
            {protocol.stations.length > 1 ? (
              <PressOpacity
                accessibilityLabel={`Remove station ${index + 1}`}
                disabled={disabled}
                onPress={() =>
                  onChange({
                    ...protocol,
                    stations: protocol.stations.filter(
                      (_, stationIndex) => stationIndex !== index,
                    ),
                  })
                }
                style={styles.removeButton}
              >
                <Ionicons
                  color={appColorPalette.red}
                  name="trash-outline"
                  size={18}
                />
                <Text style={styles.removeButtonText}>Remove</Text>
              </PressOpacity>
            ) : null}
          </View>

          <FormTextInput
            accessibilityLabel={`Station ${index + 1} name`}
            disabled={disabled}
            maxLength={conditioningValidationLimits.stationNameLength}
            onChangeText={(nameInput) =>
              onChange({
                ...protocol,
                stations: protocol.stations.map((currentStation, stationIndex) =>
                  stationIndex === index
                    ? { ...currentStation, nameInput }
                    : currentStation,
                ),
              })
            }
            placeholder="Jump rope"
            value={station.nameInput}
          />
          <FormTextInput
            accessibilityLabel={`Station ${index + 1} work duration in seconds`}
            disabled={disabled}
            keyboardType="number-pad"
            label="Work duration (seconds)"
            onChangeText={(workSecondsInput) =>
              onChange({
                ...protocol,
                stations: protocol.stations.map((currentStation, stationIndex) =>
                  stationIndex === index
                    ? { ...currentStation, workSecondsInput }
                    : currentStation,
                ),
              })
            }
            placeholder="60"
            value={station.workSecondsInput}
          />
        </View>
      ))}

      <FormTextInput
        disabled={disabled}
        keyboardType="number-pad"
        label="Rest between stations (seconds)"
        onChangeText={(restBetweenStationsSecondsInput) =>
          onChange({ ...protocol, restBetweenStationsSecondsInput })
        }
        placeholder="15"
        value={protocol.restBetweenStationsSecondsInput}
      />
      <FormTextInput
        disabled={disabled}
        keyboardType="number-pad"
        label="Rounds"
        onChangeText={(roundCountInput) =>
          onChange({ ...protocol, roundCountInput })
        }
        placeholder="3"
        value={protocol.roundCountInput}
      />
      <FormTextInput
        disabled={disabled}
        keyboardType="number-pad"
        label="Rest between rounds (seconds)"
        onChangeText={(restBetweenRoundsSecondsInput) =>
          onChange({ ...protocol, restBetweenRoundsSecondsInput })
        }
        placeholder="120"
        value={protocol.restBetweenRoundsSecondsInput}
      />
    </View>
  );
}

function CountFields({
  disabled,
  onRepetitionsChange,
  onSetsChange,
  repetitionsInput,
  setsInput,
}: {
  disabled: boolean;
  onRepetitionsChange: (value: string) => void;
  onSetsChange: (value: string) => void;
  repetitionsInput: string;
  setsInput: string;
}) {
  return (
    <View style={styles.twoColumnRow}>
      <View style={styles.flexField}>
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Repetitions per set"
          onChangeText={onRepetitionsChange}
          placeholder="8"
          value={repetitionsInput}
        />
      </View>
      <View style={styles.flexField}>
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Sets"
          onChangeText={onSetsChange}
          placeholder="1"
          value={setsInput}
        />
      </View>
    </View>
  );
}

function IntensityFields({
  baselines,
  disabled,
  intensity,
  onChange,
}: {
  baselines: AthleteConditioningBaselines;
  disabled: boolean;
  intensity: ConditioningIntensityDraft;
  onChange: (intensity: ConditioningIntensityDraft) => void;
}) {
  const { theme } = useAppTheme();

  if (intensity.method === null) {
    return null;
  }

  if (intensity.method === "rpe") {
    return (
      <FormTextInput
        disabled={disabled}
        keyboardType="number-pad"
        label="RPE (1–10)"
        onChangeText={(valueInput) => onChange({ ...intensity, valueInput })}
        placeholder="7"
        value={intensity.valueInput}
      />
    );
  }

  if (intensity.method === "heart_rate") {
    return (
      <View style={styles.fieldWithHelp}>
        <FormTextInput
          disabled={disabled}
          keyboardType="number-pad"
          label="Session heart rate (BPM)"
          onChangeText={(valueBpmInput) =>
            onChange({ ...intensity, valueBpmInput })
          }
          placeholder="170"
          value={intensity.valueBpmInput}
        />
        <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
          {baselines.maximumHeartRateBpm === null
            ? "Set Maximum Heart Rate in Athlete Information before saving."
            : `Maximum Heart Rate: ${baselines.maximumHeartRateBpm} BPM`}
        </Text>
      </View>
    );
  }

  const thresholdPace = intensity.reference === "threshold_pace";

  return (
    <View style={styles.section}>
      <ConditioningSelectField
        disabled={disabled}
        label="Pace reference"
        onChange={(reference) =>
          onChange({ ...intensity, reference, valueInput: "" })
        }
        options={paceReferenceOptions}
        value={intensity.reference}
      />
      <FormTextInput
        disabled={disabled}
        keyboardType={thresholdPace ? "numbers-and-punctuation" : "decimal-pad"}
        label={
          thresholdPace
            ? "Session pace (m:ss per km)"
            : "Session speed (km/h)"
        }
        onChangeText={(valueInput) => onChange({ ...intensity, valueInput })}
        placeholder={thresholdPace ? "4:30" : "15"}
        value={intensity.valueInput}
      />
      <Text style={[styles.helpText, { color: theme.colors.textMuted }]}>
        {thresholdPace
          ? baselines.thresholdPaceSecondsPerKm === null
            ? "Set Threshold Pace in Athlete Information before saving."
            : `Threshold Pace: ${formatPace(baselines.thresholdPaceSecondsPerKm)} per km`
          : baselines.maximumAerobicSpeedKph === null
            ? "Set Maximum Aerobic Speed in Athlete Information before saving."
            : `Maximum Aerobic Speed: ${baselines.maximumAerobicSpeedKph.toLocaleString([], { maximumFractionDigits: 2 })} km/h`}
      </Text>
    </View>
  );
}

function FormTextInput({
  accessibilityLabel,
  disabled,
  keyboardType = "default",
  label,
  maxLength,
  multiline = false,
  onChangeText,
  placeholder,
  textAlign = "left",
  value,
}: {
  accessibilityLabel?: string;
  disabled: boolean;
  keyboardType?: KeyboardTypeOptions;
  label?: string;
  maxLength?: number;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  textAlign?: "center" | "left";
  value: string;
}) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
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
          {
            borderColor: theme.colors.borderStrong,
            color: theme.colors.text,
            opacity: disabled ? tokens.opacity.disabled : 1,
            textAlign,
          },
        ]}
        value={value}
      />
    </View>
  );
}

function isPaceActivity(activity: ConditioningActivity) {
  return activity === "running" || activity === "hill_sprints";
}

function formatPace(secondsPerKm: number) {
  const roundedSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.lg,
  },
  heading: {
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  adaptationBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  adaptationBadgeText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  section: {
    gap: tokens.spacing.md,
  },
  sectionHeading: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  field: {
    gap: tokens.spacing.sm,
    width: "100%",
  },
  fieldWithHelp: {
    gap: tokens.spacing.xs,
  },
  label: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  input: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    fontSize: tokens.typography.body.fontSize,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  helpText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  twoColumnRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  flexField: {
    flex: 1,
    minWidth: 0,
  },
  stationHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  stationCard: {
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  stationTitle: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  smallButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
  },
  smallButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  removeButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xs,
  },
  removeButtonText: {
    color: appColorPalette.red,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
