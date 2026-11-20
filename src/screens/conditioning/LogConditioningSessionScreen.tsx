import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { LogTimeChanger } from "../../components/LogTimeChanger";
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
import {
  combineLocalDateAndTime,
  deviceTimeZone,
  formatLocalDate,
  isLocalDateString,
} from "../../conditioning/dates";
import { messageFromUnknown } from "../../conditioning/validation";
import { logConditioningSession } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep } from "../../utils/feedback";
import type {
  OccurrenceActual,
  PhaseDefinition,
} from "../../conditioning/types";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;
const RPE_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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

  function requestNavigation(destination: () => void) {
    if (saving) return;
    const changed = request && (notes !== request.snapshot.notes || sessionRpe !== "" || Object.keys(actuals).length > 0 || date !== request.date || time.getTime() !== request.time.getTime());
    if (!changed) { destination(); return; }
    workspace.requestConfirm({
      confirmLabel: "Discard",
      message: "This session has unsaved log changes.",
      onConfirm: destination,
      title: "Discard log changes?",
    });
  }

  useEffect(() => {
    workspace.registerBackHandler(() => { requestNavigation(workspace.pop); return true; });
    return () => workspace.registerBackHandler(null);
  });

  if (!request) {
    return (
      <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
        <ScreenHeading title="Log session" />
        <ConditioningFooter />
      </View>
    );
  }

  const workPhases = request.snapshot.phases.filter(
    (phase) => phase.type === "work",
  );
  const activeText = readableTextColor(theme.colors.tertiary);

  async function save(now: number) {
    if (!request || !ownerId || saving) {
      return;
    }
    if (!isLocalDateString(date)) {
      setError("Enter the performed date as YYYY-MM-DD");
      return;
    }
    const performedAt = combineLocalDateAndTime(date, time);
    if (performedAt === null || performedAt > now) {
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
      feedbackConfirm();
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
      <ScreenHeading
        onClose={() => requestNavigation(workspace.closeBranch)}
        title="Log session"
        right={<LogTimeChanger maximumDate={new Date()} value={performedDateTime(date, time)} onChange={(selected) => { setDate(formatLocalDate(selected)); setTime(selected); }} />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Performed Timestamp & Session RPE */}
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
            <FieldLabel>Session RPE (optional)</FieldLabel>
            {sessionRpe.trim() ? (
              <PressOpacity
                accessibilityLabel="Omit session RPE"
                onPress={() => {
                  feedbackStep("down");
                  setSessionRpe("");
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
                  OMIT
                </Text>
              </PressOpacity>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.presetStrip}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {RPE_SCALE.map((rpe) => {
              const selected = Number(sessionRpe) === rpe && sessionRpe.trim().length > 0;
              return (
                <PressOpacity
                  accessibilityLabel={`Set session RPE ${rpe}`}
                  key={rpe}
                  onPress={() => {
                    feedbackStep("up");
                    setSessionRpe(String(rpe));
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
                    RPE {rpe}
                  </Text>
                </PressOpacity>
              );
            })}
          </ScrollView>

          <FormInput
            accessibilityLabel="Session RPE"
            keyboardType="number-pad"
            onChangeText={setSessionRpe}
            placeholder="Omitted (null)"
            value={sessionRpe}
          />

          <FieldLabel>Notes</FieldLabel>
          <FormInput
            accessibilityLabel="Session notes"
            multiline
            onChangeText={setNotes}
            value={notes}
          />
        </View>

        {/* Card-by-Card Work Occurrences */}
        {workPhases.map((phase) => (
          <WorkResult
            key={phase.id}
            onChange={(actual) =>
              setActuals((current) => ({ ...current, [phase.id]: actual }))
            }
            phase={phase}
            value={actuals[phase.id] ?? emptyActual()}
          />
        ))}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <ConditioningFooter disabled={saving} onBack={() => requestNavigation(workspace.pop)}>
        <ActionButton
          disabled={saving}
          label="Save session"
          onPress={() => void save(Date.now())}
        />
      </ConditioningFooter>
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
  const { theme } = useAppTheme();
  const kind = phase.target?.completionType;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <Text style={[styles.phase, { color: theme.colors.text }]}>
        {phase.label}
      </Text>
      {kind === "repetitions" ? (
        <OptionalNumber
          label="Actual reps"
          onChange={(reps) => onChange({ ...value, reps })}
          step={1}
          value={value.reps}
        />
      ) : null}
      {kind === "repetitions" || kind === "distance" ? (
        <OptionalNumber
          label="Actual load kg"
          onChange={(loadKg) => onChange({ ...value, loadKg })}
          step={2}
          value={value.loadKg}
        />
      ) : null}
      {kind === "distance" || kind === "sprint" ? (
        <OptionalNumber
          label="Actual distance m"
          onChange={(distanceMeters) => onChange({ ...value, distanceMeters })}
          step={10}
          value={value.distanceMeters}
        />
      ) : null}
      {kind === "machine_calories" ? (
        <OptionalNumber
          label="Actual machine calories"
          onChange={(machineCalories) =>
            onChange({ ...value, machineCalories })
          }
          step={2}
          value={value.machineCalories}
        />
      ) : null}
    </View>
  );
}

function OptionalNumber({
  label,
  onChange,
  step = 1,
  value,
}: {
  label: string;
  onChange: (value: number | null) => void;
  step?: number;
  value: number | null;
}) {
  const { theme } = useAppTheme();
  if (label.toLowerCase().includes("load")) {
    return <WeightInput label={label} value={value} onChange={onChange} />;
  }
  function adjust(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    const base = value ?? 0;
    const next = Math.max(0, Math.round((base + delta) * 10) / 10);
    onChange(next === 0 ? null : next);
  }

  return (
    <View style={styles.optionalBlock}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.dateRow}>
        <PressOpacity
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => adjust(-step)}
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
            -{step}
          </Text>
        </PressOpacity>
        <FormInput
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          onChangeText={(text) => {
            const trimmed = text.trim();
            onChange(trimmed ? Number(trimmed) : null);
          }}
          placeholder="—"
          style={styles.centerInput}
          value={value === null ? "" : String(value)}
        />
        <PressOpacity
          accessibilityLabel={`Increase ${label}`}
          onPress={() => adjust(step)}
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
            +{step}
          </Text>
        </PressOpacity>
      </View>
    </View>
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

function performedDateTime(date: string, time: Date) {
  const result = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(result.getTime())) return time;
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
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
  dateRow: {
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
    minWidth: 52,
    paddingHorizontal: 8,
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
    minWidth: 58,
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
  phase: {
    fontSize: 15,
    fontWeight: "800",
  },
  optionalBlock: {
    gap: 4,
  },
});
