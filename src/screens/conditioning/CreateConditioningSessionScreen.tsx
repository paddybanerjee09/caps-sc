import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import { EstimatedFocusButton } from "../../components/training/EstimatedFocusButton";
import { TrainingNumberField } from "../../components/training/TrainingNumberField";
import { ActionButton, ConditioningFooter, ScreenHeading, ErrorText, FieldLabel, FormInput } from "../../components/conditioning/ConditioningFields";
import { deviceTimeZone, formatLocalDate, localTimeFromInstant } from "../../conditioning/dates";
import { templateConfigFromDraft, type WorkoutDraft } from "../../conditioning/drafts";
import { emphasisColors, emphasisLabels, estimateSnapshotEmphasis } from "../../conditioning/emphasis";
import { buildWorkoutSnapshot } from "../../conditioning/phases";
import { formatName } from "../../conditioning/summaries";
import { distanceToMeters, elevationToMeters, metersToDistance, metersToElevation, parseFiniteNumber } from "../../conditioning/units";
import { messageFromUnknown, moveStation } from "../../conditioning/validation";
import { planConditioningSession, saveConditioningTemplate, startConditioningSession, updatePlannedConditioningSession } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { editorIsDirty, useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackConfirm } from "../../utils/feedback";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function CreateConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const tablet = width >= 768;
  const { unitSettings, bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const editor = workspace.editor;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const draft = editor?.draft;

  const focus = useMemo(() => {
    if (!draft) return null;
    try {
      return estimateSnapshotEmphasis(buildWorkoutSnapshot(templateConfigFromDraft(draft)), null, "target_preview");
    } catch {
      return null;
    }
  }, [draft]);

  function requestClose() {
    if (pending.current || !editor) return;
    if (!editorIsDirty(editor)) { workspace.closeEditor(); return; }
    workspace.requestConfirm({ confirmLabel: "Discard", message: "This workout has unsaved changes.", onConfirm: workspace.closeEditor, title: "Discard changes?" });
  }

  useEffect(() => {
    const top = workspace.stack.at(-1);
    if (top?.name === "station" || top?.name === "log" || top?.name === "emphasis") return;
    workspace.registerBackHandler(() => { requestClose(); return true; });
    return () => workspace.registerBackHandler(null);
  });

  if (!editor || !draft) return null;

  function update(next: WorkoutDraft) {
    if (pending.current) return;
    setError(null);
    workspace.updateEditor(next);
  }

  async function withSnapshot(action: (snapshot: ReturnType<typeof buildWorkoutSnapshot>) => Promise<void>) {
    if (!ownerId || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      const snapshot = buildWorkoutSnapshot(templateConfigFromDraft(draft!));
      await action(snapshot);
      feedbackConfirm();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const primary = focus?.labels.primary ?? null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host, tablet && { backgroundColor: theme.colors.overlay }]}>
      <View style={[styles.panel, tablet ? { borderColor: theme.colors.borderStrong, borderWidth: 1, height: height * 0.9, maxWidth: 720, width: "92%" } : styles.phonePanel, { backgroundColor: theme.colors.background }]}>
        <ScreenHeading onClose={() => { if (!pending.current) workspace.closeBranch(); }} title={formatName(draft.format)} right={<View pointerEvents={saving ? "none" : "auto"}><LogTimeChanger label="Planned start" value={plannedDateTime(draft)} onChange={(scheduledTime) => update({ ...draft, scheduledDate: formatLocalDate(scheduledTime), scheduledTime })} /></View>} />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" pointerEvents={saving ? "none" : "auto"}>
          {draft.format !== "time_interval" ? (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
              <FieldLabel>Title</FieldLabel>
              <FormInput accessibilityLabel="Workout title" maxLength={80} onChangeText={(title) => update({ ...draft, title })} value={draft.title} />
              <FieldLabel>Notes</FieldLabel>
              <FormInput accessibilityLabel="Workout notes" maxLength={1000} multiline onChangeText={(notes) => update({ ...draft, notes })} placeholder="Optional" value={draft.notes} />
            </View>
          ) : null}
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]}>
            <Text accessibilityRole="header" style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>PARAMETERS</Text>
            {draft.format === "time_interval" ? <IntervalFields draft={draft} update={update} /> : null}
            {draft.format === "sprint" ? <SprintFields distanceSystem={unitSettings.distance} elevationSystem={unitSettings.height} draft={draft} update={update} /> : null}
            {draft.format === "circuit" ? <CircuitFields draft={draft} update={update} onEditStation={(stationId) => workspace.push({ key: `station-${stationId ?? "new"}-${Date.now()}`, name: "station", stationId })} /> : null}
          </View>
          <EstimatedFocusButton value={primary ? emphasisLabels[primary] : "Not enough evidence"} color={primary ? emphasisColors[primary] : theme.colors.textMuted} disabled={saving} onPress={() => workspace.push({ key: `emphasis-draft-${Date.now()}`, name: "emphasis", sessionId: null })} />
          <ErrorText>{error}</ErrorText>
        </ScrollView>
        <ConditioningFooter disabled={saving} onBack={requestClose}>
          <View style={{ flex: 1, gap: 8 }}>
          <ActionButton
            disabled={saving}
            label="Start workout"
            onPress={() =>
              void withSnapshot(async (snapshot) => {
                if (editor.planSessionId) {
                  await updatePlannedConditioningSession(
                    db,
                    ownerId!,
                    editor.planSessionId,
                    {
                      scheduledLocalDate: draft.scheduledDate,
                      scheduledLocalStartTime: draft.scheduledTime
                        ? localTimeFromInstant(draft.scheduledTime.getTime())
                        : null,
                      schedulingTimezone: deviceTimeZone(),
                      snapshot,
                    },
                  );
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

          <View style={styles.footerGrid}>
            <View style={styles.footerCell}>
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
            </View>
            <View style={styles.footerCell}>
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
            </View>
          </View>

          <View style={styles.footerGrid}>
            <View style={styles.footerCell}>
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
        </ConditioningFooter>
      </View>
    </View>
  );
}

function plannedDateTime(draft: WorkoutDraft) {
  const result = new Date(`${draft.scheduledDate}T12:00:00`);
  const time = draft.scheduledTime ?? new Date();
  if (!Number.isFinite(result.getTime())) return time;
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

function IntervalFields({ draft, update }: { draft: WorkoutDraft; update: (draft: WorkoutDraft) => void }) {
  return (
    <View style={styles.grid}>
      <TrainingNumberField label="Work (s)" value={draft.workSeconds} onChangeText={(workSeconds) => update({ ...draft, workSeconds })} maxLength={8} />
      <TrainingNumberField label="Rest (s)" value={draft.restSeconds} onChangeText={(restSeconds) => update({ ...draft, restSeconds })} maxLength={8} />
      <TrainingNumberField label="Intervals" value={draft.intervalsPerRound} onChangeText={(intervalsPerRound) => update({ ...draft, intervalsPerRound })} maxLength={4} />
      <TrainingNumberField label="Rounds" value={draft.rounds} onChangeText={(rounds) => update({ ...draft, rounds })} maxLength={4} />
      <TrainingNumberField label="Rest between rounds (s)" value={draft.betweenRoundRestSeconds} onChangeText={(betweenRoundRestSeconds) => update({ ...draft, betweenRoundRestSeconds })} maxLength={8} />
      <TrainingNumberField label="Target RPE" value={draft.targetWorkRpe} onChangeText={(targetWorkRpe) => update({ ...draft, targetWorkRpe })} maxLength={2} />
    </View>
  );
}

function SprintFields({ distanceSystem, draft, elevationSystem, update }: {
  distanceSystem: "metric" | "imperial";
  draft: WorkoutDraft;
  elevationSystem: "metric" | "imperial";
  update: (draft: WorkoutDraft) => void;
}) {
  return (
    <View style={styles.fieldsColumn}>
      <MeasurementField label={distanceSystem === "metric" ? "Sprint distance (m)" : "Sprint distance (yd)"} canonical={draft.distanceMeters} formatValue={(value) => metersToDistance(value, distanceSystem, "short").toFixed(1)} parseValue={(text) => parseMeasurement(text, (value) => distanceToMeters(value, distanceSystem, "short"))} onChangeCanonical={(distanceMeters) => update({ ...draft, distanceMeters })} />
      <View style={styles.grid}>
        <TrainingNumberField label="Sprints per set" value={draft.sprintsPerSet} onChangeText={(sprintsPerSet) => update({ ...draft, sprintsPerSet })} maxLength={4} />
        <TrainingNumberField label="Sets" value={draft.sets} onChangeText={(sets) => update({ ...draft, sets })} maxLength={4} />
        <TrainingNumberField label="Rest between sprints (s)" value={draft.sprintRestSeconds} onChangeText={(sprintRestSeconds) => update({ ...draft, sprintRestSeconds })} maxLength={8} />
        <TrainingNumberField label="Rest between sets (s)" value={draft.betweenSetRestSeconds} onChangeText={(betweenSetRestSeconds) => update({ ...draft, betweenSetRestSeconds })} maxLength={8} />
        <TrainingNumberField label="Target RPE" value={draft.sprintTargetRpe} onChangeText={(sprintTargetRpe) => update({ ...draft, sprintTargetRpe })} placeholder="Optional" maxLength={2} />
      </View>
      <MeasurementField label={elevationSystem === "metric" ? "Elevation gain (m)" : "Elevation gain (ft)"} canonical={draft.elevationMeters} formatValue={(value) => metersToElevation(value, elevationSystem).toFixed(1)} parseValue={(text) => parseMeasurement(text, (value) => elevationToMeters(value, elevationSystem))} onChangeCanonical={(elevationMeters) => update({ ...draft, elevationMeters })} />
      <FieldLabel>Completion Mode</FieldLabel>
      <View style={styles.row}><ActionButton label="Manual" onPress={() => update({ ...draft, completionMode: "manual" })} tone={draft.completionMode === "manual" ? "primary" : "secondary"} /><ActionButton label="GPS distance" onPress={() => update({ ...draft, completionMode: "gps_distance" })} tone={draft.completionMode === "gps_distance" ? "primary" : "secondary"} /></View>
    </View>
  );
}

function CircuitFields({ draft, onEditStation, update }: { draft: WorkoutDraft; onEditStation: (stationId: string | null) => void; update: (draft: WorkoutDraft) => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.fieldsColumn}>
      <View style={styles.grid}>
        <TrainingNumberField label="Rounds" value={draft.circuitRounds} onChangeText={(circuitRounds) => update({ ...draft, circuitRounds })} maxLength={4} />
        <TrainingNumberField label="Rest between rounds (s)" value={draft.betweenRoundRestSeconds} onChangeText={(betweenRoundRestSeconds) => update({ ...draft, betweenRoundRestSeconds })} maxLength={8} />
        <TrainingNumberField label="Target RPE" value={draft.circuitTargetRpe} onChangeText={(circuitTargetRpe) => update({ ...draft, circuitTargetRpe })} placeholder="Optional" maxLength={2} />
      </View>
      <FieldLabel>{`Stations (${draft.stations.length})`}</FieldLabel>
      {draft.stations.map((station, index) => (
        <View key={station.id} style={[styles.stationCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
          <Text style={[styles.stationName, { color: theme.colors.text }]}>{index + 1}. {station.exerciseName || "Station"}</Text>
          <View style={styles.stationActionRow}>
            <ActionButton label="Up" onPress={() => update({ ...draft, stations: moveStation(draft.stations, index, -1) })} tone="quiet" />
            <ActionButton label="Down" onPress={() => update({ ...draft, stations: moveStation(draft.stations, index, 1) })} tone="quiet" />
            <ActionButton label="Edit" onPress={() => onEditStation(station.id)} tone="secondary" />
            <ActionButton label="Delete" onPress={() => update({ ...draft, stations: draft.stations.filter((item) => item.id !== station.id).map((item, position) => ({ ...item, position })) })} tone="quiet" />
          </View>
        </View>
      ))}
      <ActionButton label="Add station" onPress={() => onEditStation(null)} tone="secondary" />
    </View>
  );
}

function MeasurementField({ canonical, formatValue, label, onChangeCanonical, parseValue }: {
  canonical: number | null;
  formatValue: (value: number) => string;
  label: string;
  onChangeCanonical: (value: number | null) => void;
  parseValue: (text: string) => number | null | "invalid";
}) {
  const [focused, setFocused] = useState(false);
  const display = canonical == null ? "" : formatValue(canonical);
  const [text, setText] = useState(display);
  return (
    <View style={styles.fieldsColumn}>
      <FieldLabel>{label}</FieldLabel>
      <FormInput accessibilityLabel={label} keyboardType="decimal-pad" onFocus={() => { setFocused(true); setText(display); }} onBlur={() => setFocused(false)} onChangeText={(next) => {
        if (!/^\d*(?:[.,]\d*)?$/.test(next)) return;
        setText(next);
        const parsed = parseValue(next.replace(",", "."));
        onChangeCanonical(parsed === "invalid" ? null : parsed);
      }} value={focused ? text : display} placeholder="--" />
    </View>
  );
}

function parseMeasurement(text: string, convert: (value: number) => number) {
  const parsed = parseFiniteNumber(text);
  if (parsed === "empty") return null;
  if (parsed === "invalid" || parsed < 0) return "invalid" as const;
  return convert(parsed);
}

const styles = StyleSheet.create({
  host: { alignItems: "center", justifyContent: "center" },
  panel: { borderRadius: tokens.radius.lg, overflow: "hidden", width: "100%" },
  phonePanel: { borderRadius: 0, flex: 1, height: "100%" },
  form: { gap: tokens.spacing.md, padding: tokens.spacing.md, paddingBottom: tokens.spacing.xl },
  card: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.spacing.md, padding: tokens.spacing.lg },
  cardHeaderLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldsColumn: { gap: tokens.spacing.md },
  row: { flexDirection: "row", gap: tokens.spacing.sm },
  stationCard: { borderRadius: tokens.radius.md, borderWidth: 1, gap: tokens.spacing.sm, padding: tokens.spacing.md },
  stationName: { fontSize: 15, fontWeight: "800" },
  stationActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footerGrid: { flexDirection: "row", gap: 6 },
  footerCell: { flex: 1 },
});
