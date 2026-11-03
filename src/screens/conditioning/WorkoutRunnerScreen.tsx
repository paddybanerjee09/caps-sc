import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import {
  ActionButton,
  ErrorText,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import { createId } from "../../conditioning/ids";
import { formatClock } from "../../conditioning/summaries";
import {
  completeCurrentWork,
  createReadyRunner,
  currentPhase,
  endRunnerEarly,
  isTimerPhase,
  occurrencesFromRunner,
  pauseRunner,
  projectedTotals,
  reconcileRunner,
  remainingWholeSeconds,
  restoreAfterProcessTermination,
  resumeRunner,
  startRunner,
  type RunnerState,
} from "../../conditioning/runner";
import { messageFromUnknown } from "../../conditioning/validation";
import { UNAVAILABLE_METRIC } from "../../conditioning/units";
import {
  discardConditioningRecording,
  finishConditioningSession,
  getConditioningRunnerState,
  getConditioningSession,
  saveConditioningRunnerState,
  saveConditioningSession,
  type ConditioningSessionRecord,
} from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import {
  feedbackConfirm,
  feedbackCountdownTick,
  feedbackPhaseCue,
  feedbackStep,
} from "../../utils/feedback";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;
const processToken = createId();
const keepAwakeTag = "conditioning-runner";
const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function WorkoutRunnerScreen({ sessionId }: { sessionId: string }) {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [session, setSession] = useState<ConditioningSessionRecord | null>(null);
  const [runner, setRunner] = useState<RunnerState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRpe, setReviewRpe] = useState<number | null>(null);
  const runnerRef = useRef<RunnerState | null>(null);
  const cueRef = useRef<string | null>(null);
  const countdownKeyRef = useRef<string | null>(null);

  useEffect(() => {
    runnerRef.current = runner;
  }, [runner]);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = await getConditioningSession(db, ownerId, sessionId);
      if (!loaded || cancelled) {
        return;
      }
      setSession(loaded);
      const stored = await getConditioningRunnerState(db, ownerId, sessionId);
      const timestamp = Date.now();
      let next: RunnerState;
      if (!stored) {
        next = reconcileRunner(
          startRunner(
            createReadyRunner(loaded.snapshot.phases, timestamp),
            loaded.performedAt ?? timestamp,
            processToken,
          ),
          timestamp,
        ).state;
      } else {
        const parsed = JSON.parse(stored.stateJson) as RunnerState;
        next =
          parsed.processToken === processToken
            ? reconcileRunner(parsed, timestamp).state
            : { ...restoreAfterProcessTermination(parsed), processToken };
      }
      if (!cancelled) {
        setRunner(next);
        setReviewing(next.status === "finished" || next.status === "ended_early");
        await saveConditioningRunnerState(
          db,
          ownerId,
          sessionId,
          JSON.stringify(next),
        );
      }
    })().catch((caught) => setError(messageFromUnknown(caught)));
    return () => {
      cancelled = true;
    };
  }, [db, ownerId, sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = runnerRef.current;
      const timestamp = Date.now();
      setNow(timestamp);
      if (!current || !ownerId) {
        return;
      }
      const result = reconcileRunner(current, timestamp);
      const nextState = result.state;
      const rem = remainingWholeSeconds(nextState, timestamp);
      if (
        (nextState.status === "running" || nextState.status === "preparing") &&
        rem !== null &&
        rem >= 1 &&
        rem <= 3
      ) {
        const tickKey = `${nextState.status}:${nextState.phaseIndex}:${rem}`;
        if (countdownKeyRef.current !== tickKey) {
          countdownKeyRef.current = tickKey;
          feedbackCountdownTick();
        }
      }

      if (result.state !== current) {
        runnerRef.current = result.state;
        setRunner(result.state);
        void saveConditioningRunnerState(
          db,
          ownerId,
          sessionId,
          JSON.stringify(result.state),
        );
        if (result.cuePhaseId && result.cuePhaseId !== cueRef.current) {
          cueRef.current = result.cuePhaseId;
          feedbackPhaseCue();
        }
        if (result.state.status === "finished") {
          setReviewing(true);
          void finishConditioningSession(db, ownerId, sessionId, {
            activeSeconds:
              (result.state.totals.workMs +
                result.state.totals.prescribedRecoveryMs) /
              1000,
            elapsedSeconds: null,
            finishedAt: timestamp,
            occurrences: occurrencesFromRunner(result.state),
          }).catch((caught) => setError(messageFromUnknown(caught)));
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [db, ownerId, sessionId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const current = runnerRef.current;
      if (!current || !ownerId) {
        return;
      }
      if (nextState === "background") {
        const stamped = { ...current, lastPersistedAt: Date.now() };
        runnerRef.current = stamped;
        void saveConditioningRunnerState(
          db,
          ownerId,
          sessionId,
          JSON.stringify(stamped),
        );
      }
      if (nextState === "active") {
        const result = reconcileRunner(current, Date.now());
        runnerRef.current = result.state;
        setRunner(result.state);
        if (result.cuePhaseId) {
          cueRef.current = result.cuePhaseId;
        }
      }
    });
    return () => subscription.remove();
  }, [db, ownerId, sessionId]);

  useEffect(() => {
    const active =
      runner?.status === "running" || runner?.status === "preparing";
    if (active) {
      void activateKeepAwakeAsync(keepAwakeTag);
    } else {
      deactivateKeepAwake(keepAwakeTag);
    }
    return () => {
      deactivateKeepAwake(keepAwakeTag);
    };
  }, [runner?.status]);

  async function update(next: RunnerState) {
    if (!ownerId) {
      return;
    }
    runnerRef.current = next;
    setRunner(next);
    await saveConditioningRunnerState(
      db,
      ownerId,
      sessionId,
      JSON.stringify(next),
    );
  }

  const phase = runner ? currentPhase(runner) : null;
  const remaining = runner ? remainingWholeSeconds(runner, now) : null;
  const totals = runner ? projectedTotals(runner, now) : null;
  const activeText = readableTextColor(theme.colors.tertiary);

  async function finishReview(next: RunnerState) {
    if (!ownerId || !session) {
      return;
    }
    await update(next);
    await finishConditioningSession(db, ownerId, sessionId, {
      activeSeconds:
        (next.totals.workMs + next.totals.prescribedRecoveryMs) / 1000,
      elapsedSeconds: session.performedAt
        ? (Date.now() - session.performedAt) / 1000
        : null,
      finishedAt: Date.now(),
      occurrences: occurrencesFromRunner(next),
    });
    setReviewing(true);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading
        onBack={workspace.pop}
        title={session?.title ?? "Workout"}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {runner?.uncertainInterruption ? (
          <View
            style={[
              styles.alertCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.tertiary,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
              This session was interrupted. Confirmed progress was kept, and the
              gap was not counted as work.
            </Text>
          </View>
        ) : null}

        {/* Card 1: Live Timer & Phase Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor:
                phase?.type === "work"
                  ? theme.colors.tertiary
                  : theme.colors.borderStrong,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              {runner?.status === "preparing"
                ? "PREPARATION COUNTDOWN"
                : runner?.status === "paused"
                  ? "PAUSED"
                  : reviewing
                    ? "WORKOUT COMPLETE"
                    : "ACTIVE PHASE"}
            </Text>
            <Text style={[styles.phaseCounter, { color: theme.colors.tertiary }]}>
              {runner
                ? `STEP ${Math.min(runner.phaseIndex + 1, runner.phases.length)} / ${runner.phases.length}`
                : ""}
            </Text>
          </View>

          <Text style={[styles.phase, { color: theme.colors.text }]}>
            {runner?.status === "preparing"
              ? "Get Ready (5s)"
              : (phase?.label ?? "Finished")}
          </Text>

          <Text style={[styles.clock, { color: theme.colors.text }]}>
            {remaining === null ? "Confirm" : formatClock(remaining)}
          </Text>

          {phase?.type === "work" && phase.target?.distanceMeters ? (
            <View
              style={[
                styles.distancePill,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>
                Prescribed distance {phase.target.distanceMeters.toFixed(0)} m.
                Measured distance {UNAVAILABLE_METRIC}.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Card 2: Cumulative Time Telemetry */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
            SESSION TELEMETRY
          </Text>
          <View style={styles.telemetryGrid}>
            <View
              style={[
                styles.telemetryCell,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.telemetryLabel, { color: theme.colors.textMuted }]}>
                WORK
              </Text>
              <Text style={[styles.telemetryValue, { color: theme.colors.text }]}>
                {totals ? formatClock(totals.workMs / 1000) : UNAVAILABLE_METRIC}
              </Text>
            </View>
            <View
              style={[
                styles.telemetryCell,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.telemetryLabel, { color: theme.colors.textMuted }]}>
                RECOVERY
              </Text>
              <Text style={[styles.telemetryValue, { color: theme.colors.text }]}>
                {totals
                  ? formatClock(totals.prescribedRecoveryMs / 1000)
                  : UNAVAILABLE_METRIC}
              </Text>
            </View>
            <View
              style={[
                styles.telemetryCell,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.telemetryLabel, { color: theme.colors.textMuted }]}>
                PAUSED
              </Text>
              <Text style={[styles.telemetryValue, { color: theme.colors.text }]}>
                {totals
                  ? formatClock(totals.pausedMs / 1000)
                  : UNAVAILABLE_METRIC}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 3: Runner Controls or Review Deck */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          {runner &&
          !reviewing &&
          (runner.status === "running" || runner.status === "preparing") ? (
            <ActionButton
              label="Pause"
              onPress={() => void update(pauseRunner(runner, Date.now()))}
              tone="secondary"
            />
          ) : null}
          {runner?.status === "paused" && !reviewing ? (
            <ActionButton
              label="Resume"
              onPress={() => void update(resumeRunner(runner, Date.now()))}
            />
          ) : null}
          {runner &&
          phase &&
          !isTimerPhase(phase) &&
          runner.status === "running" ? (
            <ActionButton
              label="Mark complete"
              onPress={() => {
                feedbackPhaseCue();
                void update(completeCurrentWork(runner, Date.now()));
              }}
            />
          ) : null}
          {runner && !reviewing && runner.status !== "ready" ? (
            <ActionButton
              label="End workout"
              onPress={() =>
                workspace.requestConfirm({
                  confirmLabel: "End workout",
                  message:
                    "Completed work is kept. The current step stays partial.",
                  onConfirm: () =>
                    void finishReview(endRunnerEarly(runner, Date.now())).catch(
                      (caught) => setError(messageFromUnknown(caught)),
                    ),
                  title: "End this workout?",
                })
              }
              tone="quiet"
            />
          ) : null}

          {reviewing ? (
            <View style={styles.reviewBlock}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                Review the result before saving. Timer progress is not proof the
                exercise was performed.
              </Text>

              <View style={styles.cardHeader}>
                <Text
                  style={[
                    styles.cardHeaderLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  SESSION RPE (OPTIONAL)
                </Text>
                <Text
                  style={[
                    styles.phaseCounter,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  {reviewRpe === null ? "OMITTED" : `RPE ${reviewRpe}`}
                </Text>
              </View>

              <ScrollView
                contentContainerStyle={styles.rpeStrip}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <PressOpacity
                  accessibilityLabel="Omit session RPE"
                  onPress={() => {
                    feedbackStep("down");
                    setReviewRpe(null);
                  }}
                  silent
                  style={[
                    styles.rpeChip,
                    {
                      backgroundColor:
                        reviewRpe === null
                          ? theme.colors.tertiary
                          : theme.colors.surfaceMuted,
                      borderColor:
                        reviewRpe === null
                          ? theme.colors.tertiary
                          : theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rpeChipText,
                      {
                        color:
                          reviewRpe === null ? activeText : theme.colors.text,
                      },
                    ]}
                  >
                    Omit
                  </Text>
                </PressOpacity>
                {RPE_OPTIONS.map((rpe) => {
                  const selected = reviewRpe === rpe;
                  return (
                    <PressOpacity
                      accessibilityLabel={`Session RPE ${rpe}`}
                      key={rpe}
                      onPress={() => {
                        feedbackStep("up");
                        setReviewRpe(rpe);
                      }}
                      silent
                      style={[
                        styles.rpeChip,
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
                          styles.rpeChipText,
                          { color: selected ? activeText : theme.colors.text },
                        ]}
                      >
                        {rpe}
                      </Text>
                    </PressOpacity>
                  );
                })}
              </ScrollView>

              <ActionButton
                label="Save session"
                onPress={() =>
                  void (async () => {
                    if (!ownerId || !runner) {
                      return;
                    }
                    await saveConditioningSession(db, ownerId, sessionId, {
                      occurrences: occurrencesFromRunner(runner),
                      sessionRpe: reviewRpe,
                      status:
                        runner.status === "ended_early"
                          ? "ended_early"
                          : "completed",
                    });
                    feedbackConfirm();
                    workspace.bumpRevision();
                    bumpTimeline();
                    workspace.pop();
                  })().catch((caught) => setError(messageFromUnknown(caught)))
                }
              />
              <ActionButton
                label="Discard"
                onPress={() =>
                  workspace.confirmDiscard(() =>
                    void (async () => {
                      if (!ownerId) {
                        return;
                      }
                      await discardConditioningRecording(db, ownerId, sessionId);
                      workspace.bumpRevision();
                      bumpTimeline();
                      workspace.pop();
                    })(),
                  )
                }
                tone="quiet"
              />
            </View>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </View>
      </ScrollView>
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
  alertCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    padding: tokens.spacing.md,
  },
  heroCard: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1.5,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  phaseCounter: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  phase: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  clock: {
    fontSize: 64,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
    lineHeight: 72,
    textAlign: "center",
  },
  distancePill: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  telemetryGrid: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  telemetryCell: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: tokens.spacing.sm,
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  telemetryValue: {
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  reviewBlock: {
    gap: tokens.spacing.md,
  },
  rpeStrip: {
    gap: 6,
  },
  rpeChip: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: tokens.spacing.sm,
  },
  rpeChipText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
});
