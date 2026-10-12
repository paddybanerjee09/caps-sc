import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import {
  ActionButton,
  ErrorText,
  FieldLabel,
  FormInput,
  MeasurementInput,
} from "../../components/conditioning/ConditioningFields";
import { localTimeFromInstant } from "../../conditioning/dates";
import {
  templateConfigFromDraft,
  type WorkoutDraft,
} from "../../conditioning/drafts";
import {
  buildWorkoutSnapshot,
  circuitTiming,
  intervalDurations,
  PREPARATION_SECONDS,
} from "../../conditioning/phases";
import { formatClock, formatName } from "../../conditioning/summaries";
import { moveStation } from "../../conditioning/validation";
import { messageFromUnknown } from "../../conditioning/validation";
import {
  distanceToMeters,
  metersToDistance,
  metersToElevation,
  elevationToMeters,
  parseFiniteNumber,
} from "../../conditioning/units";
import {
  planConditioningSession,
  saveConditioningTemplate,
  startConditioningSession,
  updatePlannedConditioningSession,
} from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import {
  editorIsDirty,
  useConditioningWorkspace,
} from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { deviceTimeZone } from "../../conditioning/dates";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function CreateConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tablet = width >= 768;
  const { unitSettings, bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const editor = workspace.editor;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = editor?.draft;

  const preview = useMemo(() => {
    if (!draft) {
      return null;
    }
    try {
      return buildWorkoutSnapshot(templateConfigFromDraft(draft));
    } catch (caught) {
      return messageFromUnknown(caught);
    }
  }, [draft]);

  if (!editor || !draft) {
    return null;
  }

  function update(next: WorkoutDraft) {
    workspace.updateEditor(next);
  }

  function requestClose() {
    if (!editorIsDirty(editor)) {
      workspace.closeEditor();
      return;
    }

    workspace.requestConfirm({
      confirmLabel: "Discard",
      message: "This workout has unsaved changes.",
      onConfirm: () => workspace.closeEditor(),
      title: "Discard changes?",
    });
  }

  async function withSnapshot(action: (snapshot: ReturnType<typeof buildWorkoutSnapshot>) => Promise<void>) {
    if (!ownerId || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const snapshot = buildWorkoutSnapshot(templateConfigFromDraft(draft!));
      await action(snapshot);
    } catch (caught) {
      setError(messageFromUnknown(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host]}>
      <View
        style={[
          styles.panel,
          tablet
            ? { height: height * 0.9, maxWidth: 720, width: "92%" }
            : styles.phonePanel,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View style={styles.heading}>
          <ActionButton label="Back" onPress={requestClose} tone="quiet" />
          <Text style={[styles.headingTitle, { color: theme.colors.text }]}>
            {formatName(draft.format)}
          </Text>
          <ActionButton label="X" onPress={requestClose} tone="quiet" />
        </View>
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <FieldLabel>Title</FieldLabel>
          <FormInput
            accessibilityLabel="Workout title"
            maxLength={80}
            onChangeText={(title) => update({ ...draft, title })}
            value={draft.title}
          />
          <FieldLabel>Notes</FieldLabel>
          <FormInput
            accessibilityLabel="Workout notes"
            maxLength={1000}
            multiline
            onChangeText={(notes) => update({ ...draft, notes })}
            value={draft.notes}
          />
          {draft.format === "time_interval" ? (
            <IntervalFields draft={draft} update={update} />
          ) : null}
          {draft.format === "sprint" ? (
            <SprintFields
              distanceSystem={unitSettings.distance}
              draft={draft}
              elevationSystem={unitSettings.height}
              update={update}
            />
          ) : null}
          {draft.format === "circuit" ? (
            <CircuitFields
              draft={draft}
              onEditStation={(stationId) =>
                workspace.push({
                  key: `station-${stationId ?? "new"}-${Date.now()}`,
                  name: "station",
                  stationId,
                })
              }
              update={update}
            />
          ) : null}
          <FieldLabel>Planned date</FieldLabel>
          <FormInput
            accessibilityLabel="Planned date"
            autoCapitalize="none"
            onChangeText={(scheduledDate) => update({ ...draft, scheduledDate })}
            placeholder="YYYY-MM-DD"
            value={draft.scheduledDate}
          />
          {draft.scheduledTime ? (
            <LogTimeChanger
              label="Planned start"
              onChange={(scheduledTime) => update({ ...draft, scheduledTime })}
              value={draft.scheduledTime}
            />
          ) : (
            <ActionButton
              label="Add start time"
              onPress={() => update({ ...draft, scheduledTime: new Date() })}
              tone="secondary"
            />
          )}
          <Preview preview={preview} />
          <ErrorText>{error}</ErrorText>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <ActionButton
            disabled={saving}
            label="Start workout"
            onPress={() =>
              void withSnapshot(async (snapshot) => {
                if (editor.planSessionId) {
                  await updatePlannedConditioningSession(db, ownerId!, editor.planSessionId, {
                    scheduledLocalDate: draft.scheduledDate,
                    scheduledLocalStartTime: draft.scheduledTime
                      ? localTimeFromInstant(draft.scheduledTime.getTime())
                      : null,
                    schedulingTimezone: deviceTimeZone(),
                    snapshot,
                  });
                  const session = await startConditioningSession(db, ownerId!, {
                    performedAt: Date.now(),
                    planSessionId: editor.planSessionId,
                    timezone: deviceTimeZone(),
                  });
                  workspace.closeEditor();
                  workspace.push({
                    key: `runner-${session.id}`,
                    name: "runner",
                    sessionId: session.id,
                  });
                  return;
                }

                const session = await startConditioningSession(db, ownerId!, {
                  performedAt: Date.now(),
                  snapshot,
                  templateId: editor.templateId,
                  timezone: deviceTimeZone(),
                });
                workspace.bumpRevision();
                bumpTimeline();
                workspace.closeEditor();
                workspace.push({
                  key: `runner-${session.id}`,
                  name: "runner",
                  sessionId: session.id,
                });
              })
            }
          />
          <ActionButton
            disabled={saving}
            label="Plan session"
            onPress={() =>
              void withSnapshot(async (snapshot) => {
                const input = {
                  scheduledLocalDate: draft.scheduledDate,
                  scheduledLocalStartTime: draft.scheduledTime
                    ? localTimeFromInstant(draft.scheduledTime.getTime())
                    : null,
                  schedulingTimezone: deviceTimeZone(),
                  snapshot,
                };
                if (editor.planSessionId) {
                  await updatePlannedConditioningSession(
                    db,
                    ownerId!,
                    editor.planSessionId,
                    input,
                  );
                } else {
                  await planConditioningSession(db, ownerId!, {
                    ...input,
                    templateId: editor.templateId,
                  });
                }
                workspace.bumpRevision();
                bumpTimeline();
                workspace.closeEditor();
              })
            }
            tone="secondary"
          />
          <ActionButton
            disabled={saving}
            label="Log session"
            onPress={() =>
              void withSnapshot(async (snapshot) => {
                workspace.setLogRequest({
                  date: draft.scheduledDate,
                  planSessionId: editor.planSessionId,
                  snapshot,
                  templateId: editor.templateId,
                  time: draft.scheduledTime ?? new Date(),
                });
                workspace.push({
                  key: `log-${Date.now()}`,
                  name: "log",
                  planSessionId: editor.planSessionId,
                });
              })
            }
            tone="secondary"
          />
          <ActionButton
            disabled={saving}
            label={editor.templateId ? "Save changes" : "Save workout"}
            onPress={() =>
              void withSnapshot(async () => {
                const saved = await saveConditioningTemplate(
                  db,
                  ownerId!,
                  templateConfigFromDraft(draft),
                  editor.templateId ?? undefined,
                );
                workspace.openEditor({
                  ...editor,
                  draft,
                  savedSnapshot: JSON.stringify(draft),
                  templateId: saved.id,
                });
                workspace.bumpRevision();
              })
            }
            tone="secondary"
          />
        </View>
      </View>
    </View>
  );
}

function IntervalFields({
  draft,
  update,
}: {
  draft: WorkoutDraft;
  update: (draft: WorkoutDraft) => void;
}) {
  return (
    <>
      <NumberField
        label="Work seconds"
        onChange={(workSeconds) => update({ ...draft, workSeconds })}
        value={draft.workSeconds}
      />
      <NumberField
        label="Rest between intervals"
        onChange={(restSeconds) => update({ ...draft, restSeconds })}
        value={draft.restSeconds}
      />
      <NumberField
        label="Intervals per round"
        onChange={(intervalsPerRound) => update({ ...draft, intervalsPerRound })}
        value={draft.intervalsPerRound}
      />
      <NumberField
        label="Rounds"
        onChange={(rounds) => update({ ...draft, rounds })}
        value={draft.rounds}
      />
      <NumberField
        label="Rest between rounds"
        onChange={(betweenRoundRestSeconds) =>
          update({ ...draft, betweenRoundRestSeconds })
        }
        value={draft.betweenRoundRestSeconds}
      />
      <NumberField
        label="Target work RPE"
        onChange={(targetWorkRpe) => update({ ...draft, targetWorkRpe })}
        value={draft.targetWorkRpe}
      />
    </>
  );
}

function SprintFields({
  distanceSystem,
  draft,
  elevationSystem,
  update,
}: {
  distanceSystem: "metric" | "imperial";
  draft: WorkoutDraft;
  elevationSystem: "metric" | "imperial";
  update: (draft: WorkoutDraft) => void;
}) {
  return (
    <>
      <MeasurementInput
        accessibilityLabel="Sprint distance"
        canonical={draft.distanceMeters}
        formatValue={(value) =>
          metersToDistance(value, distanceSystem, "short").toFixed(1)
        }
        label={distanceSystem === "metric" ? "Distance (m)" : "Distance (yd)"}
        onChangeCanonical={(distanceMeters) => update({ ...draft, distanceMeters })}
        parseValue={(text) => parseMeasurement(text, (value) => distanceToMeters(value, distanceSystem, "short"))}
        unitKey={`distance-${distanceSystem}`}
      />
      <NumberField
        label="Sprints per set"
        onChange={(sprintsPerSet) => update({ ...draft, sprintsPerSet })}
        value={draft.sprintsPerSet}
      />
      <NumberField
        label="Sets"
        onChange={(sets) => update({ ...draft, sets })}
        value={draft.sets}
      />
      <NumberField
        label="Rest between sprints"
        onChange={(sprintRestSeconds) => update({ ...draft, sprintRestSeconds })}
        value={draft.sprintRestSeconds}
      />
      <NumberField
        label="Rest between sets"
        onChange={(betweenSetRestSeconds) => update({ ...draft, betweenSetRestSeconds })}
        value={draft.betweenSetRestSeconds}
      />
      <NumberField
        label="Target work RPE (optional)"
        onChange={(sprintTargetRpe) => update({ ...draft, sprintTargetRpe })}
        value={draft.sprintTargetRpe}
      />
      <MeasurementInput
        accessibilityLabel="Target elevation gain"
        canonical={draft.elevationMeters}
        formatValue={(value) => metersToElevation(value, elevationSystem).toFixed(1)}
        label={elevationSystem === "metric" ? "Target elevation gain (m)" : "Target elevation gain (ft)"}
        onChangeCanonical={(elevationMeters) => update({ ...draft, elevationMeters })}
        parseValue={(text) => parseMeasurement(text, (value) => elevationToMeters(value, elevationSystem))}
        unitKey={`elevation-${elevationSystem}`}
      />
      <FieldLabel>Completion</FieldLabel>
      <View style={styles.row}>
        <ActionButton
          label="Manual"
          onPress={() => update({ ...draft, completionMode: "manual" })}
          tone={draft.completionMode === "manual" ? "primary" : "secondary"}
        />
        <ActionButton
          label="GPS distance"
          onPress={() => update({ ...draft, completionMode: "gps_distance" })}
          tone={draft.completionMode === "gps_distance" ? "primary" : "secondary"}
        />
      </View>
    </>
  );
}

function CircuitFields({
  draft,
  onEditStation,
  update,
}: {
  draft: WorkoutDraft;
  onEditStation: (stationId: string | null) => void;
  update: (draft: WorkoutDraft) => void;
}) {
  return (
    <>
      <NumberField
        label="Rounds"
        onChange={(circuitRounds) => update({ ...draft, circuitRounds })}
        value={draft.circuitRounds}
      />
      <NumberField
        label="Rest between rounds"
        onChange={(betweenRoundRestSeconds) =>
          update({ ...draft, betweenRoundRestSeconds })
        }
        value={draft.betweenRoundRestSeconds}
      />
      <NumberField
        label="Circuit target RPE (optional)"
        onChange={(circuitTargetRpe) => update({ ...draft, circuitTargetRpe })}
        value={draft.circuitTargetRpe}
      />
      {draft.stations.map((station, index) => (
        <View key={station.id} style={styles.stationRow}>
          <Text style={styles.stationName}>
            {index + 1}. {station.exerciseName || "Station"}
          </Text>
          <ActionButton label="Up" onPress={() => update({ ...draft, stations: moveStation(draft.stations, index, -1) })} tone="quiet" />
          <ActionButton label="Down" onPress={() => update({ ...draft, stations: moveStation(draft.stations, index, 1) })} tone="quiet" />
          <ActionButton label="Edit" onPress={() => onEditStation(station.id)} tone="secondary" />
          <ActionButton
            label="Delete"
            onPress={() =>
              update({
                ...draft,
                stations: draft.stations
                  .filter((item) => item.id !== station.id)
                  .map((item, position) => ({ ...item, position })),
              })
            }
            tone="quiet"
          />
        </View>
      ))}
      <ActionButton label="Add station" onPress={() => onEditStation(null)} tone="secondary" />
    </>
  );
}

function Preview({ preview }: { preview: ReturnType<typeof buildWorkoutSnapshot> | string | null }) {
  const { theme } = useAppTheme();
  if (!preview) {
    return null;
  }
  if (typeof preview === "string") {
    return <ErrorText>{preview}</ErrorText>;
  }

  const lines = preview.phases.slice(0, 12).map((phase) => phase.label);
  let total = "Duration depends on completion";
  if (preview.interval) {
    const totals = intervalDurations(preview.interval);
    total = `${formatClock(totals.workoutSeconds)} workout plus ${PREPARATION_SECONDS}s preparation`;
  } else if (preview.circuit) {
    const timing = circuitTiming(preview.circuit);
    total = timing.fullyKnown
      ? `${formatClock(timing.knownWorkSeconds + timing.knownRecoverySeconds)} plus ${PREPARATION_SECONDS}s preparation`
      : `${formatClock(timing.knownWorkSeconds)} known work. Remaining time depends on completion.`;
  }

  return (
    <View>
      <Text style={{ color: theme.colors.text, fontWeight: "700", marginTop: 12 }}>{total}</Text>
      {lines.map((line) => (
        <Text key={line} style={{ color: theme.colors.textMuted }}>
          {line}
        </Text>
      ))}
      {preview.phases.length > lines.length ? (
        <Text style={{ color: theme.colors.textMuted }}>
          +{preview.phases.length - lines.length} more phases
        </Text>
      ) : null}
    </View>
  );
}

function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <>
      <FieldLabel>{label}</FieldLabel>
      <FormInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        onChangeText={onChange}
        value={value}
      />
    </>
  );
}

function parseMeasurement(
  text: string,
  convert: (value: number) => number,
) {
  const parsed = parseFiniteNumber(text);
  if (parsed === "empty") {
    return null;
  }
  if (parsed === "invalid" || parsed <= 0) {
    return "invalid" as const;
  }
  return convert(parsed);
}

const styles = StyleSheet.create({
  host: {
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    width: "100%",
  },
  phonePanel: {
    borderRadius: 0,
    flex: 1,
    height: "100%",
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: tokens.spacing.sm,
  },
  headingTitle: {
    flex: 1,
    fontWeight: "700",
    textAlign: "center",
  },
  form: {
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.md,
  },
  footer: {
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  stationRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  stationName: {
    fontWeight: "700",
    width: "100%",
  },
});
