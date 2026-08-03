import { StyleSheet, Text, View } from "react-native";

import {
  conditioningAdaptationOrder,
  conditioningAdaptations,
  conditioningScoringDisclaimer,
} from "../constants/conditioning";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { ConditioningScoreResult } from "../types/conditioning";
import { PressOpacity } from "./PressOpacity";

const tokens = themes.dark;

export type ConditioningAdaptationModalProps = {
  onBack: () => void;
  result: ConditioningScoreResult;
};

export function ConditioningAdaptationModal({
  onBack,
  result,
}: ConditioningAdaptationModalProps) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Adaptation Scores
        </Text>
        <Text style={[styles.warning, { color: theme.colors.textMuted }]}>
          {conditioningScoringDisclaimer}
        </Text>
      </View>

      {result.status === "insufficient" ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.stateCard,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.stateTitle, { color: theme.colors.text }]}>
            Not enough information
          </Text>
          {result.reasons.map((reason, index) => (
            <Text
              key={`${reason}-${index}`}
              style={[styles.stateText, { color: theme.colors.textMuted }]}
            >
              {reason}
            </Text>
          ))}
        </View>
      ) : (
        <View style={styles.graph}>
          <View accessible={false} style={styles.axisLabels}>
            <Text style={[styles.axisText, { color: theme.colors.textMuted }]}>0</Text>
            <Text style={[styles.axisText, { color: theme.colors.textMuted }]}>50</Text>
            <Text style={[styles.axisText, { color: theme.colors.textMuted }]}>100</Text>
          </View>

          {conditioningAdaptationOrder.map((key) => {
            const presentation = conditioningAdaptations[key];
            const score = clampScore(result.scores[key]);

            return (
              <View
                accessibilityLabel={`${presentation.label}, ${formatScore(score)} out of 100`}
                accessible
                key={key}
                style={styles.scoreRow}
              >
                <View style={styles.scoreLabels}>
                  <Text
                    numberOfLines={2}
                    style={[styles.scoreLabel, { color: theme.colors.text }]}
                  >
                    {presentation.label}
                  </Text>
                  <Text
                    style={[styles.scoreValue, { color: presentation.color }]}
                  >
                    {formatScore(score)}
                  </Text>
                </View>

                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.track,
                    { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: presentation.color,
                        width: `${score}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.midpoint,
                      { backgroundColor: theme.colors.borderStrong },
                    ]}
                  />
                </View>
              </View>
            );
          })}

          <Text style={[styles.evidence, { color: theme.colors.textMuted }]}>
            {result.evidence === "limited"
              ? "Limited evidence: some optional inputs were unavailable."
              : "Full evidence from the selected protocol and intensity."}
          </Text>

          {result.missingInputs.map((input, index) => (
            <Text
              key={`${input}-${index}`}
              style={[styles.missingInput, { color: theme.colors.textMuted }]}
            >
              • {input}
            </Text>
          ))}
        </View>
      )}

      <PressOpacity
        accessibilityLabel="Back to conditioning session"
        onPress={onBack}
        style={[
          styles.backButton,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.borderStrong,
          },
        ]}
      >
        <Text style={[styles.backButtonText, { color: theme.colors.text }]}>
          Back
        </Text>
      </PressOpacity>
    </View>
  );
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function formatScore(value: number) {
  return value.toLocaleString([], {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

const styles = StyleSheet.create({
  container: {
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
  },
  heading: {
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.typography.sectionTitle.fontSize,
    fontWeight: tokens.typography.sectionTitle.fontWeight,
    lineHeight: tokens.typography.sectionTitle.lineHeight,
    textAlign: "center",
  },
  warning: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  graph: {
    gap: tokens.spacing.md,
  },
  axisLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    lineHeight: 14,
  },
  scoreRow: {
    gap: tokens.spacing.xs,
  },
  scoreLabels: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "space-between",
  },
  scoreLabel: {
    flex: 1,
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  scoreValue: {
    fontSize: tokens.typography.label.fontSize,
    fontVariant: ["tabular-nums"],
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
  track: {
    borderRadius: tokens.radius.pill,
    height: 12,
    overflow: "hidden",
    position: "relative",
  },
  fill: {
    borderRadius: tokens.radius.pill,
    height: "100%",
  },
  midpoint: {
    bottom: 0,
    left: "50%",
    position: "absolute",
    top: 0,
    width: StyleSheet.hairlineWidth,
  },
  evidence: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    marginTop: tokens.spacing.xs,
  },
  missingInput: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
  },
  stateCard: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
  },
  stateTitle: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: "700",
    lineHeight: tokens.typography.body.lineHeight,
    textAlign: "center",
  },
  stateText: {
    fontSize: tokens.typography.label.fontSize,
    lineHeight: tokens.typography.label.lineHeight,
    textAlign: "center",
  },
  backButton: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.lg,
  },
  backButtonText: {
    fontSize: tokens.typography.label.fontSize,
    fontWeight: tokens.typography.label.fontWeight,
    lineHeight: tokens.typography.label.lineHeight,
  },
});
