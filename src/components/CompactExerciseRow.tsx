import { StyleSheet, Text, View } from "react-native";
import type { ExerciseDbExercise } from "../types/exerciseDb";
import { useAppTheme } from "../theme/ThemeContext";
import { PressOpacity } from "./PressOpacity";
import { RemoteMediaThumbnail } from "./RemoteMediaThumbnail";

type CompactExerciseRowProps = {
  exercise: ExerciseDbExercise;
  disabled?: boolean;
  onPress: () => void;
};

function buildMetadata(exercise: ExerciseDbExercise) {
  const primaryParts = [exercise.targetMuscles[0], exercise.bodyParts[0]].filter(Boolean);
  const primary = primaryParts.join(" · ");
  const secondary = exercise.equipments[0] ?? "";
  return { primary, secondary };
}

export function CompactExerciseRow({ exercise, disabled, onPress }: CompactExerciseRowProps) {
  const { theme } = useAppTheme();
  const { primary, secondary } = buildMetadata(exercise);
  const accessibilityLabel = [
    exercise.name,
    primary,
    secondary,
  ].filter(Boolean).join(". ");

  return (
    <PressOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={styles.row}
    >
      <RemoteMediaThumbnail
        accessibilityLabel={`${exercise.name} preview`}
        recyclingKey={exercise.exerciseId}
        uri={exercise.gifUrl}
      />
      <View style={styles.content}>
        <Text numberOfLines={2} style={[theme.typography.body, styles.name, { color: theme.colors.text }]}>
          {exercise.name}
        </Text>
        {primary ? (
          <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {primary}
          </Text>
        ) : null}
        {secondary ? (
          <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </PressOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontWeight: "600",
  },
});
