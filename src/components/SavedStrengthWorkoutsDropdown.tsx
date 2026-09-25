import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { StoredStrengthTemplate } from "../types/strength";
import { CollectionStateView } from "./CollectionStateView";
import { PressOpacity } from "./PressOpacity";
import { SavedSessionCardGrid } from "./SavedSessionCardGrid";

const tokens = themes.dark;

type Props = {
  disabled: boolean;
  error: string | null;
  loading: boolean;
  onEdit: (template: StoredStrengthTemplate) => void;
  onLog: (template: StoredStrengthTemplate) => void;
  onRetry: () => void;
  templates: readonly StoredStrengthTemplate[];
  visible: boolean;
};

export function SavedStrengthWorkoutsDropdown({
  disabled,
  error,
  loading,
  onEdit,
  onLog,
  onRetry,
  templates,
  visible,
}: Props) {
  const { theme } = useAppTheme();

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceMuted }]}> 
      {loading ? (
        <CollectionStateView label="Loading saved workouts…" variant="loading" />
      ) : error ? (
        <CollectionStateView
          actionLabel="Retry saved workouts"
          label={error}
          onAction={onRetry}
          variant="error"
        />
      ) : templates.length === 0 ? (
        <CollectionStateView
          label="No saved workouts yet. Save a workout from Log Workout."
          variant="empty"
        />
      ) : (
        <SavedSessionCardGrid
          data={templates}
          keyExtractor={(template) => String(template.id)}
          renderItem={(template) => (
            <View
              style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            >
              <PressOpacity
                accessibilityLabel={`Log saved workout ${template.title}`}
                disabled={disabled}
                onPress={() => onLog(template)}
                style={styles.cardBody}
              >
                <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
                  {template.title}
                </Text>
                <Text numberOfLines={3} style={[styles.details, { color: theme.colors.textMuted }]}>
                  {template.exercises.map((exercise) => `${exercise.name} · ${exercise.sets}×${exercise.reps}`).join(", ")}
                </Text>
              </PressOpacity>
              <PressOpacity
                accessibilityLabel={`Edit saved workout ${template.title}`}
                onPress={() => onEdit(template)}
                style={styles.edit}
              >
                <Ionicons color={theme.colors.textMuted} name="ellipsis-horizontal" size={22} />
              </PressOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
  },
  card: { borderRadius: tokens.radius.md, borderWidth: 1, flex: 1, overflow: "hidden" },
  cardBody: { flex: 1, gap: tokens.spacing.xs, justifyContent: "center", padding: tokens.spacing.md, paddingRight: 48 },
  title: { fontSize: tokens.typography.label.fontSize, fontWeight: "700" },
  details: { fontSize: tokens.typography.caption.fontSize, lineHeight: tokens.typography.caption.lineHeight },
  edit: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 0, top: 0, width: 44 },
});
