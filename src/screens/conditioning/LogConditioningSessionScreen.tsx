import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import {
  ActionButton, ConditioningFooter, WeightInput, ErrorText, FieldLabel, FormInput, ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import {
  ConditioningObservationFields, ObservationChoices, ObservedNumberField,
  conditioningEffortOptions, conditioningObservationsFromDraft, optionalObservedNumber, type ProtocolDraft,
} from "../../components/conditioning/ConditioningObservationFields";
import { combineLocalDateAndTime, deviceTimeZone, formatLocalDate, isLocalDateString } from "../../conditioning/dates";
import { createId } from "../../conditioning/ids";
import type { ConditioningEffort, OccurrenceInput, PhaseDefinition } from "../../conditioning/types";
import { messageFromUnknown } from "../../conditioning/validation";
import { logConditioningSession } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm } from "../../utils/feedback";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;
const restOptions = [{ label: "Active", value: "active" }, { label: "Passive", value: "passive" }] as const;
type BoutDraft = {
  distance?: string; reps?: string; calories?: string; load?: number | null;
  work?: string; rest?: string; watts?: string; oxygen?: string; oxygenSeconds?: string; restRpe?: string;
  effort?: ConditioningEffort; restType?: "active" | "passive"; skipped?: boolean;
};

function occurrenceFromDraft(phase: PhaseDefinition | null, draft: BoutDraft, index: number, performedAt: number): OccurrenceInput {
  const read = optionalObservedNumber;
  const workSeconds = read(draft.work, "Actual work duration") ?? null;
  const oxygen = read(draft.oxygen, "Measured oxygen uptake");
  const oxygenSeconds = read(draft.oxygenSeconds, "Oxygen measurement duration");
  if ((oxygen === undefined) !== (oxygenSeconds === undefined)) {
    throw new Error("Enter measured oxygen uptake and its matching duration together");
  }
  return {
    actual: {
      distanceMeters: read(draft.distance, "Actual distance") ?? null,
      loadKg: draft.load ?? null,
      machineCalories: read(draft.calories, "Actual machine calories") ?? null,
      reps: read(draft.reps, "Actual repetitions") ?? null,
      effort: draft.effort,
      restSeconds: read(draft.rest, "Rest after bout"),
      restType: draft.restType,
      restRpe: read(draft.restRpe, "Rest effort"),
      watts: read(draft.watts, "Measured power"),
      oxygenUptake: oxygen !== undefined && oxygenSeconds !== undefined
        ? [{ seconds: oxygenSeconds, mlKgMin: oxygen }] : undefined,
    },
    completionMethod: "manual",
    completionStatus: "completed",
    endedAt: performedAt,
    id: phase?.occurrenceId ?? phase?.id ?? createId(),
    phaseType: "work",
    position: index,
    roundIndex: phase?.roundIndex ?? null,
    setIndex: phase?.setIndex ?? null,
    startedAt: performedAt,
    stationId: phase?.stationId ?? null,
    target: phase?.target ?? null,
    workSeconds,
  };
}

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
  const [elapsed, setElapsed] = useState("");
  const [actuals, setActuals] = useState<Record<string, BoutDraft>>({});
  const [protocol, setProtocol] = useState<ProtocolDraft>(() => ({
    mode: request?.snapshot.activityType === "run" ? "run" : request?.snapshot.activityType === "bike" ? "cycling" : undefined,
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  function requestNavigation(destination: () => void) {
    if (pending.current) return;
    const changed = request && (notes !== (request.snapshot.notes ?? "") || sessionRpe !== "" || elapsed !== "" ||
      Object.values(protocol).some(Boolean) && request.snapshot.format !== "free" ||
      Object.keys(actuals).length > 0 || date !== request.date || time.getTime() !== request.time.getTime());
    if (!changed) { destination(); return; }
    workspace.requestConfirm({
      confirmLabel: "Discard", message: "This session has unsaved log changes.",
      onConfirm: destination, title: "Discard log changes?",
    });
  }

  useEffect(() => {
    workspace.registerBackHandler(() => { requestNavigation(workspace.pop); return true; });
    return () => workspace.registerBackHandler(null);
  });

  if (!request) return null;

  const free = request.snapshot.format === "free";
  const workPhases = request.snapshot.phases.filter(phase => phase.type === "work");
  const fields = free ? [null] : workPhases;

  async function save(now: number) {
    if (!request || !ownerId || pending.current) return;
    if (!isLocalDateString(date)) { setError("Choose a valid performed date."); return; }
    const performedAt = combineLocalDateAndTime(date, time);
    if (performedAt === null || performedAt > now) { setError("Performed time cannot be in the future"); return; }
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const occurrences = fields.flatMap((phase, index) => {
        const draft = actuals[phase?.id ?? "free"];
        if (draft?.skipped || phase === null && !draft) return [];
        return [occurrenceFromDraft(phase, draft ?? {}, index, performedAt)];
      });
      if (!free && workPhases.length && !occurrences.length) throw new Error("Log at least one completed work bout");
      const elapsedSeconds = optionalObservedNumber(elapsed, "Completed session duration");
      const knownDuration = occurrences.length && occurrences.every((bout, index) => bout.workSeconds !== null &&
        (index === occurrences.length - 1 || bout.actual?.restSeconds !== undefined))
        ? occurrences.reduce((sum, bout, index) =>
          sum + bout.workSeconds! + (index === occurrences.length - 1 ? 0 : bout.actual!.restSeconds!), 0)
        : null;
      if (elapsedSeconds !== undefined && knownDuration !== null && elapsedSeconds < knownDuration) {
        throw new Error("Completed session duration must cover the logged work and rest");
      }
      const observations = conditioningObservationsFromDraft(protocol, date);
      await logConditioningSession(db, ownerId, {
        finishedAt: performedAt,
        notes,
        occurrences,
        metrics: { elapsedSeconds: elapsedSeconds ?? knownDuration, distanceMeters: free ? occurrences[0]?.actual?.distanceMeters ?? null : null },
        performedAt,
        planSessionId: request.planSessionId,
        sessionRpe: optionalObservedNumber(sessionRpe, "Session RPE") ?? null,
        snapshot: { ...request.snapshot, conditioningObservations: observations },
        status: !free && occurrences.length < workPhases.length ? "ended_early" : "completed",
        templateId: request.templateId,
        timezone: deviceTimeZone(),
      });
      feedbackConfirm();
      workspace.bumpRevision();
      bumpTimeline();
      workspace.setLogRequest(null);
      workspace.closeEditor();
      workspace.pop();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const card = [styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }];
  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onClose={() => requestNavigation(workspace.closeBranch)} title="Log session"
        right={<LogTimeChanger maximumDate={new Date()} value={performedDateTime(date, time)}
          onChange={selected => { setDate(formatLocalDate(selected)); setTime(selected); }} />} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={card}>
          <ObservedNumberField label="Completed session duration (s)" value={elapsed} onChangeText={setElapsed} />
          <ObservedNumberField label="Session RPE (1–10)" value={sessionRpe} onChangeText={setSessionRpe} />
          <FieldLabel>Notes</FieldLabel>
          <FormInput accessibilityLabel="Session notes" multiline onChangeText={setNotes} value={notes} />
        </View>
        <View style={card}>
          <ConditioningObservationFields value={protocol} onChange={setProtocol} />
        </View>
        {fields.map((phase, index) => {
          const key = phase?.id ?? "free";
          return <View key={key} style={card}>
            <WorkResult phase={phase} last={index === fields.length - 1} protocol={protocol} value={actuals[key] ?? {}}
              onChange={next => setActuals(current => ({ ...current, [key]: next }))} />
          </View>;
        })}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <ConditioningFooter disabled={saving} onBack={() => requestNavigation(workspace.pop)}>
        <ActionButton disabled={saving} label="Save session" onPress={() => void save(Date.now())} />
      </ConditioningFooter>
    </View>
  );
}

function WorkResult({ onChange, phase, value, protocol, last }: {
  onChange: (value: BoutDraft) => void;
  phase: PhaseDefinition | null;
  value: BoutDraft;
  protocol: ProtocolDraft;
  last: boolean;
}) {
  const { theme } = useAppTheme();
  const kind = phase?.target?.completionType;
  function field(key: "work" | "rest" | "distance" | "reps" | "calories" | "watts" | "oxygen" | "oxygenSeconds" | "restRpe", label: string) {
    return <ObservedNumberField label={label} value={value[key]} onChangeText={next => onChange({ ...value, [key]: next })} />;
  }
  return <>
    <Text accessibilityRole="header" style={[styles.phase, { color: theme.colors.text }]}>
      {phase?.label ?? "Recorded work"}
    </Text>
    {phase ? <ObservationChoices label="Bout status" options={[{ label: "Skipped", value: "skipped" }]}
      value={value.skipped ? "skipped" : undefined} onChange={next => onChange({ ...value, skipped: !!next })} /> : null}
    {!value.skipped ? <>
      {field("work", "Actual work (s)")}
      {kind === "repetitions" ? field("reps", "Actual reps") : null}
      {kind === "repetitions" || kind === "distance" ? <WeightInput label="Actual load" value={value.load ?? null} onChange={load => onChange({ ...value, load })} /> : null}
      {kind === "distance" || kind === "sprint" || !phase || protocol.mode === "run" ? field("distance", "Actual distance (m)") : null}
      {kind === "machine_calories" ? field("calories", "Actual machine calories") : null}
      {protocol.mode === "cycling" || protocol.mode === "assault_bike" ? field("watts", "Measured work power (W)") : null}
      {protocol.vo2max ? <>
        {field("oxygen", "Measured oxygen uptake (mL/kg/min)")}
        {field("oxygenSeconds", "Duration at this measured uptake (s)")}
      </> : null}
      <FieldLabel>Observed effort (optional)</FieldLabel>
      <ObservationChoices label="Observed effort" options={conditioningEffortOptions} value={value.effort} onChange={effort => onChange({ ...value, effort })} />
      {!last ? <>
        {field("rest", "Actual rest after bout (s)")}
        <ObservationChoices label="Rest type" options={[...restOptions]} value={value.restType} onChange={restType => onChange({ ...value, restType })} />
        {field("restRpe", "Observed rest effort (0–10)")}
      </> : null}
    </> : null}
  </>;
}

function performedDateTime(date: string, time: Date) {
  const result = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(result.getTime())) return time;
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md, paddingBottom: tokens.spacing.xxl },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.sm, padding: tokens.spacing.lg },
  phase: { fontSize: 15, fontWeight: "800" },
});
