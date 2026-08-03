import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  conditioningScoringDisclaimer,
} from "../constants/conditioning";
import { getConditioningSessionByTimelineEntryId } from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type {
  ConditioningProtocol,
  SnapshottedConditioningIntensity,
  StoredConditioningSession,
} from "../types/conditioning";
import { ConditioningAdaptationModal } from "./ConditioningAdaptationModal";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

type DetailState = "loading" | "error" | "not-found" | "content";
type DetailStep = "session" | "adaptations";

type ConditioningSessionDetailModalProps = {
  onClose: () => void;
  timelineEntryId: number | null;
  visible: boolean;
};

export function ConditioningSessionDetailModal({
  onClose,
  timelineEntryId,
  visible,
}: ConditioningSessionDetailModalProps) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const requestId = useRef(0);
  const [detailState, setDetailState] = useState<DetailState>("loading");
  const [detailStep, setDetailStep] = useState<DetailStep>("session");
  const [session, setSession] = useState<StoredConditioningSession | null>(null);

  const loadSession = useCallback(async () => {
    if (!visible || timelineEntryId === null) {
      return;
    }

    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setDetailState("loading");
    setSession(null);

    try {
      const storedSession = await getConditioningSessionByTimelineEntryId(
        db,
        timelineEntryId,
      );

      if (requestId.current !== currentRequestId) {
        return;
      }

      setSession(storedSession);
      setDetailState(storedSession ? "content" : "not-found");
    } catch {
      if (requestId.current === currentRequestId) {
        setDetailState("error");
      }
    }
  }, [db, timelineEntryId, visible]);

  useEffect(() => {
    setDetailStep("session");

    if (!visible) {
      requestId.current += 1;
      setSession(null);
      setDetailState("loading");
      return;
    }

    if (timelineEntryId === null) {
      requestId.current += 1;
      setSession(null);
      setDetailState("not-found");
      return;
    }

    void loadSession();

    return () => {
      requestId.current += 1;
    };
  }, [loadSession, timelineEntryId, visible]);

  function closeModal() {
    requestId.current += 1;
    setDetailStep("session");
    setSession(null);
    setDetailState("loading");
    onClose();
  }

  const primaryPresentation = session
    ? conditioningAdaptations[session.score.primaryAdaptation]
    : null;
  const sessionMatchesSelection =
    session?.timelineEntryId === timelineEntryId;

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={visible}
    >
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[styles.header, { borderBottomColor: theme.colors.border }]}
          >
            <View style={styles.headerSpacer} />
            <Text
              numberOfLines={1}
              style={[styles.headerTitle, { color: theme.colors.text }]}
            >
              Conditioning Session
            </Text>
            <PressOpacity
              accessibilityLabel="Close conditioning session details"
              onPress={closeModal}
              style={styles.closeButton}
            >
              <Ionicons color={theme.colors.text} name="close" size={24} />
            </PressOpacity>
          </View>

          {detailStep === "adaptations" && sessionMatchesSelection ? (
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.adaptationBody}
              showsVerticalScrollIndicator={false}
            >
              <ConditioningAdaptationModal
                onBack={() => setDetailStep("session")}
                result={session.score}
              />
            </ScrollView>
          ) : detailState === "loading" ||
            (detailState === "content" && !sessionMatchesSelection) ? (
            <StateView
              message="Loading conditioning session"
              textColor={theme.colors.textMuted}
            >
              <ActivityIndicator color={theme.colors.tertiary} />
            </StateView>
          ) : detailState === "error" ? (
            <StateView
              message="Couldn’t load this conditioning session"
              textColor={theme.colors.text}
            >
              <PressOpacity
                accessibilityLabel="Retry loading conditioning session"
                onPress={() => void loadSession()}
                style={[
                  styles.stateButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[styles.stateButtonText, { color: theme.colors.text }]}
                >
                  Retry
                </Text>
              </PressOpacity>
            </StateView>
          ) : detailState === "not-found" || !sessionMatchesSelection ? (
            <StateView
              message="This conditioning session is no longer available."
              textColor={theme.colors.textMuted}
            />
          ) : (
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.titleBlock}>
                <Text style={[styles.sessionTitle, { color: theme.colors.text }]}>
                  {session.title}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <Ionicons
                    color={theme.colors.text}
                    name="checkmark-circle-outline"
                    size={15}
                  />
                  <Text style={[styles.statusText, { color: theme.colors.text }]}>
                    Completed
                  </Text>
                </View>
              </View>

              <DetailSection title="Session">
                <DetailRow
                  label="Date"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatDate(session.startAt)}
                />
                <DetailRow
                  label="Time"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatTimeRange(session.startAt, session.endAt)}
                />
                <DetailRow
                  label="Duration"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatDuration(
                    Math.max(0, Math.round((session.endAt - session.startAt) / 1000)),
                  )}
                />
                <DetailRow
                  label="Activity"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={getActivityLabel(session.activity)}
                />
                <DetailRow
                  label="Protocol"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={getProtocolLabel(session.protocol.type)}
                />
              </DetailSection>

              <ProtocolDetails
                mutedColor={theme.colors.textMuted}
                protocol={session.protocol}
                surfaceColor={theme.colors.surfaceMuted}
                textColor={theme.colors.text}
              />

              <DetailSection title="Calculated totals">
                <DetailRow
                  label="Work"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatDuration(session.metrics.totalWorkSeconds)}
                />
                <DetailRow
                  label="Rest"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatDuration(session.metrics.totalRestSeconds)}
                />
                <DetailRow
                  label="Work-to-rest"
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                  value={formatWorkToRest(session.metrics.workToRestRatio)}
                />
                {session.metrics.totalDistanceMeters !== null ? (
                  <DetailRow
                    label="Distance"
                    mutedColor={theme.colors.textMuted}
                    textColor={theme.colors.text}
                    value={formatDistance(session.metrics.totalDistanceMeters)}
                  />
                ) : null}
                {session.metrics.estimatedWorkDuration ? (
                  <Text
                    style={[styles.helperText, { color: theme.colors.textMuted }]}
                  >
                    Work time is estimated from the overall elapsed duration and
                    recorded rests.
                  </Text>
                ) : null}
              </DetailSection>

              <DetailSection title="Intensity">
                <IntensityDetails
                  intensity={session.intensity}
                  mutedColor={theme.colors.textMuted}
                  textColor={theme.colors.text}
                />
              </DetailSection>

              <DetailSection title="Notes">
                <Text
                  style={[
                    styles.notes,
                    {
                      color: session.notes
                        ? theme.colors.text
                        : theme.colors.textMuted,
                    },
                  ]}
                >
                  {session.notes ?? "No notes"}
                </Text>
              </DetailSection>

              {primaryPresentation ? (
                <DetailSection title="Estimated adaptation">
                  <View style={styles.adaptationSummary}>
                    <View
                      accessibilityLabel={`Primary adaptation, ${primaryPresentation.label}`}
                      accessible
                      style={[
                        styles.adaptationBadge,
                        { backgroundColor: primaryPresentation.color },
                      ]}
                    >
                      <Text
                        style={[
                          styles.adaptationBadgeText,
                          { color: primaryPresentation.contentColor },
                        ]}
                      >
                        {primaryPresentation.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.evidenceText,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {session.score.evidence === "full"
                        ? "Full scoring evidence"
                        : "Limited scoring evidence"}
                    </Text>
                  </View>

                  <PressOpacity
                    accessibilityLabel="View all conditioning adaptation scores"
                    onPress={() => setDetailStep("adaptations")}
                    style={[
                      styles.scoreButton,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreButtonText,
                        { color: theme.colors.text },
                      ]}
                    >
                      View all scores
                    </Text>
                    <Ionicons
                      color={theme.colors.text}
                      name="chevron-forward"
                      size={18}
                    />
                  </PressOpacity>

                  <Text
                    style={[
                      styles.disclaimer,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {conditioningScoringDisclaimer}
                  </Text>
                </DetailSection>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

type StateViewProps = {
  children?: ReactNode;
  message: string;
  textColor: string;
};

function StateView({ children, message, textColor }: StateViewProps) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      {children}
      <Text style={[styles.stateText, { color: textColor }]}>{message}</Text>
    </View>
  );
}

type DetailSectionProps = {
  children: ReactNode;
  title: string;
};

function DetailSection({ children, title }: DetailSectionProps) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

type DetailRowProps = {
  label: string;
  mutedColor: string;
  textColor: string;
  value: string;
};

function DetailRow({ label, mutedColor, textColor, value }: DetailRowProps) {
  return (
    <View
      accessibilityLabel={`${label}, ${value}`}
      accessible
      style={styles.detailRow}
    >
      <Text style={[styles.detailLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

type ProtocolDetailsProps = {
  mutedColor: string;
  protocol: ConditioningProtocol;
  surfaceColor: string;
  textColor: string;
};

function ProtocolDetails({
  mutedColor,
  protocol,
  surfaceColor,
  textColor,
}: ProtocolDetailsProps) {
  if (protocol.type === "continuous") {
    return (
      <DetailSection title="Continuous work">
        <DetailRow
          label="Duration"
          mutedColor={mutedColor}
          textColor={textColor}
          value={formatDuration(protocol.durationSeconds)}
        />
        {protocol.distanceMeters !== null ? (
          <DetailRow
            label="Distance"
            mutedColor={mutedColor}
            textColor={textColor}
            value={formatDistance(protocol.distanceMeters)}
          />
        ) : null}
      </DetailSection>
    );
  }

  if (protocol.type === "time_intervals") {
    return (
      <DetailSection title="Time intervals">
        <DetailRow
          label="Work interval"
          mutedColor={mutedColor}
          textColor={textColor}
          value={formatDuration(protocol.workSeconds)}
        />
        <IntervalStructureRows
          mutedColor={mutedColor}
          protocol={protocol}
          textColor={textColor}
        />
      </DetailSection>
    );
  }

  if (protocol.type === "distance_intervals") {
    return (
      <DetailSection title="Distance intervals">
        <DetailRow
          label="Work interval"
          mutedColor={mutedColor}
          textColor={textColor}
          value={formatDistance(protocol.workDistanceMeters)}
        />
        <DetailRow
          label="Overall elapsed time"
          mutedColor={mutedColor}
          textColor={textColor}
          value={formatDuration(protocol.elapsedDurationSeconds)}
        />
        <IntervalStructureRows
          mutedColor={mutedColor}
          protocol={protocol}
          textColor={textColor}
        />
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Circuit">
      <DetailRow
        label="Rounds"
        mutedColor={mutedColor}
        textColor={textColor}
        value={String(protocol.roundCount)}
      />
      <DetailRow
        label="Rest between stations"
        mutedColor={mutedColor}
        textColor={textColor}
        value={formatDuration(protocol.restBetweenStationsSeconds)}
      />
      <DetailRow
        label="Rest between rounds"
        mutedColor={mutedColor}
        textColor={textColor}
        value={formatDuration(protocol.restBetweenRoundsSeconds)}
      />
      <Text style={[styles.stationHeading, { color: mutedColor }]}>Stations</Text>
      {protocol.stations.map((station) => (
        <View
          accessibilityLabel={`Station ${station.position + 1}, ${station.name}, ${formatDuration(station.workSeconds)}`}
          accessible
          key={`${station.position}-${station.name}`}
          style={[styles.stationRow, { backgroundColor: surfaceColor }]}
        >
          <Text style={[styles.stationPosition, { color: mutedColor }]}>
            {station.position + 1}
          </Text>
          <Text style={[styles.stationName, { color: textColor }]}>
            {station.name}
          </Text>
          <Text style={[styles.stationDuration, { color: textColor }]}>
            {formatDuration(station.workSeconds)}
          </Text>
        </View>
      ))}
    </DetailSection>
  );
}

type IntervalProtocol = Extract<
  ConditioningProtocol,
  { type: "time_intervals" | "distance_intervals" }
>;

type IntervalStructureRowsProps = {
  mutedColor: string;
  protocol: IntervalProtocol;
  textColor: string;
};

function IntervalStructureRows({
  mutedColor,
  protocol,
  textColor,
}: IntervalStructureRowsProps) {
  return (
    <>
      <DetailRow
        label="Repetitions per set"
        mutedColor={mutedColor}
        textColor={textColor}
        value={String(protocol.repetitionsPerSet)}
      />
      <DetailRow
        label="Sets"
        mutedColor={mutedColor}
        textColor={textColor}
        value={String(protocol.setCount)}
      />
      <DetailRow
        label="Rest between repetitions"
        mutedColor={mutedColor}
        textColor={textColor}
        value={formatDuration(protocol.restBetweenRepetitionsSeconds)}
      />
      <DetailRow
        label="Rest between sets"
        mutedColor={mutedColor}
        textColor={textColor}
        value={formatDuration(protocol.restBetweenSetsSeconds)}
      />
    </>
  );
}

type IntensityDetailsProps = {
  intensity: SnapshottedConditioningIntensity;
  mutedColor: string;
  textColor: string;
};

function IntensityDetails({
  intensity,
  mutedColor,
  textColor,
}: IntensityDetailsProps) {
  if (intensity === null) {
    return (
      <Text style={[styles.helperText, { color: mutedColor }]}>Not recorded</Text>
    );
  }

  if (intensity.method === "rpe") {
    return (
      <DetailRow
        label="Session RPE"
        mutedColor={mutedColor}
        textColor={textColor}
        value={`${formatNumber(intensity.value)} / 10`}
      />
    );
  }

  if (intensity.method === "heart_rate") {
    return (
      <>
        <DetailRow
          label="Session heart rate"
          mutedColor={mutedColor}
          textColor={textColor}
          value={`${formatNumber(intensity.valueBpm)} bpm`}
        />
        <DetailRow
          label="Maximum heart rate snapshot"
          mutedColor={mutedColor}
          textColor={textColor}
          value={`${formatNumber(intensity.maxHeartRateBpm)} bpm`}
        />
      </>
    );
  }

  if (intensity.reference === "threshold_pace") {
    return (
      <>
        <DetailRow
          label="Session pace"
          mutedColor={mutedColor}
          textColor={textColor}
          value={`${formatPace(intensity.paceSecondsPerKm)} /km`}
        />
        <DetailRow
          label="Threshold pace snapshot"
          mutedColor={mutedColor}
          textColor={textColor}
          value={`${formatPace(intensity.thresholdPaceSecondsPerKm)} /km`}
        />
      </>
    );
  }

  return (
    <>
      <DetailRow
        label="Session speed"
        mutedColor={mutedColor}
        textColor={textColor}
        value={`${formatNumber(intensity.speedKph)} km/h`}
      />
      <DetailRow
        label="Maximum aerobic speed snapshot"
        mutedColor={mutedColor}
        textColor={textColor}
        value={`${formatNumber(intensity.maximumAerobicSpeedKph)} km/h`}
      />
    </>
  );
}

function getActivityLabel(activity: StoredConditioningSession["activity"]) {
  return (
    conditioningActivityOptions.find((option) => option.key === activity)
      ?.label ?? activity
  );
}

function getProtocolLabel(type: ConditioningProtocol["type"]) {
  return (
    conditioningProtocolOptions.find((option) => option.key === type)?.label ??
    type
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

function formatTimeRange(startAt: number, endAt: number) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startTime = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (start.toDateString() === end.toDateString()) {
    return `${startTime} – ${endTime}`;
  }

  return `${startTime} – ${end.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })}, ${endTime}`;
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

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${formatNumber(meters / 1000)} km`;
  }

  return `${formatNumber(meters)} m`;
}

function formatPace(secondsPerKm: number) {
  const roundedSeconds = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return value.toLocaleString([], { maximumFractionDigits: 2 });
}

function formatWorkToRest(ratio: number | null) {
  if (ratio === null) {
    return "No recorded rest";
  }

  return `${formatNumber(ratio)} : 1`;
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  modal: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    maxHeight: "88%",
    maxWidth: 480,
    overflow: "hidden",
    width: "100%",
  },
  header: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: tokens.spacing.sm,
  },
  headerSpacer: {
    height: 44,
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
    textAlign: "center",
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  body: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  adaptationBody: {
    flexGrow: 1,
  },
  state: {
    alignItems: "center",
    gap: tokens.spacing.md,
    justifyContent: "center",
    minHeight: 220,
    padding: tokens.spacing.xl,
  },
  stateText: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  stateButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: tokens.spacing.lg,
  },
  stateButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  titleBlock: {
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
    textAlign: "center",
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    gap: tokens.spacing.xs,
    minHeight: 28,
    paddingHorizontal: tokens.spacing.sm,
  },
  statusText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  section: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  sectionTitle: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "space-between",
    minHeight: 22,
  },
  detailLabel: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  detailValue: {
    flex: 1.35,
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "right",
  },
  helperText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  notes: {
    fontSize: tokens.typography.body.fontSize,
    lineHeight: tokens.typography.body.lineHeight,
  },
  stationHeading: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
    marginTop: tokens.spacing.xs,
  },
  stationRow: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    flexDirection: "row",
    gap: tokens.spacing.sm,
    minHeight: 44,
    paddingHorizontal: tokens.spacing.sm,
  },
  stationPosition: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
    width: 20,
  },
  stationName: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  stationDuration: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    lineHeight: tokens.typography.label.lineHeight,
  },
  adaptationSummary: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  adaptationBadge: {
    borderRadius: tokens.radius.pill,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: tokens.spacing.md,
  },
  adaptationBadgeText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  evidenceText: {
    flexShrink: 1,
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  scoreButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.md,
  },
  scoreButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
  },
});
