import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSQLiteContext } from "expo-sqlite";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  conditioningActivityOptions,
  conditioningAdaptations,
  conditioningProtocolOptions,
} from "../constants/conditioning";
import {
  getAthleteConditioningBaselines,
  listConditioningTemplates,
} from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  AthleteConditioningBaselines,
  ConditioningActivity,
  ConditioningIntensityInput,
  ConditioningProtocol,
  ConditioningScoreResult,
  SnapshottedConditioningIntensity,
  StoredConditioningTemplate,
} from "../types/conditioning";
import { evaluateConditioningProtocol } from "../utils/conditioningProtocol";
import { scoreConditioningSession } from "../utils/conditioningScoring";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

export type ConditioningSessionsProps = {
  onClose: () => void;
  onTemplateSelected: (
    template: StoredConditioningTemplate,
  ) => Promise<void> | void;
  visible: boolean;
};

export function ConditioningSessions({
  onClose,
  onTemplateSelected,
  visible,
}: ConditioningSessionsProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [baselines, setBaselines] = useState<AthleteConditioningBaselines>(
    emptyBaselines,
  );
  const [templates, setTemplates] = useState<StoredConditioningTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadTemplates = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const [nextTemplates, nextBaselines] = await Promise.all([
        listConditioningTemplates(db),
        getAthleteConditioningBaselines(db),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setTemplates(nextTemplates);
      setBaselines(nextBaselines);
      setSelectedTemplateId(null);
    } catch {
      if (requestId === requestIdRef.current) {
        setError("Couldn't load saved sessions.");
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

    void loadTemplates();

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadTemplates, visible]);

  const templatePresentations = useMemo(
    () =>
      templates.map((template) => ({
        score: getConditioningScorePreview(
          template.activity,
          template.protocol,
          template.intensity,
          baselines,
        ),
        template,
      })),
    [baselines, templates],
  );
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;

  function closeModal() {
    requestIdRef.current += 1;
    onClose();
  }

  function confirmSelection() {
    if (selectedTemplate) {
      void onTemplateSelected(selectedTemplate);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.modalOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Saved Sessions
            </Text>
          </View>

          {loading ? (
            <View
              accessibilityLabel="Loading saved conditioning sessions"
              accessibilityLiveRegion="polite"
              style={styles.stateContainer}
            >
              <ActivityIndicator color={theme.colors.tertiary} />
            </View>
          ) : error ? (
            <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
              <Text style={[styles.stateText, { color: theme.colors.text }]}>
                {error}
              </Text>
              <PressOpacity
                accessibilityLabel="Retry loading saved conditioning sessions"
                onPress={() => void loadTemplates()}
                style={[
                  styles.retryButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                  Retry
                </Text>
              </PressOpacity>
            </View>
          ) : templatePresentations.length === 0 ? (
            <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
              <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
                No saved conditioning sessions
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.templateList}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.templateScroll}
            >
              {templatePresentations.map(({ score, template }) => {
                const selected = template.id === selectedTemplateId;
                const activity = getActivityPresentation(template.activity);
                const adaptation =
                  score.status === "scored"
                    ? conditioningAdaptations[score.primaryAdaptation]
                    : null;

                return (
                  <PressOpacity
                    accessibilityLabel={`${template.title}, ${activity.label}, ${getProtocolSummary(template.protocol)}${adaptation ? `, primary adaptation ${adaptation.label}` : ", adaptation undetermined"}${selected ? ", selected" : ""}`}
                    accessibilityRole="button"
                    key={template.id}
                    onPress={() => setSelectedTemplateId(template.id)}
                    style={[
                      styles.templateRow,
                      {
                        backgroundColor: selected
                          ? theme.colors.surfaceMuted
                          : theme.colors.surface,
                        borderColor: selected
                          ? theme.colors.tertiary
                          : theme.colors.border,
                      },
                    ]}
                  >
                    <View
                      accessible={false}
                      style={[
                        styles.activityIcon,
                        { backgroundColor: theme.colors.surfaceMuted },
                      ]}
                    >
                      <MaterialCommunityIcons
                        color={theme.colors.tertiary}
                        name={activity.icon}
                        size={22}
                      />
                    </View>

                    <View accessible={false} style={styles.templateText}>
                      <Text
                        numberOfLines={1}
                        style={[styles.templateTitle, { color: theme.colors.text }]}
                      >
                        {template.title}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.templateDetails,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        {activity.label} · {getProtocolSummary(template.protocol)}
                      </Text>
                    </View>

                    {adaptation ? (
                      <View
                        accessible={false}
                        style={[
                          styles.adaptationBadge,
                          { backgroundColor: adaptation.color },
                        ]}
                      >
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.adaptationText,
                            { color: adaptation.contentColor },
                          ]}
                        >
                          {adaptation.label}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        accessible={false}
                        style={[
                          styles.undeterminedText,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Undetermined
                      </Text>
                    )}

                    <Ionicons
                      accessible={false}
                      color={
                        selected ? theme.colors.tertiary : theme.colors.textMuted
                      }
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                    />
                  </PressOpacity>
                );
              })}
            </ScrollView>
          )}

          <View
            style={[
              styles.actions,
              { borderTopColor: theme.colors.border },
            ]}
          >
            <PressOpacity onPress={closeModal} style={styles.actionButton}>
              <Text style={[styles.buttonText, { color: theme.colors.textMuted }]}>
                Cancel
              </Text>
            </PressOpacity>
            <PressOpacity
              disabled={selectedTemplate === null || loading || error !== null}
              onPress={confirmSelection}
              style={styles.actionButton}
            >
              <Text
                style={[styles.buttonText, { color: theme.colors.tertiary }]}
              >
                Log Session
              </Text>
            </PressOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function getConditioningScorePreview(
  activity: ConditioningActivity,
  protocol: ConditioningProtocol,
  intensity: ConditioningIntensityInput,
  baselines: AthleteConditioningBaselines,
): ConditioningScoreResult {
  const protocolResult = evaluateConditioningProtocol(protocol);

  if (!protocolResult.ok) {
    return createInsufficientScore(
      protocolResult.issues.map((issue) => issue.message),
    );
  }

  const intensityResult = snapshotIntensity(
    activity,
    intensity,
    baselines,
  );

  if (!intensityResult.ok) {
    return createInsufficientScore([intensityResult.message]);
  }

  return scoreConditioningSession({
    activity,
    intensity: intensityResult.intensity,
    protocol: protocolResult.protocol,
  });
}

function snapshotIntensity(
  activity: ConditioningActivity,
  intensity: ConditioningIntensityInput,
  baselines: AthleteConditioningBaselines,
):
  | { ok: true; intensity: SnapshottedConditioningIntensity }
  | { ok: false; message: string } {
  if (intensity === null || intensity.method === "rpe") {
    return { intensity, ok: true };
  }

  if (intensity.method === "heart_rate") {
    if (baselines.maximumHeartRateBpm === null) {
      return {
        message: "Set a maximum heart rate to score this session.",
        ok: false,
      };
    }

    return {
      intensity: {
        ...intensity,
        maxHeartRateBpm: baselines.maximumHeartRateBpm,
      },
      ok: true,
    };
  }

  if (activity !== "running" && activity !== "hill_sprints") {
    return {
      message: "Pace intensity is only available for running activities.",
      ok: false,
    };
  }

  if (intensity.reference === "threshold_pace") {
    if (baselines.thresholdPaceSecondsPerKm === null) {
      return {
        message: "Set a threshold pace to score this session.",
        ok: false,
      };
    }

    return {
      intensity: {
        ...intensity,
        thresholdPaceSecondsPerKm: baselines.thresholdPaceSecondsPerKm,
      },
      ok: true,
    };
  }

  if (baselines.maximumAerobicSpeedKph === null) {
    return {
      message: "Set a maximum aerobic speed to score this session.",
      ok: false,
    };
  }

  return {
    intensity: {
      ...intensity,
      maximumAerobicSpeedKph: baselines.maximumAerobicSpeedKph,
    },
    ok: true,
  };
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

const emptyBaselines: AthleteConditioningBaselines = {
  maximumAerobicSpeedKph: null,
  maximumHeartRateBpm: null,
  thresholdPaceSecondsPerKm: null,
};

function getActivityPresentation(activity: ConditioningActivity): {
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
} {
  const presentation = conditioningActivityOptions.find(
    (option) => option.key === activity,
  );

  return {
    icon: (presentation?.icon ??
      "dots-horizontal") as ComponentProps<typeof MaterialCommunityIcons>["name"],
    label: presentation?.label ?? "Other",
  };
}

function getProtocolSummary(protocol: ConditioningProtocol) {
  const protocolLabel =
    conditioningProtocolOptions.find((option) => option.key === protocol.type)
      ?.label ?? "Conditioning";
  const result = evaluateConditioningProtocol(protocol);

  if (!result.ok) {
    return protocolLabel;
  }

  if (protocol.type === "time_intervals") {
    return `${protocolLabel} · ${protocol.repetitionsPerSet * protocol.setCount} reps · ${formatDuration(result.metrics.totalSessionSeconds)}`;
  }

  if (protocol.type === "distance_intervals") {
    return `${protocolLabel} · ${protocol.repetitionsPerSet * protocol.setCount} × ${formatDistance(protocol.workDistanceMeters)} · ${formatDuration(result.metrics.totalSessionSeconds)}`;
  }

  if (protocol.type === "circuit") {
    return `${protocolLabel} · ${protocol.roundCount} ${protocol.roundCount === 1 ? "round" : "rounds"} · ${formatDuration(result.metrics.totalSessionSeconds)}`;
  }

  return `${protocolLabel} · ${formatDuration(result.metrics.totalSessionSeconds)}`;
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${Math.round(totalSeconds)} sec`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function formatDistance(metres: number) {
  return metres >= 1000
    ? `${(metres / 1000).toLocaleString([], { maximumFractionDigits: 2 })} km`
    : `${metres.toLocaleString([], { maximumFractionDigits: 1 })} m`;
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.xl,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    maxHeight: "84%",
    maxWidth: 520,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  stateContainer: {
    alignItems: "center",
    flexShrink: 1,
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 240,
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
  templateScroll: {
    flexShrink: 1,
  },
  templateList: {
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
    paddingTop: 0,
  },
  templateRow: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 64,
    padding: tokens.spacing.sm,
  },
  activityIcon: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  templateText: {
    flex: 1,
    minWidth: 0,
  },
  templateTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
  templateDetails: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  adaptationBadge: {
    borderRadius: tokens.radius.pill,
    maxWidth: 96,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  adaptationText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    textAlign: "center",
  },
  undeterminedText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    maxWidth: 84,
    textAlign: "center",
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
    minWidth: 88,
    paddingHorizontal: tokens.spacing.sm,
  },
  buttonText: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
  },
});
