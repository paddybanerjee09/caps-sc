import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  conditioningScoringDisclaimer,
  conditioningValidationLimits,
} from "../constants/conditioning";
import {
  ConditioningValidationError,
  getAthleteConditioningBaselines,
  logCompletedConditioningSession,
  updateCompletedConditioningSession,
} from "../data/conditioningRepository";
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  LoggedConditioningSessionResult,
  NewConditioningLog,
  StoredConditioningSession,
  StoredConditioningTemplate,
} from "../types/conditioning";
import { getConditioningEndAt } from "../utils/conditioningProtocol";
import {
  analyzeConditioningSessionFormDraft,
  createConditioningSessionFormDraftFromDefinition,
} from "../utils/conditioningSessionDraft";
import { AppModalFrame } from "./AppModalFrame";
import { ConditioningAdaptationModal } from "./ConditioningAdaptationModal";
import {
  ConditioningAdaptationBadge,
  ConditioningSessionForm,
  ConditioningTitleInput,
  createDefaultConditioningSessionFormDraft,
  type ConditioningSessionFormDraft,
} from "./ConditioningSessionForm";
import { ConditioningSessions } from "./ConditioningSessions";
import { LogTimeChanger } from "./LogTimeChanger";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;
const EMPTY_BASELINES: AthleteConditioningBaselines = {
  maximumAerobicSpeedKph: null,
  maximumHeartRateBpm: null,
  thresholdPaceSecondsPerKm: null,
};

export type ConditioningLogModalProps = {
  entryToEdit?: StoredConditioningSession;
  onClose: () => void;
  onSaved?: (
    result: LoggedConditioningSessionResult,
  ) => Promise<void> | void;
  selectedDate: Date;
  sourceTemplate?: StoredConditioningTemplate;
  visible: boolean;
};

type ModalStep = "form" | "adaptation";

export function ConditioningLogModal({
  entryToEdit,
  onClose,
  onSaved,
  selectedDate,
  sourceTemplate,
  visible,
}: ConditioningLogModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { unitSettings } = useAppState();
  const [draft, setDraft] = useState<ConditioningSessionFormDraft>(() =>
    createDefaultConditioningSessionFormDraft(unitSettings.distance),
  );
  const [startTime, setStartTime] = useState(() => new Date());
  const [baselines, setBaselines] =
    useState<AthleteConditioningBaselines>(EMPTY_BASELINES);
  const [appliedTemplate, setAppliedTemplate] =
    useState<StoredConditioningTemplate | null>(sourceTemplate ?? null);
  const [step, setStep] = useState<ModalStep>("form");
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [loadingBaselines, setLoadingBaselines] = useState(false);
  const [baselineError, setBaselineError] = useState(false);
  const [saving, setSaving] = useState(false);
  const baselineRequestId = useRef(0);
  const savingGuard = useRef(false);
  const distanceUnitRef = useRef(unitSettings.distance);
  distanceUnitRef.current = unitSettings.distance;
  const entryToEditRef = useRef(entryToEdit);
  entryToEditRef.current = entryToEdit;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const sourceTemplateRef = useRef(sourceTemplate);
  sourceTemplateRef.current = sourceTemplate;
  const selectedDayKey = getLocalDayKey(selectedDate);
  const initializationKey = entryToEdit
    ? `edit:${entryToEdit.timelineEntryId}:${entryToEdit.updatedAt}`
    : `create:${selectedDayKey}:${sourceTemplate?.id ?? "blank"}:${sourceTemplate?.updatedAt ?? "new"}`;
  const editing = entryToEdit !== undefined;
  const loadBaselines = useCallback(async () => {
    const requestId = baselineRequestId.current + 1;
    baselineRequestId.current = requestId;
    setLoadingBaselines(true);
    setBaselineError(false);

    try {
      const nextBaselines = await getAthleteConditioningBaselines(db);

      if (baselineRequestId.current === requestId) {
        setBaselines(nextBaselines);
      }
    } catch {
      if (baselineRequestId.current === requestId) {
        setBaselineError(true);
      }
    } finally {
      if (baselineRequestId.current === requestId) {
        setLoadingBaselines(false);
      }
    }
  }, [db]);

  useEffect(() => {
    if (!visible) {
      baselineRequestId.current += 1;
      return;
    }

    const storedSession = entryToEditRef.current;
    const template = storedSession ? null : (sourceTemplateRef.current ?? null);
    setAppliedTemplate(template);
    setDraft(
      storedSession
        ? createConditioningSessionFormDraftFromDefinition(
            storedSession,
            distanceUnitRef.current,
            storedSession.intensity,
          )
        : template
        ? createConditioningSessionFormDraftFromDefinition(
            template,
            distanceUnitRef.current,
          )
        : createDefaultConditioningSessionFormDraft(distanceUnitRef.current),
    );
    setStartTime(
      storedSession
        ? new Date(storedSession.startAt)
        : dateWithTime(selectedDateRef.current, new Date()),
    );
    setBaselines(EMPTY_BASELINES);
    setStep("form");
    setTemplateSelectorOpen(false);
    setSaving(false);
    savingGuard.current = false;
    void loadBaselines();

    return () => {
      baselineRequestId.current += 1;
    };
  }, [initializationKey, loadBaselines, visible]);

  const analysis = useMemo(
    () => analyzeDraft(draft, baselines),
    [baselines, draft],
  );

  function closeModal() {
    if (savingGuard.current) {
      return;
    }

    setTemplateSelectorOpen(false);
    setStep("form");
    onClose();
  }

  function changeStartTime(nextTime: Date) {
    const sessionDay = entryToEditRef.current
      ? new Date(entryToEditRef.current.startAt)
      : selectedDateRef.current;
    setStartTime(dateWithTime(sessionDay, nextTime));
  }

  function applyTemplate(template: StoredConditioningTemplate) {
    setAppliedTemplate(template);
    setDraft(
      createConditioningSessionFormDraftFromDefinition(
        template,
        unitSettings.distance,
      ),
    );
    setTemplateSelectorOpen(false);
    setStep("form");
  }

  async function saveSession() {
    if (savingGuard.current) {
      return;
    }

    const title = draft.titleInput.trim();
    if (
      title.length === 0 ||
      title.length > conditioningValidationLimits.titleLength
    ) {
      Alert.alert(
        "Invalid session",
        `Add a title no longer than ${conditioningValidationLimits.titleLength} characters.`,
      );
      return;
    }

    const notes = draft.notesInput.trim();
    if (notes.length > conditioningValidationLimits.notesLength) {
      Alert.alert(
        "Invalid session",
        `Notes cannot exceed ${conditioningValidationLimits.notesLength} characters.`,
      );
      return;
    }

    if (!analysis.ok) {
      Alert.alert("Invalid session", analysis.message);
      return;
    }

    const startAt = startTime.getTime();
    const endAt = getConditioningEndAt(
      startAt,
      analysis.metrics.totalSessionSeconds,
    );
    const now = Date.now();

    if (!Number.isInteger(startAt) || endAt === null) {
      Alert.alert("Invalid session", "Choose a valid session time.");
      return;
    }

    if (startAt > now) {
      Alert.alert(
        "Session is in the future",
        "A completed conditioning session must start in the past or present.",
      );
      return;
    }

    if (endAt > now) {
      Alert.alert(
        "Session is not complete",
        "Choose an earlier start time so the full session ends in the past or present.",
      );
      return;
    }

    const session = {
      activity: draft.activity,
      intensity: analysis.intensity,
      notes: notes.length > 0 ? notes : null,
      protocol: analysis.protocol,
      startAt,
      title,
    };

    savingGuard.current = true;
    setSaving(true);

    try {
      const result = entryToEdit
        ? await updateCompletedConditioningSession(
            db,
            entryToEdit.timelineEntryId,
            session,
          )
        : await logCompletedConditioningSession(db, {
            ...session,
            sourceTemplateId: appliedTemplate?.id ?? null,
          } satisfies NewConditioningLog);
      await onSaved?.(result);
      savingGuard.current = false;
      setSaving(false);
      onClose();
    } catch (error) {
      savingGuard.current = false;
      setSaving(false);
      Alert.alert(
        editing
          ? "Couldn’t update conditioning session"
          : "Couldn’t log conditioning session",
        error instanceof ConditioningValidationError
          ? error.message
          : "Please try again.",
      );
    }
  }

  return (
    <>
      <AppModalFrame
        dismissDisabled={saving}
        visible={visible && !templateSelectorOpen}
        width="form"
        onClose={closeModal}
      >
        {step === "adaptation" ? (
              <ScrollView
                contentContainerStyle={styles.adaptationBody}
                keyboardShouldPersistTaps="handled"
                style={styles.scroll}
              >
                <ConditioningAdaptationModal
                  onBack={() => setStep("form")}
                  result={analysis.score}
                />
              </ScrollView>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                      {editing ? "Edit Conditioning" : "Log Conditioning"}
                    </Text>
                    <ConditioningAdaptationBadge
                      compact
                      onPress={() => setStep("adaptation")}
                      scoreResult={analysis.score}
                    />
                  </View>
                  <View style={styles.headerRow}>
                    <View style={styles.titleInputSlot}>
                      <ConditioningTitleInput
                        compact
                        disabled={saving}
                        onChangeText={(titleInput) =>
                          setDraft((current) => ({ ...current, titleInput }))
                        }
                        value={draft.titleInput}
                      />
                    </View>
                    <LogTimeChanger
                      inline
                      onChange={changeStartTime}
                      value={startTime}
                    />
                  </View>
                </View>

                {loadingBaselines ? (
                  <View style={styles.state}>
                    <ActivityIndicator color={theme.colors.tertiary} />
                    <Text style={{ color: theme.colors.textMuted }}>
                      Loading conditioning baselines…
                    </Text>
                  </View>
                ) : baselineError ? (
                  <View style={styles.state}>
                    <Text style={[styles.stateTitle, { color: theme.colors.text }]}>
                      Couldn’t load conditioning baselines
                    </Text>
                    <PressOpacity
                      accessibilityLabel="Retry loading conditioning baselines"
                      onPress={() => void loadBaselines()}
                      style={styles.stateAction}
                    >
                      <Text style={{ color: theme.colors.tertiary }}>Retry</Text>
                    </PressOpacity>
                  </View>
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.body}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    style={styles.scroll}
                  >
                    <ConditioningSessionForm
                      baselines={baselines}
                      disabled={saving}
                      distanceUnit={unitSettings.distance}
                      draft={draft}
                      onAdaptationPress={() => setStep("adaptation")}
                      onChange={setDraft}
                      scoreResult={analysis.score}
                      showHeading={false}
                    />

                    <Text
                      style={[styles.disclaimer, { color: theme.colors.textMuted }]}
                    >
                      {conditioningScoringDisclaimer}
                    </Text>
                  </ScrollView>
                )}

                <View
                  style={[
                    styles.actions,
                    { borderTopColor: theme.colors.border },
                  ]}
                >
                  {!editing ? (
                    <PressOpacity
                      accessibilityLabel="Choose a pre-existing conditioning session"
                      disabled={loadingBaselines || baselineError || saving}
                      onPress={() => setTemplateSelectorOpen(true)}
                      style={[
                        styles.templateButton,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: theme.colors.borderStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.templateButtonText,
                          { color: theme.colors.text },
                        ]}
                      >
                        Log Pre-existing Session
                      </Text>
                    </PressOpacity>
                  ) : null}

                  <View style={styles.actionRow}>
                    <PressOpacity
                      accessibilityLabel="Cancel conditioning log"
                      disabled={saving}
                      onPress={closeModal}
                      style={styles.actionButton}
                    >
                      <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
                    </PressOpacity>

                    <PressOpacity
                      accessibilityLabel={
                        editing
                          ? "Update conditioning session"
                          : "Log conditioning session"
                      }
                      disabled={loadingBaselines || baselineError || saving}
                      onPress={() => void saveSession()}
                      style={styles.actionButton}
                    >
                      {saving ? (
                        <ActivityIndicator
                          color={theme.colors.tertiary}
                          size="small"
                        />
                      ) : (
                        <Text style={{ color: theme.colors.tertiary }}>
                          {editing ? "Update Session" : "Log Session"}
                        </Text>
                      )}
                    </PressOpacity>
                  </View>
                </View>
          </>
        )}
      </AppModalFrame>

      <ConditioningSessions
        onClose={() => setTemplateSelectorOpen(false)}
        onTemplateSelected={applyTemplate}
        visible={!editing && templateSelectorOpen}
      />
    </>
  );
}

function analyzeDraft(
  draft: ConditioningSessionFormDraft,
  baselines: AthleteConditioningBaselines,
) {
  return analyzeConditioningSessionFormDraft(draft, baselines);
}

function dateWithTime(day: Date, time: Date) {
  const result = new Date(day);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

function getLocalDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.lg,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    maxWidth: 460,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
    minWidth: 0,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    minWidth: 0,
  },
  titleInputSlot: { flex: 1, minWidth: 0 },
  body: {
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
  },
  scroll: {
    flexShrink: 1,
  },
  adaptationBody: {
    flexGrow: 1,
  },
  disclaimer: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  state: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 240,
    padding: tokens.spacing.lg,
  },
  stateTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  stateAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 72,
  },
  actions: {
    borderTopWidth: 1,
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  templateButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
    width: "100%",
  },
  templateButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 88,
  },
});
