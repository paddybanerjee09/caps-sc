import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  ActionButton,
  ScreenHeading,
} from "../../components/conditioning/ConditioningFields";
import {
  discardConditioningRecording,
  getConditioningSession,
  type ConditioningSessionRecord,
} from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function WorkoutRunnerScreen({ sessionId }: { sessionId: string }) {
  const { theme } = useAppTheme();
  const { bumpTimeline } = useAppState();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [session, setSession] = useState<ConditioningSessionRecord | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    void getConditioningSession(db, ownerId, sessionId).then(setSession);
  }, [db, ownerId, sessionId]);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading onBack={workspace.pop} title={session?.title ?? "Workout"} />
      <View style={styles.content}>
        <Text style={{ color: theme.colors.text }}>
          {session ? `${session.snapshot.phases.length} phases are ready.` : "Loading workout"}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          The guided timer keeps this session open until you discard it or the runner finishes it.
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
});
