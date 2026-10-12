import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  ErrorText,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import { deviceTimeZone, formatLocalDate } from "../../conditioning/dates";
import { draftFromTemplate } from "../../conditioning/drafts";
import { formatClock, formatName } from "../../conditioning/summaries";
import { messageFromUnknown } from "../../conditioning/validation";
import { UNAVAILABLE_METRIC } from "../../conditioning/units";
import {
  cancelPlannedConditioningSession,
  discardConditioningRecording,
  getConditioningSession,
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

export function ConditioningSessionDetailScreen({ sessionId }: { sessionId: string }) {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [session, setSession] = useState<ConditioningSessionRecord | null>(null);
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
      <ScreenHeading onBack={workspace.pop} title={session?.title ?? "Session"} />
      <ScrollView contentContainerStyle={styles.content}>
        {session ? (
          <>
            <Text style={{ color: theme.colors.textMuted }}>
              {formatName(session.format)} · {session.status.replaceAll("_", " ")}
            </Text>
            <Text style={{ color: theme.colors.text }}>
              {session.performedLocalDate ?? session.scheduledLocalDate}
              {session.scheduledLocalStartTime ? ` · ${session.scheduledLocalStartTime}` : ""}
            </Text>
            <Metric label="Distance" value={session.distanceMeters === null ? UNAVAILABLE_METRIC : `${session.distanceMeters.toFixed(0)} m`} />
            <Metric label="Active time" value={session.activeSeconds === null ? UNAVAILABLE_METRIC : formatClock(session.activeSeconds)} />
            <Metric label="Target RPE" value={session.targetRpe === null ? UNAVAILABLE_METRIC : String(session.targetRpe)} />
            <Metric label="Session RPE" value={session.sessionRpe === null ? UNAVAILABLE_METRIC : String(session.sessionRpe)} />
            {session.notes ? <Text style={{ color: theme.colors.text }}>{session.notes}</Text> : null}
            {session.status === "planned" && session.format !== "free" ? (
              <View style={styles.actions}>
                <ActionButton
                  label="Start"
                  onPress={() =>
                    void run(async () => {
                      const started = await startConditioningSession(db, ownerId!, {
                        performedAt: Date.now(),
                        planSessionId: session.id,
                        timezone: deviceTimeZone(),
                      });
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
                          await cancelPlannedConditioningSession(db, ownerId!, session.id);
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
            {session.status === "in_progress" || session.status === "finished_draft" ? (
              <View style={styles.actions}>
                {session.status === "in_progress" ? (
                  <ActionButton
                    label="Resume"
                    onPress={() => {
                      if (session.format === "free") {
                        workspace.push({ key: `free-${session.id}`, name: "free" });
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
                        await discardConditioningRecording(db, ownerId!, session.id);
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
          </>
        ) : (
          <Text style={{ color: theme.colors.textMuted }}>Loading session</Text>
        )}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
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
  const draft = draftFromTemplate(snapshotConfig(session.snapshot), session.scheduledLocalDate ?? formatLocalDate(new Date()));
  if (session.scheduledLocalStartTime) {
    const [hour, minute] = session.scheduledLocalStartTime.split(":").map(Number);
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
  workspace.push({ key: `log-${session.id}`, name: "log", planSessionId: session.id });
}

function snapshotConfig(snapshot: WorkoutSnapshot) {
  return {
    circuit: snapshot.circuit,
    format: snapshot.format === "free" ? "circuit" as const : snapshot.format,
    interval: snapshot.interval,
    notes: snapshot.notes,
    sprint: snapshot.sprint,
    targetRpe: snapshot.targetRpe,
    title: snapshot.title,
    version: snapshot.version,
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <Text style={{ color: theme.colors.text }}>
      {label}: {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.sm, padding: tokens.spacing.md },
  actions: { gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
});
