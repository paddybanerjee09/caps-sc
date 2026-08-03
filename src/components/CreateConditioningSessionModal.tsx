import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { conditioningValidationLimits } from "../constants/conditioning";
import {
  ConditioningValidationError,
  createConditioningTemplate,
  getAthleteConditioningBaselines,
} from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningActivity,
  ConditioningIntensityInput,
  ConditioningScoreResult,
  NewConditioningTemplate,
  StoredConditioningTemplate,
} from "../types/conditioning";
import { parseConditioningProtocolDraft } from "../utils/conditioningProtocol";
import { ConditioningAdaptationModal } from "./ConditioningAdaptationModal";
import {
  ConditioningSessionForm,
  createDefaultConditioningSessionFormDraft,
  type ConditioningIntensityDraft,
  type ConditioningSessionFormDraft,
} from "./ConditioningSessionForm";
import { getConditioningScorePreview } from "./ConditioningSessions";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

const emptyBaselines: AthleteConditioningBaselines = {
  maximumAerobicSpeedKph: null,
  maximumHeartRateBpm: null,
  thresholdPaceSecondsPerKm: null,
};

export type CreateConditioningSessionModalProps = {
  onClose: () => void;
  onCreated?: (
    template: StoredConditioningTemplate,
  ) => Promise<void> | void;
  visible: boolean;
};

export function CreateConditioningSessionModal({
  onClose,
  onCreated,
  visible,
}: CreateConditioningSessionModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState<ConditioningSessionFormDraft>(
    createDefaultConditioningSessionFormDraft,
  );
  const [baselines, setBaselines] =
    useState<AthleteConditioningBaselines>(emptyBaselines);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdaptations, setShowAdaptations] = useState(false);
  const requestIdRef = useRef(0);
  const savingRef = useRef(false);

  const loadBaselines = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setLoadError(null);

    try {
      const nextBaselines = await getAthleteConditioningBaselines(db);

      if (requestId === requestIdRef.current) {
        setBaselines(nextBaselines);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setLoadError("Couldn't load conditioning baselines.");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [db]);

  useEffect(() => {
    if (!visible) {
      requestIdRef.current += 1;
      return;
    }

    setDraft(createDefaultConditioningSessionFormDraft());
    setBaselines(emptyBaselines);
    setShowAdaptations(false);
    void loadBaselines();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadBaselines, visible]);

  const parsedDraft = useMemo(
    () => parseSessionDraft(draft, baselines),
    [baselines, draft],
  );
  const scoreResult = useMemo(
    () => getDraftScore(parsedDraft),
    [parsedDraft],
  );

  function closeModal() {
    if (savingRef.current) {
      return;
    }

    requestIdRef.current += 1;
    onClose();
  }

  async function createTemplate() {
    if (savingRef.current) {
      return;
    }

    if (!parsedDraft.ok) {
      Alert.alert("Check conditioning session", parsedDraft.message);
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const template = await createConditioningTemplate(db, parsedDraft.value);
      await onCreated?.(template);
      onClose();
    } catch (error) {
      Alert.alert(
        "Couldn't create conditioning session",
        error instanceof ConditioningValidationError
          ? error.message
          : "Please try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.modalOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {showAdaptations ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ConditioningAdaptationModal
                onBack={() => setShowAdaptations(false)}
                result={scoreResult}
              />
            </ScrollView>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Create Conditioning Session
              </Text>

              {loading ? (
                <View
                  accessibilityLabel="Loading conditioning session form"
                  accessibilityLiveRegion="polite"
                  style={styles.stateContainer}
                >
                  <ActivityIndicator color={theme.colors.tertiary} />
                </View>
              ) : loadError ? (
                <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
                  <Text style={[styles.stateText, { color: theme.colors.text }]}>
                    {loadError}
                  </Text>
                  <PressOpacity
                    accessibilityLabel="Retry loading conditioning baselines"
                    onPress={() => void loadBaselines()}
                    style={[
                      styles.retryButton,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      Retry
                    </Text>
                  </PressOpacity>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.formContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.formScroll}
                >
                  <ConditioningSessionForm
                    baselines={baselines}
                    disabled={saving}
                    draft={draft}
                    onAdaptationPress={() => setShowAdaptations(true)}
                    onChange={setDraft}
                    scoreResult={scoreResult}
                  />
                </ScrollView>
              )}

              <View
                style={[
                  styles.actions,
                  { borderTopColor: theme.colors.border },
                ]}
              >
                <PressOpacity
                  disabled={saving}
                  onPress={closeModal}
                  style={styles.actionButton}
                >
                  <Text
                    style={[styles.actionText, { color: theme.colors.textMuted }]}
                  >
                    Cancel
                  </Text>
                </PressOpacity>
                <PressOpacity
                  disabled={loading || loadError !== null || saving}
                  onPress={() => void createTemplate()}
                  style={styles.actionButton}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.colors.tertiary} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.actionText,
                        { color: theme.colors.tertiary },
                      ]}
                    >
                      Create
                    </Text>
                  )}
                </PressOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ParsedSessionDraft =
  | {
      ok: true;
      score: ConditioningScoreResult;
      value: NewConditioningTemplate;
    }
  | { ok: false; message: string; score: ConditioningScoreResult };

function parseSessionDraft(
  draft: ConditioningSessionFormDraft,
  baselines: AthleteConditioningBaselines,
): ParsedSessionDraft {
  const title = draft.titleInput.trim();
  const notes = draft.notesInput.trim();
  const protocolResult = parseConditioningProtocolDraft(draft.protocol);
  const intensityResult = parseIntensityDraft(
    draft.activity,
    draft.intensity,
    baselines,
  );

  if (!protocolResult.ok) {
    const message = protocolResult.issues[0]?.message ?? "Protocol is invalid.";

    return {
      message,
      ok: false,
      score: createInsufficientScore(
        protocolResult.issues.map((issue) => issue.message),
      ),
    };
  }

  if (!intensityResult.ok) {
    return {
      message: intensityResult.message,
      ok: false,
      score: createInsufficientScore([intensityResult.message]),
    };
  }

  const score = getConditioningScorePreview(
    draft.activity,
    protocolResult.protocol,
    intensityResult.intensity,
    baselines,
  );

  if (
    title.length === 0 ||
    title.length > conditioningValidationLimits.titleLength
  ) {
    return {
      message: `Title must be from 1 to ${conditioningValidationLimits.titleLength} characters.`,
      ok: false,
      score,
    };
  }

  if (notes.length > conditioningValidationLimits.notesLength) {
    return {
      message: `Notes cannot be longer than ${conditioningValidationLimits.notesLength} characters.`,
      ok: false,
      score,
    };
  }

  if (score.status === "insufficient") {
    return {
      message: score.reasons[0] ?? "Conditioning information is incomplete.",
      ok: false,
      score,
    };
  }

  return {
    ok: true,
    score,
    value: {
      activity: draft.activity,
      intensity: intensityResult.intensity,
      notes: notes.length === 0 ? null : notes,
      protocol: protocolResult.protocol,
      title,
    },
  };
}

function parseIntensityDraft(
  activity: ConditioningActivity,
  draft: ConditioningIntensityDraft,
  baselines: AthleteConditioningBaselines,
):
  | { ok: true; intensity: ConditioningIntensityInput }
  | { ok: false; message: string } {
  if (draft.method === null) {
    return { intensity: null, ok: true };
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

    return { intensity: { method: "rpe", value }, ok: true };
  }

  if (draft.method === "heart_rate") {
    const valueBpm = Number(draft.valueBpmInput.trim());

    if (baselines.maximumHeartRateBpm === null) {
      return {
        message: "Set a maximum heart rate in Athlete Information first.",
        ok: false,
      };
    }

    if (
      !Number.isInteger(valueBpm) ||
      valueBpm < conditioningValidationLimits.sessionHeartRateBpm.minimum ||
      valueBpm > baselines.maximumHeartRateBpm
    ) {
      return {
        message: `Heart rate must be a whole number from ${conditioningValidationLimits.sessionHeartRateBpm.minimum} to ${baselines.maximumHeartRateBpm} BPM.`,
        ok: false,
      };
    }

    return { intensity: { method: "heart_rate", valueBpm }, ok: true };
  }

  if (activity !== "running" && activity !== "hill_sprints") {
    return {
      message: "Pace intensity is only available for Running and Hill Sprints.",
      ok: false,
    };
  }

  if (draft.reference === "threshold_pace") {
    const paceSecondsPerKm = parsePace(draft.valueInput);

    if (baselines.thresholdPaceSecondsPerKm === null) {
      return {
        message: "Set a threshold pace in Athlete Information first.",
        ok: false,
      };
    }

    if (
      paceSecondsPerKm === null ||
      paceSecondsPerKm <
        conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum ||
      paceSecondsPerKm >
        conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum
    ) {
      return {
        message: "Session pace must use m:ss and be from 0:30 to 60:00 per km.",
        ok: false,
      };
    }

    return {
      intensity: {
        method: "pace",
        paceSecondsPerKm,
        reference: "threshold_pace",
      },
      ok: true,
    };
  }

  const speedKph = Number(draft.valueInput.trim());

  if (baselines.maximumAerobicSpeedKph === null) {
    return {
      message: "Set a maximum aerobic speed in Athlete Information first.",
      ok: false,
    };
  }

  if (
    !Number.isFinite(speedKph) ||
    speedKph <= 0 ||
    speedKph > conditioningValidationLimits.maximumAerobicSpeedKph
  ) {
    return {
      message: "Session speed must be greater than 0 and no more than 60 km/h.",
      ok: false,
    };
  }

  return {
    intensity: {
      method: "pace",
      reference: "maximum_aerobic_speed",
      speedKph,
    },
    ok: true,
  };
}

function parsePace(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function getDraftScore(parsedDraft: ParsedSessionDraft) {
  return parsedDraft.score;
}

function createInsufficientScore(reasons: string[]): ConditioningScoreResult {
  return {
    evidence: "insufficient",
    modelVersion: "conditioning-v1.0.0",
    primaryAdaptation: null,
    reasons,
    scores: null,
    status: "insufficient",
  };
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    maxHeight: "92%",
    maxWidth: 520,
    overflow: "hidden",
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    textAlign: "center",
  },
  stateContainer: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 280,
    padding: tokens.spacing.lg,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: tokens.spacing.md,
  },
  formScroll: {
    flexShrink: 1,
  },
  formContent: {
    padding: tokens.spacing.lg,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "flex-end",
    padding: tokens.spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 80,
    paddingHorizontal: tokens.spacing.sm,
  },
  actionText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
});
