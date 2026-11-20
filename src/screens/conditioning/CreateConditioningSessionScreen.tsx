import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { LogTimeChanger } from "../../components/LogTimeChanger";
import { PressOpacity } from "../../components/PressOpacity";
import {
  ActionButton,
  ConditioningFooter,
  ScreenHeading,
  ErrorText,
  FieldLabel,
  FormInput,
  MeasurementInput,
} from "../../components/conditioning/ConditioningFields";
import {
  deviceTimeZone,
  formatLocalDate,
  localTimeFromInstant,
} from "../../conditioning/dates";
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
import {
  distanceToMeters,
  elevationToMeters,
  metersToDistance,
  metersToElevation,
  parseFiniteNumber,
} from "../../conditioning/units";
import { messageFromUnknown, moveStation } from "../../conditioning/validation";
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
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackConfirm, feedbackStep } from "../../utils/feedback";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

const TITLE_PRESETS: Record<WorkoutDraft["format"], readonly string[]> = {
  time_interval: [
    "Fight Rounds 3x3m",
    "Tabata 20/10",
    "Alactic Repeats",
    "Threshold Intervals",
    "Shark Tank Rounds",
  ],
  sprint: [
    "Track 100m Sprints",
    "Hill Sprints",
    "Repeat 200s",
    "400m Glycolytic",
    "Shuttle Bursts",
  ],
  circuit: [
    "Fight Camp Circuit",
    "Grappling Circuit",
    "MetCon Engine",
    "5-Station Conditioning",
    "Recovery Flush",
  ],
};

const DURATION_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300] as const;
const REST_PRESETS = [0, 10, 15, 30, 45, 60, 90, 120, 180] as const;
const COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const;
const RPE_PRESETS = [5, 6, 7, 8, 9, 10] as const;

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

  async function withSnapshot(
    action: (snapshot: ReturnType<typeof buildWorkoutSnapshot>) => Promise<void>,
  ) {
    if (!ownerId || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const snapshot = buildWorkoutSnapshot(templateConfigFromDraft(draft!));
      await action(snapshot);
      feedbackConfirm();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    } finally {
      setSaving(false);
    }
  }

  const activeText = readableTextColor(theme.colors.tertiary);

  return (
    <View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        styles.host,
        tablet && { backgroundColor: theme.colors.overlay },
      ]}
    >
      <View
        style={[
          styles.panel,
          tablet
            ? {
                borderColor: theme.colors.borderStrong,
                borderWidth: 1,
                height: height * 0.9,
                maxWidth: 720,
                width: "92%",
              }
            : styles.phonePanel,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ScreenHeading
          onClose={workspace.closeBranch}
          title={formatName(draft.format)}
          right={
            <LogTimeChanger
              label="Planned start"
              value={plannedDateTime(draft)}
              onChange={(scheduledTime) => update({ ...draft, scheduledDate: formatLocalDate(scheduledTime), scheduledTime })}
            />
          }
        />

        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Card 1: Session Identity & Presets */}
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
                WORKOUT IDENTITY
              </Text>
              <Text style={[styles.cardBadge, { color: theme.colors.tertiary }]}>
                {formatName(draft.format).toUpperCase()}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.presetStrip}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {TITLE_PRESETS[draft.format].map((preset) => {
                const selected = draft.title === preset;
                return (
                  <PressOpacity
                    accessibilityLabel={`Use title ${preset}`}
                    key={preset}
                    onPress={() => {
                      feedbackStep("up");
                      update({ ...draft, title: preset });
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

            <FieldLabel>Title</FieldLabel>
            <FormInput
              accessibilityLabel="Workout title"
              maxLength={80}
              onChangeText={(title) => update({ ...draft, title })}
              value={draft.title}
            />
            <FieldLabel>Notes (optional)</FieldLabel>
            <FormInput
              accessibilityLabel="Workout notes"
              maxLength={1000}
              multiline
              onChangeText={(notes) => update({ ...draft, notes })}
              placeholder="Cues, pacing, or equipment notes"
              value={draft.notes}
            />
          </View>

          {/* Card 2: Format-Specific Stepper Controls */}
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
                {draft.format === "time_interval"
                  ? "INTERVAL & ROUND PARAMETERS"
                  : draft.format === "sprint"
                    ? "SPRINT & SET PARAMETERS"
                    : "CIRCUIT & STATION PARAMETERS"}
              </Text>
              <Text style={[styles.cardBadge, { color: theme.colors.textMuted }]}>
                STEPPERS & PRESETS
              </Text>
            </View>

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
          </View>

          {/* Card 4: Live Phase Preview */}
          <Preview preview={preview} />
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
                label="Emphasis"
                onPress={() =>
                  workspace.push({
                    key: `emphasis-draft-${Date.now()}`,
                    name: "emphasis",
                    sessionId: null,
                  })
                }
                tone="quiet"
              />
            </View>
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

function IntervalFields({
  draft,
  update,
}: {
  draft: WorkoutDraft;
  update: (draft: WorkoutDraft) => void;
}) {
  return (
    <View style={styles.fieldsColumn}>
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Work seconds"
        minimum={5}
        onChange={(workSeconds) => update({ ...draft, workSeconds })}
        presets={DURATION_PRESETS}
        unitSuffix="s"
        value={draft.workSeconds}
      />
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Rest between intervals"
        minimum={0}
        onChange={(restSeconds) => update({ ...draft, restSeconds })}
        presets={REST_PRESETS}
        unitSuffix="s"
        value={draft.restSeconds}
      />
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Intervals per round"
        minimum={1}
        onChange={(intervalsPerRound) =>
          update({ ...draft, intervalsPerRound })
        }
        presets={COUNT_PRESETS}
        unitSuffix="x"
        value={draft.intervalsPerRound}
      />
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Rounds"
        minimum={1}
        onChange={(rounds) => update({ ...draft, rounds })}
        presets={COUNT_PRESETS}
        unitSuffix="rds"
        value={draft.rounds}
      />
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Rest between rounds"
        minimum={0}
        onChange={(betweenRoundRestSeconds) =>
          update({ ...draft, betweenRoundRestSeconds })
        }
        presets={REST_PRESETS}
        unitSuffix="s"
        value={draft.betweenRoundRestSeconds}
      />
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Target work RPE"
        maximum={10}
        minimum={1}
        onChange={(targetWorkRpe) => update({ ...draft, targetWorkRpe })}
        presets={RPE_PRESETS}
        unitSuffix="/10"
        value={draft.targetWorkRpe}
      />
    </View>
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
    <View style={styles.fieldsColumn}>
      <MeasurementInput
        accessibilityLabel="Sprint distance"
        canonical={draft.distanceMeters}
        formatValue={(value) =>
          metersToDistance(value, distanceSystem, "short").toFixed(1)
        }
        label={distanceSystem === "metric" ? "Distance (m)" : "Distance (yd)"}
        onChangeCanonical={(distanceMeters) =>
          update({ ...draft, distanceMeters })
        }
        parseValue={(text) =>
          parseMeasurement(text, (value) =>
            distanceToMeters(value, distanceSystem, "short"),
          )
        }
        presets={[40, 60, 100, 200, 400, 800]}
        stepAmount={10}
        unitKey={`distance-${distanceSystem}`}
      />
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Sprints per set"
        minimum={1}
        onChange={(sprintsPerSet) => update({ ...draft, sprintsPerSet })}
        presets={COUNT_PRESETS}
        unitSuffix="x"
        value={draft.sprintsPerSet}
      />
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Sets"
        minimum={1}
        onChange={(sets) => update({ ...draft, sets })}
        presets={COUNT_PRESETS}
        unitSuffix="sets"
        value={draft.sets}
      />
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Rest between sprints"
        minimum={0}
        onChange={(sprintRestSeconds) =>
          update({ ...draft, sprintRestSeconds })
        }
        presets={REST_PRESETS}
        unitSuffix="s"
        value={draft.sprintRestSeconds}
      />
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Rest between sets"
        minimum={0}
        onChange={(betweenSetRestSeconds) =>
          update({ ...draft, betweenSetRestSeconds })
        }
        presets={REST_PRESETS}
        unitSuffix="s"
        value={draft.betweenSetRestSeconds}
      />
      <StepperNumberField
        allowEmpty
        coarseStep={2}
        fineStep={1}
        label="Target work RPE (optional)"
        maximum={10}
        minimum={1}
        onChange={(sprintTargetRpe) => update({ ...draft, sprintTargetRpe })}
        presets={RPE_PRESETS}
        unitSuffix="/10"
        value={draft.sprintTargetRpe}
      />
      <MeasurementInput
        accessibilityLabel="Target elevation gain"
        canonical={draft.elevationMeters}
        formatValue={(value) =>
          metersToElevation(value, elevationSystem).toFixed(1)
        }
        label={
          elevationSystem === "metric"
            ? "Target elevation gain (m)"
            : "Target elevation gain (ft)"
        }
        onChangeCanonical={(elevationMeters) =>
          update({ ...draft, elevationMeters })
        }
        parseValue={(text) =>
          parseMeasurement(text, (value) =>
            elevationToMeters(value, elevationSystem),
          )
        }
        presets={[5, 10, 20, 30, 50, 100]}
        stepAmount={5}
        unitKey={`elevation-${elevationSystem}`}
      />
      <FieldLabel>Completion Mode</FieldLabel>
      <View style={styles.row}>
        <View style={styles.footerCell}>
          <ActionButton
            label="Manual"
            onPress={() => update({ ...draft, completionMode: "manual" })}
            tone={draft.completionMode === "manual" ? "primary" : "secondary"}
          />
        </View>
        <View style={styles.footerCell}>
          <ActionButton
            label="GPS distance"
            onPress={() => update({ ...draft, completionMode: "gps_distance" })}
            tone={
              draft.completionMode === "gps_distance" ? "primary" : "secondary"
            }
          />
        </View>
      </View>
    </View>
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
  const { theme } = useAppTheme();
  return (
    <View style={styles.fieldsColumn}>
      <StepperNumberField
        coarseStep={2}
        fineStep={1}
        label="Rounds"
        minimum={1}
        onChange={(circuitRounds) => update({ ...draft, circuitRounds })}
        presets={COUNT_PRESETS}
        unitSuffix="rds"
        value={draft.circuitRounds}
      />
      <StepperNumberField
        coarseStep={15}
        fineStep={5}
        label="Rest between rounds"
        minimum={0}
        onChange={(betweenRoundRestSeconds) =>
          update({ ...draft, betweenRoundRestSeconds })
        }
        presets={REST_PRESETS}
        unitSuffix="s"
        value={draft.betweenRoundRestSeconds}
      />
      <StepperNumberField
        allowEmpty
        coarseStep={2}
        fineStep={1}
        label="Circuit target RPE (optional)"
        maximum={10}
        minimum={1}
        onChange={(circuitTargetRpe) => update({ ...draft, circuitTargetRpe })}
        presets={RPE_PRESETS}
        unitSuffix="/10"
        value={draft.circuitTargetRpe}
      />

      <FieldLabel>{`Stations (${draft.stations.length})`}</FieldLabel>
      {draft.stations.map((station, index) => (
        <View
          key={station.id}
          style={[
            styles.stationCard,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.stationTopRow}>
            <Text style={[styles.stationName, { color: theme.colors.text }]}>
              {index + 1}. {station.exerciseName || "Station"}
            </Text>
            <Text style={[styles.stationMeta, { color: theme.colors.tertiary }]}>
              {station.completionType.replaceAll("_", " ").toUpperCase()}
            </Text>
          </View>
          <View style={styles.stationActionRow}>
            <ActionButton
              label="Up"
              onPress={() =>
                update({
                  ...draft,
                  stations: moveStation(draft.stations, index, -1),
                })
              }
              tone="quiet"
            />
            <ActionButton
              label="Down"
              onPress={() =>
                update({
                  ...draft,
                  stations: moveStation(draft.stations, index, 1),
                })
              }
              tone="quiet"
            />
            <ActionButton
              label="Edit"
              onPress={() => onEditStation(station.id)}
              tone="secondary"
            />
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
        </View>
      ))}
      <ActionButton
        label="Add station"
        onPress={() => onEditStation(null)}
        tone="secondary"
      />
    </View>
  );
}

function StepperNumberField({
  allowEmpty = false,
  coarseStep = 10,
  fineStep = 1,
  label,
  maximum = 3600,
  minimum = 0,
  onChange,
  presets,
  unitSuffix = "",
  value,
}: {
  allowEmpty?: boolean;
  coarseStep?: number;
  fineStep?: number;
  label: string;
  maximum?: number;
  minimum?: number;
  onChange: (value: string) => void;
  presets: readonly number[];
  unitSuffix?: string;
  value: string;
}) {
  const { theme } = useAppTheme();
  const numeric = Number(value);
  const hasValidNumber = value.trim().length > 0 && Number.isFinite(numeric);
  const activeText = readableTextColor(theme.colors.tertiary);

  function step(delta: number) {
    feedbackStep(delta > 0 ? "up" : "down");
    const base = hasValidNumber ? numeric : minimum;
    const next = Math.min(maximum, Math.max(minimum, Math.round(base + delta)));
    onChange(String(next));
  }

  return (
    <View style={styles.stepperFieldBlock}>
      <View style={styles.stepperHeader}>
        <FieldLabel>{label}</FieldLabel>
        {allowEmpty && value.trim().length > 0 ? (
          <PressOpacity
            accessibilityLabel={`Clear ${label}`}
            onPress={() => {
              feedbackStep("down");
              onChange("");
            }}
            silent
            style={[
              styles.todayMiniPill,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.todayMiniText, { color: theme.colors.textMuted }]}>
              OMIT
            </Text>
          </PressOpacity>
        ) : (
          <Text style={[styles.unitBadgeText, { color: theme.colors.textMuted }]}>
            {hasValidNumber ? `${numeric}${unitSuffix}` : "NOT SET"}
          </Text>
        )}
      </View>

      <View style={styles.stepperControlsRow}>
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
          keyboardType="number-pad"
          onChangeText={onChange}
          placeholder={allowEmpty ? "—" : String(minimum)}
          style={styles.centerInput}
          value={value}
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
          const selected = hasValidNumber && numeric === preset;
          return (
            <PressOpacity
              accessibilityLabel={`Set ${label} to ${preset}`}
              key={preset}
              onPress={() => {
                feedbackStep("up");
                onChange(String(preset));
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
                {unitSuffix}
              </Text>
            </PressOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Preview({
  preview,
}: {
  preview: ReturnType<typeof buildWorkoutSnapshot> | string | null;
}) {
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
          PHASE SEQUENCE PREVIEW
        </Text>
        <Text style={[styles.cardBadge, { color: theme.colors.tertiary }]}>
          {preview.phases.length} PHASES
        </Text>
      </View>
      <Text style={[styles.previewTotal, { color: theme.colors.text }]}>
        {total}
      </Text>
      <View style={styles.phaseList}>
        {lines.map((line, index) => (
          <View
            key={`${line}-${index}`}
            style={[
              styles.phaseChip,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.phaseChipText, { color: theme.colors.textMuted }]}>
              {line}
            </Text>
          </View>
        ))}
      </View>
      {preview.phases.length > lines.length ? (
        <Text style={[styles.morePhases, { color: theme.colors.textMuted }]}>
          +{preview.phases.length - lines.length} more phases
        </Text>
      ) : null}
    </View>
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
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 58,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
  },
  headerBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 48,
    justifyContent: "center",
    minWidth: 78,
    paddingHorizontal: tokens.spacing.sm,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  headerIconBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  headingTitleWrap: {
    alignItems: "center",
    flex: 1,
  },
  headingTag: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  headingTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  form: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
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
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fieldsColumn: {
    gap: tokens.spacing.md,
  },
  stepperFieldBlock: {
    gap: 6,
  },
  stepperHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  unitBadgeText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  stepperControlsRow: {
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
    minWidth: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  presetChipText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  todayMiniPill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 8,
  },
  todayMiniText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dateStepperRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dateStepBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 54,
    paddingHorizontal: 8,
  },
  dateStepBtnText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  dateInput: {
    flex: 1,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  stationCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  stationTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stationName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  stationMeta: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stationActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  previewTotal: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  phaseList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  phaseChip: {
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  phaseChipText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  morePhases: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  footer: {
    borderTopWidth: 1,
    gap: 6,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  footerGrid: {
    flexDirection: "row",
    gap: 6,
  },
  footerCell: {
    flex: 1,
  },
});
