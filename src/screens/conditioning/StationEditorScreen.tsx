import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import {
  ActionButton,
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
import { themes } from "../../theme/theme";
import type { StationCompletionType, StationConfig } from "../../conditioning/types";

const tokens = themes.dark;
const completionTypes: StationCompletionType[] = [
  "time",
  "repetitions",
  "distance",
  "machine_calories",
  "manual",
];

export function StationEditorScreen({ stationId }: { stationId: string | null }) {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const existing = workspace.editor?.draft.stations.find((station) => station.id === stationId);
  const [station, setStation] = useState<StationConfig>(
    () => existing ?? createStation(workspace.editor?.draft.stations.length ?? 0),
  );
  const [error, setError] = useState<string | null>(null);

  function chooseType(nextType: StationCompletionType) {
    const discarded = incompatibleStationFields(station, nextType);
    const apply = () => setStation(applyStationCompletionType(station, nextType));
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
    const errors = validateStation({ ...station, exerciseName: station.exerciseName.trim() });
    if (errors.length > 0) {
      setError(errors[0]?.message ?? "Check this station");
      return;
    }
    const draft = workspace.editor?.draft;
    if (!draft) {
      workspace.pop();
      return;
    }
    const nextStation = { ...station, exerciseName: station.exerciseName.trim() };
    const stations = existing
      ? draft.stations.map((item) => (item.id === nextStation.id ? nextStation : item))
      : [...draft.stations, nextStation].map((item, position) => ({ ...item, position }));
    workspace.updateEditor({ ...draft, stations });
    workspace.pop();
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onBack={workspace.pop} title={existing ? "Edit station" : "Add station"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FieldLabel>Exercise</FieldLabel>
        <FormInput
          accessibilityLabel="Exercise name"
          onChangeText={(exerciseName) => setStation({ ...station, exerciseName })}
          value={station.exerciseName}
        />
        <FieldLabel>Completion</FieldLabel>
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
        {station.completionType === "time" ? (
          <NullableNumber
            label="Work seconds"
            onChange={(workSeconds) => setStation({ ...station, workSeconds })}
            value={station.workSeconds}
          />
        ) : null}
        {station.completionType === "repetitions" ? (
          <NullableNumber
            label="Target reps"
            onChange={(targetReps) => setStation({ ...station, targetReps })}
            value={station.targetReps}
          />
        ) : null}
        {station.completionType === "distance" ? (
          <NullableNumber
            label="Distance meters"
            onChange={(distanceMeters) => setStation({ ...station, distanceMeters })}
            value={station.distanceMeters}
          />
        ) : null}
        {station.completionType === "machine_calories" ? (
          <NullableNumber
            label="Machine calories"
            onChange={(machineCalories) => setStation({ ...station, machineCalories })}
            value={station.machineCalories}
          />
        ) : null}
        {station.completionType === "repetitions" || station.completionType === "distance" ? (
          <NullableNumber
            label="Load kilograms (optional)"
            onChange={(loadKg) => setStation({ ...station, loadKg })}
            value={station.loadKg}
          />
        ) : null}
        {station.completionType === "manual" ? (
          <>
            <FieldLabel>Instructions</FieldLabel>
            <FormInput
              accessibilityLabel="Instructions"
              onChangeText={(instructions) => setStation({ ...station, instructions })}
              value={station.instructions ?? ""}
            />
          </>
        ) : null}
        <NullableNumber
          label="Recovery seconds"
          onChange={(recoverySeconds) =>
            setStation({ ...station, recoverySeconds: recoverySeconds ?? 0 })
          }
          value={station.recoverySeconds}
        />
        <NullableNumber
          label="Target RPE (optional)"
          onChange={(targetRpe) => setStation({ ...station, targetRpe })}
          value={station.targetRpe}
        />
        <FieldLabel>Notes</FieldLabel>
        <FormInput
          accessibilityLabel="Station notes"
          onChangeText={(notes) => setStation({ ...station, notes })}
          value={station.notes ?? ""}
        />
        <ErrorText>{error}</ErrorText>
        <ActionButton label="Save station" onPress={save} />
      </ScrollView>
    </View>
  );
}

function NullableNumber({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number | null) => void;
  value: number | null;
}) {
  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <FormInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={(text) => onChange(text.trim() ? Number(text) : null)}
        value={value === null ? "" : String(value)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.xs, padding: tokens.spacing.md },
  types: { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.sm },
});
