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
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  conditioningScoringDisclaimer,
  conditioningValidationLimits,
} from "../constants/conditioning";
import {
  ConditioningValidationError,
  getAthleteConditioningBaselines,
  logCompletedConditioningSession,
} from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningIntensityInput,
  ConditioningProtocol,
  ConditioningProtocolDraft,
  ConditioningScoreResult,
  LoggedConditioningSessionResult,
  NewConditioningLog,
  SnapshottedConditioningIntensity,
  StoredConditioningTemplate,
} from "../types/conditioning";
import {
  getConditioningEndAt,
  parseConditioningProtocolDraft,
} from "../utils/conditioningProtocol";
import { scoreConditioningSession } from "../utils/conditioningScoring";
import { ConditioningAdaptationModal } from "./ConditioningAdaptationModal";
import {
  ConditioningSessionForm,
  createDefaultConditioningSessionFormDraft,
  type ConditioningIntensityDraft,
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
const CONDITIONING_MODEL_VERSION = "conditioning-v1.0.0" as const;

export type ConditioningLogModalProps = {
  onClose: () => void;
  onSaved?: (
    result: LoggedConditioningSessionResult,
  ) => Promise<void> | void;
  selectedDate: Date;
  sourceTemplate?: StoredConditioningTemplate;
  visible: boolean;
};

type ModalStep = "form" | "adaptation";

type DraftAnalysis =
  | {
      intensity: ConditioningIntensityInput;
      ok: true;
      protocol: ConditioningProtocol;
      score: Extract<ConditioningScoreResult, { status: "scored" }>;
      totalSessionSeconds: number;
    }
  | {
      message: string;
      ok: false;
      score: ConditioningScoreResult;
    };

type ParsedIntensity =
  | {
      input: ConditioningIntensityInput;
      ok: true;
      snapshot: SnapshottedConditioningIntensity;
    }
  | { message: string; ok: false };

export function ConditioningLogModal({
  onClose,
  onSaved,
  selectedDate,
  sourceTemplate,
  visible,
}: ConditioningLogModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ConditioningSessionFormDraft>(() =>
    createDefaultConditioningSessionFormDraft(),
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
  const selectedDayKey = getLocalDayKey(selectedDate);
  const modalMaxHeight = Math.max(
    1,
    Math.min(680, windowHeight - insets.top - insets.bottom - 32),
  );

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

    const template = sourceTemplate ?? null;
    setAppliedTemplate(template);
    setDraft(
      template
        ? createDraftFromTemplate(template)
        : createDefaultConditioningSessionFormDraft(),
    );
    setStartTime(dateWithTime(selectedDate, new Date()));
    setBaselines(EMPTY_BASELINES);
    setStep("form");
    setTemplateSelectorOpen(false);
    setSaving(false);
    savingGuard.current = false;
    void loadBaselines();

    return () => {
      baselineRequestId.current += 1;
    };
  }, [loadBaselines, selectedDayKey, selectedDate, sourceTemplate, visible]);

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
    setStartTime(dateWithTime(selectedDate, nextTime));
  }

  function applyTemplate(template: StoredConditioningTemplate) {
    setAppliedTemplate(template);
    setDraft(createDraftFromTemplate(template));
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
      analysis.totalSessionSeconds,
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

    const session: NewConditioningLog = {
      activity: draft.activity,
      intensity: analysis.intensity,
      notes: notes.length > 0 ? notes : null,
      protocol: analysis.protocol,
      sourceTemplateId: appliedTemplate?.id ?? null,
      startAt,
      title,
    };

    savingGuard.current = true;
    setSaving(true);

    try {
      const result = await logCompletedConditioningSession(db, session);
      await onSaved?.(result);
      savingGuard.current = false;
      setSaving(false);
      onClose();
    } catch (error) {
      savingGuard.current = false;
      setSaving(false);
      Alert.alert(
        "Couldn’t log conditioning session",
        error instanceof ConditioningValidationError
          ? error.message
          : "Please try again.",
      );
    }
  }

  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={closeModal}
        transparent
        visible={visible && !templateSelectorOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[
            styles.overlay,
            {
              backgroundColor: theme.colors.overlay,
              paddingBottom: Math.max(tokens.spacing.lg, insets.bottom),
              paddingTop: Math.max(tokens.spacing.lg, insets.top),
            },
          ]}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.surface,
                maxHeight: modalMaxHeight,
              },
            ]}
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
                  <Text style={[styles.title, { color: theme.colors.text }]}>
                    Log Conditioning
                  </Text>
                  <Text
                    style={[styles.subtitle, { color: theme.colors.textMuted }]}
                  >
                    {formatSelectedDate(selectedDate)}
                  </Text>
                  <LogTimeChanger
                    onChange={changeStartTime}
                    value={startTime}
                  />
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
                      draft={draft}
                      onAdaptationPress={() => setStep("adaptation")}
                      onChange={setDraft}
                      scoreResult={analysis.score}
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
                      accessibilityLabel="Log conditioning session"
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
                          Log Session
                        </Text>
                      )}
                    </PressOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConditioningSessions
        onClose={() => setTemplateSelectorOpen(false)}
        onTemplateSelected={applyTemplate}
        visible={visible && templateSelectorOpen}
      />
    </>
  );
}

function analyzeDraft(
  draft: ConditioningSessionFormDraft,
  baselines: AthleteConditioningBaselines,
): DraftAnalysis {
  const protocolResult = parseConditioningProtocolDraft(draft.protocol);

  if (!protocolResult.ok) {
    const reasons = protocolResult.issues.map((issue) => issue.message);
    return {
      message: reasons[0] ?? "Complete the conditioning protocol.",
      ok: false,
      score: createInsufficientScore(reasons),
    };
  }

  const intensityResult = parseIntensityDraft(
    draft.intensity,
    draft.activity,
    baselines,
  );

  if (!intensityResult.ok) {
    return {
      message: intensityResult.message,
      ok: false,
      score: createInsufficientScore([intensityResult.message]),
    };
  }

  const score = scoreConditioningSession({
    activity: draft.activity,
    intensity: intensityResult.snapshot,
    protocol: protocolResult.protocol,
  });

  if (score.status === "insufficient") {
    return {
      message: score.reasons[0] ?? "Complete the session information.",
      ok: false,
      score,
    };
  }

  return {
    intensity: intensityResult.input,
    ok: true,
    protocol: protocolResult.protocol,
    score,
    totalSessionSeconds: protocolResult.metrics.totalSessionSeconds,
  };
}

function parseIntensityDraft(
  draft: ConditioningIntensityDraft,
  activity: ConditioningSessionFormDraft["activity"],
  baselines: AthleteConditioningBaselines,
): ParsedIntensity {
  if (draft.method === null) {
    return { input: null, ok: true, snapshot: null };
  }

  if (draft.method === "rpe") {
    const value = Number(draft.valueInput.trim());

    if (
      !Number.isFinite(value) ||
      value < conditioningValidationLimits.rpe.minimum ||
      value > conditioningValidationLimits.rpe.maximum
    ) {
      return { message: "RPE must be from 1 to 10.", ok: false };
    }

    const intensity = { method: "rpe", value } as const;
    return { input: intensity, ok: true, snapshot: intensity };
  }

  if (draft.method === "heart_rate") {
    const valueBpm = Number(draft.valueBpmInput.trim());
    const maximumHeartRateBpm = baselines.maximumHeartRateBpm;

    if (maximumHeartRateBpm === null) {
      return {
        message:
          "Set Maximum Heart Rate in Athlete Information before using heart-rate intensity.",
        ok: false,
      };
    }

    if (
      !Number.isInteger(valueBpm) ||
      valueBpm < conditioningValidationLimits.sessionHeartRateBpm.minimum ||
      valueBpm > maximumHeartRateBpm
    ) {
      return {
        message: `Heart rate must be a whole number from ${conditioningValidationLimits.sessionHeartRateBpm.minimum} to ${maximumHeartRateBpm} BPM.`,
        ok: false,
      };
    }

    return {
      input: { method: "heart_rate", valueBpm },
      ok: true,
      snapshot: { method: "heart_rate", valueBpm, maxHeartRateBpm: maximumHeartRateBpm },
    };
  }

  if (activity !== "running" && activity !== "hill_sprints") {
    return {
      message: "Pace intensity is only available for Running and Hill Sprints.",
      ok: false,
    };
  }

  if (draft.reference === "threshold_pace") {
    const thresholdPaceSecondsPerKm = baselines.thresholdPaceSecondsPerKm;

    if (thresholdPaceSecondsPerKm === null) {
      return {
        message:
          "Set Threshold Pace in Athlete Information before using pace intensity.",
        ok: false,
      };
    }

    const paceSecondsPerKm = parsePace(draft.valueInput);
    if (paceSecondsPerKm === null) {
      return {
        message: "Pace must use m:ss and be from 0:30 to 60:00 per kilometre.",
        ok: false,
      };
    }

    return {
      input: {
        method: "pace",
        paceSecondsPerKm,
        reference: "threshold_pace",
      },
      ok: true,
      snapshot: {
        method: "pace",
        paceSecondsPerKm,
        reference: "threshold_pace",
        thresholdPaceSecondsPerKm,
      },
    };
  }

  const speedKph = Number(draft.valueInput.trim());
  const maximumAerobicSpeedKph = baselines.maximumAerobicSpeedKph;

  if (maximumAerobicSpeedKph === null) {
    return {
      message:
        "Set Maximum Aerobic Speed in Athlete Information before using speed intensity.",
      ok: false,
    };
  }

  if (
    !Number.isFinite(speedKph) ||
    speedKph <= 0 ||
    speedKph > conditioningValidationLimits.maximumAerobicSpeedKph
  ) {
    return {
      message: "Speed must be greater than 0 and no more than 60 km/h.",
      ok: false,
    };
  }

  return {
    input: {
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph,
    },
    ok: true,
    snapshot: {
      maximumAerobicSpeedKph,
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph,
    },
  };
}

function createInsufficientScore(reasons: string[]): ConditioningScoreResult {
  return {
    evidence: "insufficient",
    modelVersion: CONDITIONING_MODEL_VERSION,
    primaryAdaptation: null,
    reasons,
    scores: null,
    status: "insufficient",
  };
}

function createDraftFromTemplate(
  template: StoredConditioningTemplate,
): ConditioningSessionFormDraft {
  return {
    activity: template.activity,
    intensity: createIntensityDraft(template.intensity),
    notesInput: template.notes ?? "",
    protocol: createProtocolDraft(template.protocol),
    titleInput: template.title,
  };
}

function createIntensityDraft(
  intensity: ConditioningIntensityInput,
): ConditioningIntensityDraft {
  if (intensity === null) {
    return { method: null };
  }

  if (intensity.method === "rpe") {
    return { method: "rpe", valueInput: String(intensity.value) };
  }

  if (intensity.method === "heart_rate") {
    return {
      method: "heart_rate",
      valueBpmInput: String(intensity.valueBpm),
    };
  }

  return {
    method: "pace",
    reference: intensity.reference,
    valueInput:
      intensity.reference === "threshold_pace"
        ? formatPace(intensity.paceSecondsPerKm)
        : String(intensity.speedKph),
  };
}

function createProtocolDraft(
  protocol: ConditioningProtocol,
): ConditioningProtocolDraft {
  if (protocol.type === "continuous") {
    return {
      distanceMetersInput:
        protocol.distanceMeters === null ? "" : String(protocol.distanceMeters),
      durationSecondsInput: String(protocol.durationSeconds),
      type: protocol.type,
    };
  }

  if (protocol.type === "time_intervals") {
    return {
      repetitionsPerSetInput: String(protocol.repetitionsPerSet),
      restBetweenRepetitionsSecondsInput: String(
        protocol.restBetweenRepetitionsSeconds,
      ),
      restBetweenSetsSecondsInput: String(protocol.restBetweenSetsSeconds),
      setCountInput: String(protocol.setCount),
      type: protocol.type,
      workSecondsInput: String(protocol.workSeconds),
    };
  }

  if (protocol.type === "distance_intervals") {
    return {
      elapsedDurationSecondsInput: String(protocol.elapsedDurationSeconds),
      repetitionsPerSetInput: String(protocol.repetitionsPerSet),
      restBetweenRepetitionsSecondsInput: String(
        protocol.restBetweenRepetitionsSeconds,
      ),
      restBetweenSetsSecondsInput: String(protocol.restBetweenSetsSeconds),
      setCountInput: String(protocol.setCount),
      type: protocol.type,
      workDistanceMetersInput: String(protocol.workDistanceMeters),
    };
  }

  return {
    restBetweenRoundsSecondsInput: String(protocol.restBetweenRoundsSeconds),
    restBetweenStationsSecondsInput: String(
      protocol.restBetweenStationsSeconds,
    ),
    roundCountInput: String(protocol.roundCount),
    stations: protocol.stations.map((station) => ({
      nameInput: station.name,
      workSecondsInput: String(station.workSeconds),
    })),
    type: protocol.type,
  };
}

function parsePace(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds >=
    conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum &&
    seconds <= conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum
    ? seconds
    : null;
}

function formatPace(secondsPerKm: number) {
  const roundedSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function dateWithTime(day: Date, time: Date) {
  const result = new Date(day);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

function getLocalDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatSelectedDate(date: Date) {
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
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
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
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
