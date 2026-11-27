import { StyleSheet, Text, View } from "react-native";

import { conditioningActivityModes, conditioningEfforts, type ConditioningActivityMode, type ConditioningObservations } from "../../conditioning/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { PressOpacity } from "../PressOpacity";
import { FieldLabel, FormInput } from "./ConditioningFields";

export type ProtocolDraft = {
  mode?: ConditioningActivityMode;
  test?: string;
  source?: string;
  machine?: string;
  technique?: string;
  distance?: string;
  referenceDate?: string;
  critical?: string;
  sprintBest?: string;
  moderate?: string;
  hard?: string;
  vo2max?: string;
};

const modes = { run: "Running", cycling: "Cycling", assault_bike: "Assault Bike", other: "Other or mixed" };
export const conditioningEffortOptions = conditioningEfforts.map((value, index) => ({
  value,
  label: ["Easy", "Moderate", "Sustained hard", "Repeated effort", "Sprint"][index],
}));

export function optionalObservedNumber(text: string | undefined, label: string): number | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) throw new Error(`${label} needs a nonnegative number`);
  const value = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`${label} needs a finite number`);
  return value;
}

export function conditioningObservationsFromDraft(
  draft: ProtocolDraft, performedDate: string,
): ConditioningObservations | undefined {
  if (!draft.mode) return undefined;
  const { mode } = draft;
  const protocol = {
    mode,
    test: draft.test?.trim() || undefined,
    source: draft.source?.trim() || undefined,
    machine: draft.machine?.trim() || undefined,
    technique: draft.technique?.trim() || undefined,
    distanceMeters: optionalObservedNumber(draft.distance, "Matched sprint distance"),
  };
  const critical = optionalObservedNumber(draft.critical, "Critical reference");
  const sprintBest = optionalObservedNumber(draft.sprintBest, "Prior sprint best");
  const moderate = optionalObservedNumber(draft.moderate, "Moderate threshold");
  const hard = optionalObservedNumber(draft.hard, "Hard threshold");
  const vo2max = optionalObservedNumber(draft.vo2max, "VO₂max");
  const testDate = draft.referenceDate?.trim() ?? "";
  if ([critical, sprintBest, moderate, hard, vo2max].some(value => value !== undefined)) {
    if (!testDate || testDate >= performedDate) throw new Error("Enter an earlier reference test date");
    if (!protocol.test || !protocol.source) throw new Error("Enter the matched test setup and output source");
    if (mode === "assault_bike" && (!protocol.machine || !protocol.technique))
      throw new Error("Assault Bike references need a matching machine and technique");
  }
  if ((moderate === undefined) !== (hard === undefined)) throw new Error("Enter both tested thresholds");
  const unit = mode === "run" ? "m/s" : "W";
  const reference = { protocol, testDate };
  return {
    protocol,
    criticalPower: critical !== undefined && mode !== "run" ? { ...reference, value: critical } : undefined,
    criticalSpeed: critical !== undefined && mode === "run" ? { ...reference, value: critical } : undefined,
    sprintBest: sprintBest !== undefined ? { ...reference, value: sprintBest, unit: mode === "run" ? "s" : "W" } : undefined,
    intensityBounds: moderate !== undefined && hard !== undefined ? { ...reference, unit, moderate, hard } : undefined,
    vo2max: vo2max !== undefined ? { ...reference, value: vo2max } : undefined,
  };
}

export function ConditioningObservationFields({
  value, onChange,
}: { value: ProtocolDraft; onChange: (value: ProtocolDraft) => void }) {
  const running = value.mode === "run";
  const cycling = value.mode === "cycling" || value.mode === "assault_bike";
  const unit = running ? "m/s" : "W";
  const field = (key: keyof Omit<ProtocolDraft, "mode">, label: string, numeric = false) =>
    numeric ? (
      <ObservedNumberField label={label} value={value[key]} onChangeText={(next) => onChange({ ...value, [key]: next })} />
    ) : (
      <View style={styles.field}>
        <FieldLabel>{label}</FieldLabel>
        <FormInput accessibilityLabel={label} maxLength={80} value={value[key] ?? ""}
          onChangeText={(next) => onChange({ ...value, [key]: next })} placeholder="Optional" />
      </View>
    );
  return (
    <View style={styles.field}>
      <FieldLabel>Activity for all work bouts (optional)</FieldLabel>
      <ObservationChoices
        label="Activity"
        options={conditioningActivityModes.map(mode => ({ value: mode, label: modes[mode] }))}
        value={value.mode}
        onChange={mode => onChange({ mode })}
      />
      {running || cycling ? (
        <>
          {field("source", "Output source (timing, meter or console)")}
          {field("test", "Matched test or protocol")}
          {value.mode === "assault_bike" ? <>{field("machine", "Machine identifier")}{field("technique", "Bike technique")}</> : null}
          {running ? field("distance", "Matched sprint distance (m)", true) : null}
          <FieldLabel>Prior compatible test results (optional)</FieldLabel>
          {field("referenceDate", "Test date (YYYY-MM-DD)")}
          {field("critical", running ? "Critical speed (m/s)" : "Critical power (W)", true)}
          {field("moderate", `Moderate threshold (${unit})`, true)}
          {field("hard", `Hard threshold (${unit})`, true)}
          {field("sprintBest", running ? "Best matched sprint split (s)" : "Best matched sprint power (W)", true)}
          {field("vo2max", "Measured VO₂max (mL/kg/min)", true)}
        </>
      ) : null}
    </View>
  );
}

export function ObservationChoices<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.choices}>
      {options.map(option => {
        const selected = value === option.value;
        return (
          <PressOpacity key={option.value} accessibilityRole="button"
            accessibilityLabel={`${label} ${option.label}`}
            accessibilityState={{ selected }} onPress={() => onChange(selected ? undefined : option.value)}
            style={[styles.choice, { borderColor: selected ? theme.colors.tertiary : theme.colors.borderStrong, backgroundColor: theme.colors.surfaceMuted }]}>
            <Text style={{ color: theme.colors.text }}>{option.label}</Text>
          </PressOpacity>
        );
      })}
    </View>
  );
}

export function ObservedNumberField({ label, value, onChangeText }: {
  label: string; value: string | undefined; onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <FormInput accessibilityLabel={label} keyboardType="decimal-pad" maxLength={12}
        onChangeText={onChangeText} placeholder="Optional" value={value ?? ""} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 48, minWidth: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, justifyContent: "center" },
});
