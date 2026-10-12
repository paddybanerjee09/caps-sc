import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  ErrorText,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import { deviceTimeZone } from "../../conditioning/dates";
import { buildFreeSnapshot } from "../../conditioning/phases";
import { formatClock } from "../../conditioning/summaries";
import { messageFromUnknown } from "../../conditioning/validation";
import { UNAVAILABLE_METRIC } from "../../conditioning/units";
import {
  discardConditioningRecording,
  findInProgressConditioningSession,
  finishConditioningSession,
  getConditioningRunnerState,
  getConditioningSession,
  mergeConditioningRunnerState,
  saveConditioningSession,
  startConditioningSession,
} from "../../data/conditioningRepository";
import {
  CONDITIONING_LOCATION_TASK,
  ingestConditioningLocations,
} from "../../services/conditioningLocationTask";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import type { FreeActivity } from "../../conditioning/types";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

type FreeTimer = {
  accumulatedPausedMs: number;
  pauseStartedAt: number | null;
  sessionId: string;
  startedAt: number;
  status: "running" | "paused" | "finished";
};

export function FreeConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [activity, setActivity] = useState<FreeActivity>("run");
  const [timer, setTimer] = useState<FreeTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<"checking" | "gps" | "foreground" | "timer">("checking");
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const active = await findInProgressConditioningSession(db, ownerId);
      if (!active || active.format !== "free" || cancelled) {
        return;
      }
      const stored = await getConditioningRunnerState(db, ownerId, active.id);
      if (stored && !cancelled) {
        const parsed = JSON.parse(stored.stateJson) as { timer?: FreeTimer };
        setTimer(parsed.timer ?? (parsed as FreeTimer));
        setActivity(active.activityType ?? "run");
        setDistanceMeters(active.distanceMeters);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, ownerId]);

  async function persist(next: FreeTimer) {
    if (!ownerId) {
      return;
    }
    setTimer(next);
    await mergeConditioningRunnerState(db, ownerId, next.sessionId, { timer: next });
  }

  useEffect(() => {
    if (locationMode !== "foreground" || !timer || timer.status === "finished") {
      return;
    }
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
      (location) => {
        void ingestConditioningLocations(db, [location]);
      },
    ).then((next) => {
      if (cancelled) {
        next.remove();
        return;
      }
      subscription = next;
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [db, locationMode, timer]);

  useEffect(() => {
    if (!timer || !ownerId) {
      return;
    }
    const refresh = setInterval(() => {
      void getConditioningSession(db, ownerId, timer.sessionId).then((loaded) => {
        setDistanceMeters(loaded?.distanceMeters ?? null);
      });
    }, 2000);
    return () => clearInterval(refresh);
  }, [db, ownerId, timer]);

  async function start() {
    if (!ownerId) {
      return;
    }
    setError(null);
    try {
      const session = await startConditioningSession(db, ownerId, {
        performedAt: Date.now(),
        snapshot: buildFreeSnapshot(activity),
        timezone: deviceTimeZone(),
      });
      const mode = await beginLocationTracking(activity);
      setLocationMode(mode);
      await persist({
        accumulatedPausedMs: 0,
        pauseStartedAt: null,
        sessionId: session.id,
        startedAt: session.performedAt ?? Date.now(),
        status: "running",
      });
      workspace.bumpRevision();
    } catch (caught) {
      setError(messageFromUnknown(caught));
    }
  }

  const activeMs = timer
    ? (timer.pauseStartedAt ?? (timer.status === "finished" ? timer.startedAt : now)) -
      timer.startedAt -
      timer.accumulatedPausedMs
    : 0;
  const elapsedMs = timer ? now - timer.startedAt : 0;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onBack={workspace.pop} title="Free session" />
      <View style={styles.content}>
        <Text style={{ color: theme.colors.textMuted }}>
          Timer only. Distance, pace, route, and elevation stay unavailable until GPS recording is running.
        </Text>
        <View style={styles.row}>
          <ActionButton
            label="Run"
            onPress={() => setActivity("run")}
            tone={activity === "run" ? "primary" : "secondary"}
          />
          <ActionButton
            label="Bike"
            onPress={() => setActivity("bike")}
            tone={activity === "bike" ? "primary" : "secondary"}
          />
        </View>
        <Text style={[styles.clock, { color: theme.colors.text }]}>
          {formatClock(Math.max(0, activeMs) / 1000)}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Elapsed {timer ? formatClock(Math.max(0, elapsedMs) / 1000) : UNAVAILABLE_METRIC}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          {locationMode === "gps"
            ? "GPS recording is on. A locked phone can continue only while the system keeps the location service alive."
            : locationMode === "foreground"
              ? "Foreground only. The route pauses when the screen locks."
              : "Timer only. Distance, pace, route, and elevation are unavailable."}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          Distance {distanceMeters === null ? UNAVAILABLE_METRIC : `${distanceMeters.toFixed(0)} m`}
        </Text>
        {!timer ? <ActionButton label="Start" onPress={() => void start()} /> : null}
        {timer?.status === "running" ? (
          <ActionButton
            label="Pause"
            onPress={() =>
              void persist({ ...timer, pauseStartedAt: Date.now(), status: "paused" })
            }
            tone="secondary"
          />
        ) : null}
        {timer?.status === "paused" ? (
          <ActionButton
            label="Resume"
            onPress={() =>
              void persist({
                ...timer,
                accumulatedPausedMs:
                  timer.accumulatedPausedMs +
                  (Date.now() - (timer.pauseStartedAt ?? Date.now())),
                pauseStartedAt: null,
                status: "running",
              })
            }
          />
        ) : null}
        {timer && timer.status !== "finished" ? (
          <ActionButton
            label="Finish"
            onPress={() =>
              void (async () => {
                if (!ownerId) {
                  return;
                }
                const finishedAt = Date.now();
                const paused =
                  timer.accumulatedPausedMs +
                  (timer.pauseStartedAt ? finishedAt - timer.pauseStartedAt : 0);
                await Location.stopLocationUpdatesAsync(CONDITIONING_LOCATION_TASK).catch(() => undefined);
                await finishConditioningSession(db, ownerId, timer.sessionId, {
                  activeSeconds: Math.max(0, (finishedAt - timer.startedAt - paused) / 1000),
                  elapsedSeconds: (finishedAt - timer.startedAt) / 1000,
                  finishedAt,
                });
                await persist({
                  ...timer,
                  accumulatedPausedMs: paused,
                  pauseStartedAt: null,
                  status: "finished",
                });
              })()
            }
            tone="secondary"
          />
        ) : null}
        {timer?.status === "finished" ? (
          <>
            <ActionButton
              label="Save session"
              onPress={() =>
                void (async () => {
                  if (!ownerId) {
                    return;
                  }
                  await saveConditioningSession(db, ownerId, timer.sessionId, {
                    notes: null,
                    sessionRpe: null,
                    status: "completed",
                  });
                  workspace.bumpRevision();
                  bumpTimeline();
                  workspace.pop();
                })()
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
                    await Location.stopLocationUpdatesAsync(CONDITIONING_LOCATION_TASK).catch(() => undefined);
                    await discardConditioningRecording(db, ownerId, timer.sessionId);
                    workspace.bumpRevision();
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

async function beginLocationTracking(activity: "run" | "bike") {
  const services = await Location.hasServicesEnabledAsync();
  if (!services) {
    return "timer" as const;
  }

  const current = await Location.getForegroundPermissionsAsync();
  const foreground =
    current.status === "granted" ? current : await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return "timer" as const;
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return "foreground" as const;
  }

  await Location.startLocationUpdatesAsync(CONDITIONING_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    activityType:
      activity === "bike" ? Location.ActivityType.OtherNavigation : Location.ActivityType.Fitness,
    distanceInterval: 3,
    foregroundService: {
      notificationBody: "CAPS is recording your conditioning route.",
      notificationTitle: "Recording conditioning",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    timeInterval: 2000,
  });
  return "gps" as const;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  row: { flexDirection: "row", gap: tokens.spacing.sm },
  clock: { fontSize: 42, fontWeight: "700" },
});
