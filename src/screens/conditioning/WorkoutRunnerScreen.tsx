import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";

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
import { themes } from "../../theme/theme";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;
const processToken = createId();
const keepAwakeTag = "conditioning-runner";

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
  const runnerRef = useRef<RunnerState | null>(null);
  const cueRef = useRef<string | null>(null);

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
          startRunner(createReadyRunner(loaded.snapshot.phases, timestamp), loaded.performedAt ?? timestamp, processToken),
          timestamp,
        ).state;
      } else {
        const parsed = JSON.parse(stored.stateJson) as RunnerState;
        next = parsed.processToken === processToken
          ? reconcileRunner(parsed, timestamp).state
          : { ...restoreAfterProcessTermination(parsed), processToken };
      }
      if (!cancelled) {
        setRunner(next);
        setReviewing(next.status === "finished" || next.status === "ended_early");
        await saveConditioningRunnerState(db, ownerId, sessionId, JSON.stringify(next));
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
      if (result.state !== current) {
        runnerRef.current = result.state;
        setRunner(result.state);
        void saveConditioningRunnerState(db, ownerId, sessionId, JSON.stringify(result.state));
        if (result.cuePhaseId && result.cuePhaseId !== cueRef.current) {
          cueRef.current = result.cuePhaseId;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (result.state.status === "finished") {
          setReviewing(true);
          void finishConditioningSession(db, ownerId, sessionId, {
            activeSeconds:
              (result.state.totals.workMs + result.state.totals.prescribedRecoveryMs) / 1000,
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
        void saveConditioningRunnerState(db, ownerId, sessionId, JSON.stringify(stamped));
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
    const active = runner?.status === "running" || runner?.status === "preparing";
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
    await saveConditioningRunnerState(db, ownerId, sessionId, JSON.stringify(next));
  }

  const phase = runner ? currentPhase(runner) : null;
  const remaining = runner ? remainingWholeSeconds(runner, now) : null;
  const totals = runner ? projectedTotals(runner, now) : null;

  async function finishReview(next: RunnerState) {
    if (!ownerId || !session) {
      return;
    }
    await update(next);
    await finishConditioningSession(db, ownerId, sessionId, {
      activeSeconds: (next.totals.workMs + next.totals.prescribedRecoveryMs) / 1000,
      elapsedSeconds: session.performedAt ? (Date.now() - session.performedAt) / 1000 : null,
      finishedAt: Date.now(),
      occurrences: occurrencesFromRunner(next),
    });
    setReviewing(true);
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onBack={workspace.pop} title={session?.title ?? "Workout"} />
      <View style={styles.content}>
        {runner?.uncertainInterruption ? (
          <Text style={{ color: theme.colors.text }}>
            This session was interrupted. Confirmed progress was kept, and the gap was not counted as work.
          </Text>
        ) : null}
        <Text style={[styles.phase, { color: theme.colors.text }]}>{phase?.label ?? "Finished"}</Text>
        <Text style={[styles.clock, { color: theme.colors.text }]}>
          {remaining === null ? "Confirm" : formatClock(remaining)}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Work {totals ? formatClock(totals.workMs / 1000) : UNAVAILABLE_METRIC}
          {" · "}
          Recovery {totals ? formatClock(totals.prescribedRecoveryMs / 1000) : UNAVAILABLE_METRIC}
          {" · "}
          Paused {totals ? formatClock(totals.pausedMs / 1000) : UNAVAILABLE_METRIC}
        </Text>
        {phase?.type === "work" && phase.target?.distanceMeters ? (
          <Text style={{ color: theme.colors.textMuted }}>
            Prescribed distance {phase.target.distanceMeters.toFixed(0)} m. Measured distance {UNAVAILABLE_METRIC}.
          </Text>
        ) : null}
        {runner && !reviewing && (runner.status === "running" || runner.status === "preparing") ? (
          <ActionButton label="Pause" onPress={() => void update(pauseRunner(runner, Date.now()))} tone="secondary" />
        ) : null}
        {runner?.status === "paused" && !reviewing ? (
          <ActionButton label="Resume" onPress={() => void update(resumeRunner(runner, Date.now()))} />
        ) : null}
        {runner && phase && !isTimerPhase(phase) && runner.status === "running" ? (
          <ActionButton
            label="Mark complete"
            onPress={() => void update(completeCurrentWork(runner, Date.now()))}
          />
        ) : null}
        {runner && !reviewing && runner.status !== "ready" ? (
          <ActionButton
            label="End workout"
            onPress={() =>
              workspace.requestConfirm({
                confirmLabel: "End workout",
                message: "Completed work is kept. The current step stays partial.",
                onConfirm: () => void finishReview(endRunnerEarly(runner, Date.now())).catch((caught) => setError(messageFromUnknown(caught))),
                title: "End this workout?",
              })
            }
            tone="quiet"
          />
        ) : null}
        {reviewing ? (
          <>
            <Text style={{ color: theme.colors.textMuted }}>
              Review the result before saving. Timer progress is not proof the exercise was performed.
            </Text>
            <ActionButton
              label="Save session"
              onPress={() =>
                void (async () => {
                  if (!ownerId || !runner) {
                    return;
                  }
                  await saveConditioningSession(db, ownerId, sessionId, {
                    occurrences: occurrencesFromRunner(runner),
                    sessionRpe: null,
                    status: runner.status === "ended_early" ? "ended_early" : "completed",
                  });
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
          </>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  phase: { fontSize: 22, fontWeight: "700" },
  clock: { fontSize: 56, fontWeight: "700" },
});
