import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { StoredStrengthTemplate } from "../types/strength";
import { AppModalFrame } from "./AppModalFrame";
import { CollectionStateView } from "./CollectionStateView";
import { PressOpacity } from "./PressOpacity";
import { ResponsiveTileGrid } from "./ResponsiveTileGrid";

const tokens = themes.dark;

export type SavedStrengthWorkoutsModalProps = {
  visible: boolean;
  templates: StoredStrengthTemplate[];
  loading: boolean;
  error: string | null;
  disabled: boolean;
  onClose: () => void;
  onEdit: (template: StoredStrengthTemplate) => void;
  onLog: (template: StoredStrengthTemplate) => void;
  onRetry: () => void;
};

export function SavedStrengthWorkoutsModal({
  visible,
  templates,
  loading,
  error,
  disabled,
  onClose,
  onEdit,
  onLog,
  onRetry,
}: SavedStrengthWorkoutsModalProps) {
  const { theme } = useAppTheme();

  return (
    <AppModalFrame visible={visible} width="wide" onClose={onClose}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Saved Workouts
        </Text>
      </View>

      {loading ? (
        <CollectionStateView label="Loading saved workouts…" variant="loading" />
      ) : error ? (
        <CollectionStateView
          actionLabel="Retry saved workouts"
          label={error}
          variant="error"
          onAction={onRetry}
        />
      ) : templates.length === 0 ? (
        <CollectionStateView
          label="No saved workouts yet. Save a workout from Log Workout."
          variant="empty"
        />
      ) : (
        <ResponsiveTileGrid
          contentContainerStyle={styles.gridContent}
          data={templates}
          keyExtractor={(template) => String(template.id)}
          renderItem={({ item: template, tileSize }) => (
            <View
              style={[
                styles.tile,
                {
                  borderColor: theme.colors.border,
                  height: tileSize,
                  width: tileSize,
                },
              ]}
            >
              <PressOpacity
                accessibilityLabel={`Log saved workout ${template.title}`}
                disabled={disabled}
                onPress={() => onLog(template)}
                style={styles.tileBody}
              >
                <Text
                  numberOfLines={2}
                  style={[styles.tileTitle, { color: theme.colors.text }]}
                >
                  {template.title}
                </Text>
                <Text
                  numberOfLines={3}
                  style={[styles.tileDetails, { color: theme.colors.textMuted }]}
                >
                  {template.exercises
                    .map((exercise) => `${exercise.name} · ${exercise.sets}×${exercise.reps}`)
                    .join(", ")}
                </Text>
              </PressOpacity>
              <PressOpacity
                accessibilityLabel={`Edit saved workout ${template.title}`}
                onPress={() => onEdit(template)}
                style={styles.editButton}
              >
                <Ionicons
                  color={theme.colors.text}
                  name="ellipsis-horizontal"
                  size={22}
                />
              </PressOpacity>
            </View>
          )}
          style={styles.grid}
        />
      )}
    </AppModalFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  grid: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 240,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  gridContent: {
    paddingBottom: tokens.spacing.lg,
  },
  tile: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileBody: {
    flex: 1,
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    padding: tokens.spacing.sm,
    paddingRight: tokens.spacing.xl,
  },
  tileTitle: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.label.lineHeight,
  },
  tileDetails: {
    fontSize: tokens.typography.caption.fontSize,
    lineHeight: tokens.typography.caption.lineHeight,
  },
  editButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 44,
  },
});
