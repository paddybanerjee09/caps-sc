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
import { useAppState } from "../state/AppStateContext";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningScoreResult,
  NewConditioningTemplate,
  StoredConditioningTemplate,
} from "../types/conditioning";
import { analyzeConditioningSessionFormDraft } from "../utils/conditioningSessionDraft";
import { ConditioningAdaptationModal } from "./ConditioningAdaptationModal";
import {
  ConditioningSessionForm,
  createDefaultConditioningSessionFormDraft,
  type ConditioningSessionFormDraft,
} from "./ConditioningSessionForm";
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
  const { unitSettings } = useAppState();
  const [draft, setDraft] = useState<ConditioningSessionFormDraft>(
    () => createDefaultConditioningSessionFormDraft(unitSettings.distance),
  );
  const [baselines, setBaselines] =
    useState<AthleteConditioningBaselines>(emptyBaselines);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdaptations, setShowAdaptations] = useState(false);
  const requestIdRef = useRef(0);
  const savingRef = useRef(false);
  const distanceUnitRef = useRef(unitSettings.distance);
  distanceUnitRef.current = unitSettings.distance;

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

    setDraft(
      createDefaultConditioningSessionFormDraft(distanceUnitRef.current),
    );
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
                    distanceUnit={unitSettings.distance}
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
  const analysis = analyzeConditioningSessionFormDraft(draft, baselines);

  if (!analysis.ok) {
    return {
      message: analysis.message,
      ok: false,
      score: analysis.score,
    };
  }
  const score = analysis.score;

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

  return {
    ok: true,
    score,
    value: {
      activity: draft.activity,
      intensity: analysis.intensity,
      notes: notes.length === 0 ? null : notes,
      protocol: analysis.protocol,
      title,
    },
  };
}

function getDraftScore(parsedDraft: ParsedSessionDraft) {
  return parsedDraft.score;
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
