import { formatDisplayDate } from "../../utils/displayDate";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  ErrorText,
  ScreenHeading,
  ConditioningFooter,
} from "../../components/conditioning/ConditioningFields";
import { RouteMap } from "../../components/conditioning/RouteMap";
import { deviceTimeZone, formatLocalDate } from "../../conditioning/dates";
import { draftFromTemplate } from "../../conditioning/drafts";
import { formatClock, formatName } from "../../conditioning/summaries";
import { messageFromUnknown } from "../../conditioning/validation";
import { UNAVAILABLE_METRIC } from "../../conditioning/units";
import {
  cancelPlannedConditioningSession,
  discardConditioningRecording,
  getConditioningSession,
  listConditioningLocationPoints,
  startConditioningSession,
  type ConditioningSessionRecord,
} from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { WorkoutSnapshot } from "../../conditioning/types";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function ConditioningSessionDetailScreen({
  sessionId,
}: {
  sessionId: string;
}) {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [session, setSession] = useState<ConditioningSessionRecord | null>(null);
  const [route, setRoute] = useState<
    { latitude: number; longitude: number; segmentId: string | null }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    void getConditioningSession(db, ownerId, sessionId).then((loaded) => {
      if (!cancelled) {
        setSession(loaded);
      }
    });
    void listConditioningLocationPoints(db, ownerId, sessionId).then(
      (points) => {
        if (!cancelled) {
          setRoute(
            points
              .filter((point) => point.acceptance === "accepted")
              .map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
                segmentId: point.segmentId,
              })),
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, ownerId, sessionId, workspace.revision]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    }
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading
        title={session?.title ?? "Session"}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {session ? (
          <>
            {/* Card 1: Session Identity & Status */}
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
                <Text
                  style={[
                    styles.cardHeaderLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {formatName(session.format).toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: theme.colors.surfaceMuted,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: theme.colors.tertiary },
                    ]}
                  >
                    {session.status.replaceAll("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.dateText, { color: theme.colors.text }]}>
                {session.performedLocalDate || session.scheduledLocalDate ? formatDisplayDate((session.performedLocalDate ?? session.scheduledLocalDate)!) : "--"}
                {session.scheduledLocalStartTime
                  ? ` · ${session.scheduledLocalStartTime}`
                  : ""}
              </Text>
              {session.notes ? (
                <Text style={[styles.notes, { color: theme.colors.textMuted }]}>
                  {session.notes}
                </Text>
              ) : null}
            </View>

            {/* Card 2: Telemetry Grid */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardHeaderLabel,
                  { color: theme.colors.textMuted },
                ]}
              >
                SESSION METRICS
              </Text>
              <View style={styles.metricGrid}>
                <MetricTile
                  label="DISTANCE"
                  value={
                    session.distanceMeters === null
                      ? UNAVAILABLE_METRIC
                      : `${session.distanceMeters.toFixed(0)} m`
                  }
                />
                <MetricTile
                  label="ACTIVE TIME"
                  value={
                    session.activeSeconds === null
                      ? UNAVAILABLE_METRIC
                      : formatClock(session.activeSeconds)
                  }
                />
                <MetricTile
                  label="TARGET RPE"
                  value={
                    session.targetRpe === null
                      ? UNAVAILABLE_METRIC
                      : String(session.targetRpe)
                  }
                />
                <MetricTile
                  label="SESSION RPE"
                  value={
                    session.sessionRpe === null
                      ? UNAVAILABLE_METRIC
                      : String(session.sessionRpe)
                  }
                />
              </View>
            </View>

            {/* Card 3: Route Map (if recorded) */}
            {route.length > 0 ? (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardHeaderLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  RECORDED GPS ROUTE
                </Text>
                <RouteMap points={route} />
              </View>
            ) : null}

          </>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>Loading session</Text>
        )}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <ConditioningFooter>
        {session ? <>
              {session.status === "completed" ||
              session.status === "ended_early" ? (
                <ActionButton
                  label="Estimated training stimulus"
                  onPress={() =>
                    workspace.push({
                      key: `emphasis-${session.id}`,
                      name: "emphasis",
                      sessionId: session.id,
                    })
                  }
                  tone="secondary"
                />
              ) : null}
              {session.status === "planned" && session.format !== "free" ? (
                <View style={styles.actions}>
                  <ActionButton
                    label="Start"
                    onPress={() =>
                      void run(async () => {
                        const started = await startConditioningSession(
                          db,
                          ownerId!,
                          {
                            performedAt: Date.now(),
                            planSessionId: session.id,
                            timezone: deviceTimeZone(),
                          },
                        );
                        workspace.bumpRevision();
                        bumpTimeline();
                        workspace.pop();
                        workspace.push({
                          key: `runner-${started.id}`,
                          name: "runner",
                          sessionId: started.id,
                        });
                      })
                    }
                  />
                  <ActionButton
                    label="Edit"
                    onPress={() => openPlanEditor(session, workspace)}
                    tone="secondary"
                  />
                  <ActionButton
                    label="Estimated training stimulus"
                    onPress={() =>
                      workspace.push({
                        key: `emphasis-${session.id}`,
                        name: "emphasis",
                        sessionId: session.id,
                      })
                    }
                    tone="secondary"
                  />
                  <ActionButton
                    label="Log"
                    onPress={() => openLog(session, workspace)}
                    tone="secondary"
                  />
                  <ActionButton
                    label="Cancel plan"
                    onPress={() =>
                      workspace.requestConfirm({
                        confirmLabel: "Cancel plan",
                        message: "This removes the plan from the calendar.",
                        onConfirm: () =>
                          void run(async () => {
                            await cancelPlannedConditioningSession(
                              db,
                              ownerId!,
                              session.id,
                            );
                            workspace.bumpRevision();
                            bumpTimeline();
                            workspace.pop();
                          }),
                        title: "Cancel this plan?",
                      })
                    }
                    tone="quiet"
                  />
                </View>
              ) : null}
              {session.status === "in_progress" ||
              session.status === "finished_draft" ? (
                <View style={styles.actions}>
                  {session.status === "in_progress" ? (
                    <ActionButton
                      label="Resume"
                      onPress={() => {
                        if (session.format === "free") {
                          workspace.push({
                            key: `free-${session.id}`,
                            name: "free",
                          });
                          return;
                        }
                        workspace.push({
                          key: `runner-${session.id}`,
                          name: "runner",
                          sessionId: session.id,
                        });
                      }}
                    />
                  ) : null}
                  <ActionButton
                    label="Discard"
                    onPress={() =>
                      workspace.confirmDiscard(() =>
                        void run(async () => {
                          await discardConditioningRecording(
                            db,
                            ownerId!,
                            session.id,
                          );
                          workspace.bumpRevision();
                          bumpTimeline();
                          workspace.pop();
                        }),
                      )
                    }
                    tone="quiet"
                  />
                </View>
              ) : null}
        </> : null}
      </ConditioningFooter>
    </View>
  );
}

function openPlanEditor(
  session: ConditioningSessionRecord,
  workspace: ReturnType<typeof useConditioningWorkspace>,
) {
  if (session.format === "free") {
    return;
  }
  const draft = draftFromTemplate(
    snapshotConfig(session.snapshot),
    session.scheduledLocalDate ?? formatLocalDate(new Date()),
  );
  if (session.scheduledLocalStartTime) {
    const [hour, minute] = session.scheduledLocalStartTime
      .split(":")
      .map(Number);
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    draft.scheduledTime = time;
  }
  workspace.openEditor({
    draft,
    format: session.format,
    planSessionId: session.id,
    savedSnapshot: JSON.stringify(draft),
    templateId: session.templateId,
  });
}

function openLog(
  session: ConditioningSessionRecord,
  workspace: ReturnType<typeof useConditioningWorkspace>,
) {
  workspace.setLogRequest({
    date: formatLocalDate(new Date()),
    planSessionId: session.id,
    snapshot: session.snapshot,
    templateId: session.templateId,
    time: new Date(),
  });
  workspace.push({
    key: `log-${session.id}`,
    name: "log",
    planSessionId: session.id,
  });
}

function snapshotConfig(snapshot: WorkoutSnapshot) {
  return {
    circuit: snapshot.circuit,
    format:
      snapshot.format === "free" ? ("circuit" as const) : snapshot.format,
    interval: snapshot.interval,
    notes: snapshot.notes,
    sprint: snapshot.sprint,
    targetRpe: snapshot.targetRpe,
    title: snapshot.title,
    version: snapshot.version,
  };
}

function MetricTile({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={[
        styles.metricTile,
        {
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: theme.colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
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
  statusBadge: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  dateText: {
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  notes: {
    fontSize: 13,
    lineHeight: 18,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
  metricTile: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: 2,
    minWidth: "47%",
    flex: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 18,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  actions: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.spacing.sm,
  },
});
