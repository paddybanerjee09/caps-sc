import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSQLiteContext } from "expo-sqlite";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  conditioningActivityOptions,
  conditioningAdaptations,
  conditioningProtocolLabels,
} from "../constants/conditioning";
import {
  getAthleteConditioningBaselines,
  listConditioningTemplates,
} from "../data/conditioningRepository";
import { useAppState, type UnitSystem } from "../state/AppStateContext";
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
import {
  formatDistanceInput,
  getDistanceUnitLabel,
  getShortDistanceUnitLabel,
} from "../utils/conditioningMeasurements";
import { AppModalFrame } from "./AppModalFrame";
import { CollectionStateView } from "./CollectionStateView";
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
  if (!visible) {
    return null;
  }

  return (
    <ConditioningSessionsContent
      onClose={onClose}
      onTemplateSelected={onTemplateSelected}
    />
  );
}

function ConditioningSessionsContent({
  onClose,
  onTemplateSelected,
}: Omit<ConditioningSessionsProps, "visible">) {
  const db = useSQLiteContext();
  const { unitSettings } = useAppState();
  const { theme } = useAppTheme();
  const [baselines, setBaselines] = useState<AthleteConditioningBaselines>(
    emptyBaselines,
  );
  const [templates, setTemplates] = useState<StoredConditioningTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    void Promise.all([
        listConditioningTemplates(db),
        getAthleteConditioningBaselines(db),
      ])
      .then(([nextTemplates, nextBaselines]) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setTemplates(nextTemplates);
        setBaselines(nextBaselines);
        setSelectedTemplateId(null);
        setError(null);
      })
      .catch(() => {
        if (requestId === requestIdRef.current) {
          setError("Couldn't load saved sessions.");
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [db, loadRevision]);

  function retryLoading() {
    setLoading(true);
    setError(null);
    setLoadRevision((currentRevision) => currentRevision + 1);
  }

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
    <AppModalFrame visible width="wide" onClose={closeModal}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Saved Sessions
        </Text>
      </View>

      {loading ? (
        <CollectionStateView
          label="Loading saved conditioning sessions"
          variant="loading"
        />
      ) : error ? (
        <CollectionStateView
          actionLabel="Retry loading saved conditioning sessions"
          label={error}
          variant="error"
          onAction={retryLoading}
        />
      ) : templatePresentations.length === 0 ? (
        <CollectionStateView
          label="No saved conditioning sessions"
          variant="empty"
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.templateList}
          data={templatePresentations}
          keyExtractor={({ template }) => String(template.id)}
          nestedScrollEnabled
          renderItem={({ item: { score, template } }) => {
            const selected = template.id === selectedTemplateId;
            const activity = getActivityPresentation(template.activity);
            const adaptation =
              score.status === "scored"
                ? conditioningAdaptations[score.primaryAdaptation]
                : null;

            return (
              <PressOpacity
                accessibilityLabel={`${template.title}, ${activity.label}, ${getConditioningProtocolSummary(template.protocol, unitSettings.distance)}${adaptation ? `, primary adaptation ${adaptation.label}` : ", adaptation undetermined"}${selected ? ", selected" : ""}`}
                accessibilityRole="button"
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
                    numberOfLines={4}
                    style={[
                      styles.templateDetails,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {activity.label} ·{" "}
                    {getConditioningProtocolSummary(
                      template.protocol,
                      unitSettings.distance,
                    )}
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
          }}
          showsVerticalScrollIndicator={false}
          style={styles.templateScroll}
        />
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
          <Text style={[styles.buttonText, { color: theme.colors.tertiary }]}>
            Log Session
          </Text>
        </PressOpacity>
      </View>
    </AppModalFrame>
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

export function getConditioningProtocolSummary(
  protocol: ConditioningProtocol,
  distanceUnit: UnitSystem,
) {
  const protocolLabel = getProtocolLabel(protocol.type);
  const result = evaluateConditioningProtocol(protocol);

  if (!result.ok) {
    return protocolLabel;
  }

  if (protocol.type === "intervals") {
    const intervalStructure = `${protocol.intervalCount} ${protocol.intervalCount === 1 ? "interval" : "intervals"} × ${protocol.roundCount} ${protocol.roundCount === 1 ? "round" : "rounds"}`;
    const workSummary =
      protocol.work.mode === "time"
        ? `Time work: ${formatDuration(protocol.work.durationSeconds)} per interval`
        : `Distance work: ${formatShortDistance(protocol.work.distanceMeters, distanceUnit)} per interval`;
    const restSummary = `rests: ${formatDuration(protocol.restBetweenIntervalsSeconds)} between intervals, ${formatDuration(protocol.restBetweenRoundsSeconds)} between rounds`;
    const totalSummary =
      protocol.work.mode === "time"
        ? ` · ${formatDuration(result.metrics.totalSessionSeconds)} total`
        : "";
    return `${protocolLabel} · ${workSummary} · ${intervalStructure} · ${restSummary}${totalSummary}`;
  }

  if (protocol.type === "circuit") {
    return `${protocolLabel} · ${protocol.roundCount} ${protocol.roundCount === 1 ? "round" : "rounds"} · ${formatDuration(result.metrics.totalSessionSeconds)}`;
  }

  const distanceSummary =
    protocol.distanceMeters === null
      ? ""
      : ` · ${formatDistance(protocol.distanceMeters, distanceUnit)}`;

  return `${protocolLabel} · ${formatDuration(result.metrics.totalSessionSeconds)}${distanceSummary}`;
}

function getProtocolLabel(type: ConditioningProtocol["type"]) {
  return conditioningProtocolLabels[type];
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}

function formatDistance(metres: number, unit: UnitSystem) {
  return `${formatDistanceInput(metres, unit)} ${getDistanceUnitLabel(unit)}`;
}

function formatShortDistance(metres: number, unit: UnitSystem) {
  return `${formatDistanceInput(metres, unit, "short")} ${getShortDistanceUnitLabel(unit)}`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
    paddingBottom: 0,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  templateScroll: {
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: 420,
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
