import { StyleSheet, View } from "react-native";

import { ConfirmDialog } from "../../components/conditioning/ConfirmDialog";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { ConditioningAdaptationsScreen } from "./ConditioningAdaptationsScreen";
import { CreateConditioningSessionScreen } from "./CreateConditioningSessionScreen";
import { ConditioningSessionDetailScreen } from "./ConditioningSessionDetailScreen";
import { FreeConditioningSessionScreen } from "./FreeConditioningSessionScreen";
import { LogConditioningSessionScreen } from "./LogConditioningSessionScreen";
import { SavedConditioningSessionScreen } from "./SavedConditioningSessionScreen";
import { StationEditorScreen } from "./StationEditorScreen";
import { WorkoutRunnerScreen } from "./WorkoutRunnerScreen";

function StackScreen() {
  const { stack } = useConditioningWorkspace();
  const top = stack.at(-1);

  if (!top) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {top.name === "saved" ? <SavedConditioningSessionScreen /> : null}
      {top.name === "free" ? <FreeConditioningSessionScreen /> : null}
      {top.name === "detail" || top.name === "summary" ? (
        <ConditioningSessionDetailScreen sessionId={top.sessionId} />
      ) : null}
      {top.name === "log" ? <LogConditioningSessionScreen /> : null}
      {top.name === "station" ? <StationEditorScreen stationId={top.stationId} /> : null}
      {top.name === "runner" ? <WorkoutRunnerScreen sessionId={top.sessionId} /> : null}
      {top.name === "emphasis" ? (
        <ConditioningAdaptationsScreen sessionId={top.sessionId} />
      ) : null}
    </View>
  );
}

export function ConditioningStack() {
  const { editor, stack } = useConditioningWorkspace();
  const top = stack.at(-1);
  const coversEditor =
    top?.name === "station" || top?.name === "log" || top?.name === "emphasis";

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {top && !coversEditor ? <StackScreen /> : null}
      {editor ? <CreateConditioningSessionScreen /> : null}
      {top && coversEditor ? <StackScreen /> : null}
      <ConfirmDialog />
    </View>
  );
}
