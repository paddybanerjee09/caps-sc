import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import {
  ActionButton,
  ErrorText,
  FieldLabel,
  FormInput,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import {
  combineLocalDateAndTime,
  deviceTimeZone,
  isLocalDateString,
} from "../../conditioning/dates";
import { messageFromUnknown } from "../../conditioning/validation";
import { logConditioningSession } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { OccurrenceActual, PhaseDefinition } from "../../conditioning/types";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function LogConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const request = workspace.logRequest;
  const { db, ownerId } = useConditioningOwner();
  const [date, setDate] = useState(request?.date ?? "");
  const [time, setTime] = useState(request?.time ?? new Date());
  const [notes, setNotes] = useState(request?.snapshot.notes ?? "");
  const [sessionRpe, setSessionRpe] = useState("");
  const [actuals, setActuals] = useState<Record<string, OccurrenceActual>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!request) {
    return (
      <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
        <ScreenHeading onBack={workspace.pop} title="Log session" />
      </View>
    );
  }

  const workPhases = request.snapshot.phases.filter((phase) => phase.type === "work");

  async function save() {
    if (!request || !ownerId || saving) {
      return;
    }
    if (!isLocalDateString(date)) {
      setError("Enter the performed date as YYYY-MM-DD");
      return;
    }
    const performedAt = combineLocalDateAndTime(date, time);
    if (performedAt === null || performedAt > Date.now()) {
      setError("Performed time cannot be in the future");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await logConditioningSession(db, ownerId, {
        finishedAt: performedAt,
        notes,
        occurrences: workPhases.map((phase, index) => ({
          actual: actuals[phase.id] ?? emptyActual(),
          completionMethod: "manual",
          completionStatus: "completed" as const,
          endedAt: performedAt,
          id: phase.occurrenceId ?? phase.id,
          phaseType: "work" as const,
          position: index,
          roundIndex: phase.roundIndex,
          setIndex: phase.setIndex,
          startedAt: performedAt,
          stationId: phase.stationId,
          target: phase.target,
          workSeconds: null,
        })),
        performedAt,
        planSessionId: request.planSessionId,
        sessionRpe: sessionRpe.trim() ? Number(sessionRpe) : null,
        snapshot: request.snapshot,
        templateId: request.templateId,
        timezone: deviceTimeZone(),
      });
      workspace.bumpRevision();
      bumpTimeline();
      workspace.setLogRequest(null);
      workspace.closeEditor();
      workspace.pop();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onBack={workspace.pop} title="Log session" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={{ color: theme.colors.textMuted }}>
          Targets stay separate from what you actually did.
        </Text>
        <FieldLabel>Performed date</FieldLabel>
        <FormInput accessibilityLabel="Performed date" onChangeText={setDate} value={date} />
        <LogTimeChanger
          label="Log time"
          maximumDate={isToday(date) ? new Date() : undefined}
          onChange={setTime}
          value={time}
        />
        <FieldLabel>Notes</FieldLabel>
        <FormInput accessibilityLabel="Session notes" multiline onChangeText={setNotes} value={notes} />
        <FieldLabel>Session RPE (optional)</FieldLabel>
        <FormInput
          accessibilityLabel="Session RPE"
          keyboardType="number-pad"
          onChangeText={setSessionRpe}
          value={sessionRpe}
        />
        {workPhases.map((phase) => (
          <WorkResult
            key={phase.id}
            onChange={(actual) => setActuals((current) => ({ ...current, [phase.id]: actual }))}
            phase={phase}
            value={actuals[phase.id] ?? emptyActual()}
          />
        ))}
        <ErrorText>{error}</ErrorText>
        <ActionButton disabled={saving} label="Save session" onPress={() => void save()} />
      </ScrollView>
    </View>
  );
}

function WorkResult({
  onChange,
  phase,
  value,
}: {
  onChange: (actual: OccurrenceActual) => void;
  phase: PhaseDefinition;
  value: OccurrenceActual;
}) {
  const kind = phase.target?.completionType;
  return (
    <View>
      <Text style={styles.phase}>{phase.label}</Text>
      {kind === "repetitions" ? (
        <OptionalNumber
          label="Actual reps"
          onChange={(reps) => onChange({ ...value, reps })}
          value={value.reps}
        />
      ) : null}
      {kind === "repetitions" || kind === "distance" ? (
        <OptionalNumber
          label="Actual load kg"
          onChange={(loadKg) => onChange({ ...value, loadKg })}
          value={value.loadKg}
        />
      ) : null}
      {kind === "distance" || kind === "sprint" ? (
        <OptionalNumber
          label="Actual distance m"
          onChange={(distanceMeters) => onChange({ ...value, distanceMeters })}
          value={value.distanceMeters}
        />
      ) : null}
      {kind === "machine_calories" ? (
        <OptionalNumber
          label="Actual machine calories"
          onChange={(machineCalories) => onChange({ ...value, machineCalories })}
          value={value.machineCalories}
        />
      ) : null}
    </View>
  );
}

function OptionalNumber({
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
        onChangeText={(text) => {
          const trimmed = text.trim();
          onChange(trimmed ? Number(trimmed) : null);
        }}
        value={value === null ? "" : String(value)}
      />
    </>
  );
}

function emptyActual(): OccurrenceActual {
  return {
    distanceMeters: null,
    loadKg: null,
    machineCalories: null,
    reps: null,
  };
}

function isToday(date: string) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return date === today;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.sm, padding: tokens.spacing.md },
  phase: { fontWeight: "700", marginTop: tokens.spacing.md },
});
