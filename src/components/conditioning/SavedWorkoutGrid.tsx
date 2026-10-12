import { PixelRatio, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { formatName, formatTemplateSummary } from "../../conditioning/summaries";
import type { ConditioningTemplateRecord } from "../../data/conditioningRepository";
import { useAppState } from "../../state/AppStateContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;

type SavedWorkoutGridProps = {
  emptyLabel?: string;
  error?: string | null;
  loading?: boolean;
  onPress: (template: ConditioningTemplateRecord) => void;
  onRetry?: () => void;
  templates: ConditioningTemplateRecord[];
};

export function savedWorkoutColumnCount(fontScale = PixelRatio.getFontScale()) {
  if (fontScale >= 1.6) {
    return 1;
  }

  if (fontScale >= 1.3) {
    return 2;
  }

  return 3;
}

export function SavedWorkoutGrid({
  emptyLabel = "No saved workouts yet",
  error = null,
  loading = false,
  onPress,
  onRetry,
  templates,
}: SavedWorkoutGridProps) {
  const { theme } = useAppTheme();
  const { unitSettings } = useAppState();
  const { fontScale } = useWindowDimensions();
  const columns = savedWorkoutColumnCount(fontScale);

  if (loading) {
    return <Text style={{ color: theme.colors.textMuted }}>Loading workouts</Text>;
  }

  if (error) {
    return (
      <View style={styles.message}>
        <Text style={{ color: theme.colors.text }}>{error}</Text>
        {onRetry ? (
          <PressOpacity accessibilityLabel="Retry loading workouts" onPress={onRetry}>
            <Text style={{ color: theme.colors.tertiary, fontWeight: "700" }}>Retry</Text>
          </PressOpacity>
        ) : null}
      </View>
    );
  }

  if (templates.length === 0) {
    return <Text style={{ color: theme.colors.textMuted }}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.grid}>
      {templates.map((template) => (
        <PressOpacity
          accessibilityLabel={`${template.title}, ${formatName(template.format)}`}
          key={template.id}
          onPress={() => onPress(template)}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              width: `${100 / columns}%`,
            },
          ]}
        >
          <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>
            {template.title}
          </Text>
          <Text style={[styles.format, { color: theme.colors.tertiary }]}>
            {formatName(template.format)}
          </Text>
          <Text style={[styles.summary, { color: theme.colors.textMuted }]}>
            {formatTemplateSummary(
              template.config,
              unitSettings.distance,
              unitSettings.height,
            )}
          </Text>
        </PressOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    minHeight: 96,
    padding: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
  },
  format: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: "700",
    marginTop: 2,
  },
  summary: {
    fontSize: 12,
    marginTop: 4,
  },
  message: {
    gap: tokens.spacing.sm,
  },
});
