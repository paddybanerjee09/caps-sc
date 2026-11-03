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
    return (
      <View
        style={[
          styles.stateCard,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>
          Loading workouts…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.stateCard,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{error}</Text>
        {onRetry ? (
          <PressOpacity
            accessibilityLabel="Retry loading workouts"
            onPress={onRetry}
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={{ color: theme.colors.tertiary, fontWeight: "800" }}>
              Retry
            </Text>
          </PressOpacity>
        ) : null}
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <View
        style={[
          styles.stateCard,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={{ color: theme.colors.textMuted, fontWeight: "700" }}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const cardWidth =
    columns === 1 ? "100%" : columns === 2 ? "48.5%" : "31.8%";

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
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.borderStrong,
              width: cardWidth,
            },
          ]}
        >
          <View
            style={[
              styles.formatBadge,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.format, { color: theme.colors.tertiary }]}>
              {formatName(template.format).toUpperCase()}
            </Text>
          </View>
          <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text }]}>
            {template.title}
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
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  card: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: 6,
    minHeight: 112,
    padding: tokens.spacing.md,
  },
  formatBadge: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  format: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  summary: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    lineHeight: 15,
  },
  stateCard: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    justifyContent: "center",
    minHeight: 68,
    padding: tokens.spacing.md,
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: tokens.spacing.md,
  },
});
