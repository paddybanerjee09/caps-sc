import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import { ConditioningFooter, ScreenHeading } from "../../components/conditioning/ConditioningFields";
import {
  emphasisCategories,
  emphasisColors,
  emphasisLabels,
  estimateSnapshotEmphasis,
  type EmphasisCategory,
  type EmphasisResult,
} from "../../conditioning/emphasis";
import { templateConfigFromDraft } from "../../conditioning/drafts";
import { buildWorkoutSnapshot } from "../../conditioning/phases";
import { getConditioningSession } from "../../data/conditioningRepository";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

const explanations: Record<
  EmphasisCategory,
  { example: string; meaning: string }
> = {
  aerobic_endurance: {
    example:
      "A long road run or a steady pad round that stays conversational.",
    meaning:
      "Sustained work capacity. Power is about rate; capacity is about how much work can be supplied.",
  },
  aerobic_power: {
    example: "Hard three-minute rounds with incomplete recovery.",
    meaning:
      "A faster aerobic energy rate. It overlaps endurance when the bout is long.",
  },
  alactic_capacity: {
    example: "Repeated short bursts with enough rest to keep each one sharp.",
    meaning:
      "Repeated brief efforts. Alactic work overlaps lactic work as rests get shorter.",
  },
  alactic_power: {
    example: "A single explosive shot or sprawl with a long recovery.",
    meaning:
      "The highest short burst rate. It is not a separate fuel tank from the other systems.",
  },
  lactic_capacity: {
    example:
      "A 60–90 second all-out effort, such as a long combination chain.",
    meaning: "Hard work that lasts long enough to draw on fast glycolysis.",
  },
  lactic_power: {
    example:
      "A 20–40 second burst with substantial recovery before the next one.",
    meaning:
      "A high rate of hard work. Repeated bursts cross several systems.",
  },
};

export function ConditioningAdaptationsScreen({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [result, setResult] = useState<EmphasisResult | null>(null);
  const [selected, setSelected] = useState<EmphasisCategory | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (sessionId && ownerId) {
        const session = await getConditioningSession(db, ownerId, sessionId);
        if (!session || cancelled) {
          return;
        }
        const stored = session.emphasisJson
          ? (JSON.parse(session.emphasisJson) as EmphasisResult)
          : estimateSnapshotEmphasis(
              session.snapshot,
              session.sessionRpe,
              "actual",
            );
        if (!cancelled) {
          setResult(stored);
        }
        return;
      }

      const draft = workspace.editor?.draft;
      if (!draft) {
        return;
      }
      try {
        const snapshot = buildWorkoutSnapshot(templateConfigFromDraft(draft));
        if (!cancelled) {
          setResult(estimateSnapshotEmphasis(snapshot, null, "target_preview"));
        }
      } catch {
        if (!cancelled) {
          setResult(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, ownerId, sessionId, workspace.editor]);
  const explanation = selected ? explanations[selected] : null;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading
        title="Estimated Training Emphasis"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.metaCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Text style={[styles.metaHeader, { color: theme.colors.tertiary }]}>
            ESTIMATED
          </Text>
        </View>

        {emphasisCategories.map((category) => {
          const score = result?.scores[category];
          const isPrimary = result?.labels.primary === category;
          const isSecondary = result?.labels.secondary.includes(category);
          return (
            <PressOpacity
              accessibilityLabel={emphasisLabels[category]}
              key={category}
              onPress={() => setSelected(category)}
              style={[
                styles.categoryCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isPrimary
                    ? emphasisColors[category]
                    : theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.categoryTopRow}>
                <View style={styles.categoryLabelWrap}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: emphasisColors[category] },
                    ]}
                  />
                  <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>
                    {emphasisLabels[category]}
                    {isPrimary ? " · Primary" : ""}
                    {isSecondary ? " · Secondary" : ""}
                  </Text>
                </View>
                <View style={styles.scoreWrap}>
                  <Text
                    style={[
                      styles.scoreText,
                      {
                        color:
                          readableTextColor(emphasisColors[category]) ===
                          "#FFFFFF"
                            ? theme.colors.text
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {score == null ? "--" : `${score} / 100`}
                  </Text>
                  <Ionicons
                    color={theme.colors.textMuted}
                    name="information-circle-outline"
                    size={18}
                  />
                </View>
              </View>
              <View
                style={[
                  styles.track,
                  { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <View
                  style={{
                    backgroundColor:
                      score == null
                        ? theme.colors.border
                        : emphasisColors[category],
                    borderRadius: 999,
                    height: 12,
                    width: `${score ?? 0}%`,
                  }}
                />
              </View>
            </PressOpacity>
          );
        })}
      </ScrollView>
      <ConditioningFooter />

      <Modal
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        transparent
        visible={selected != null}
      >
        <PressOpacity
          accessibilityLabel="Close explanation"
          onPress={() => setSelected(null)}
          style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.borderStrong,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {selected ? emphasisLabels[selected] : ""}
            </Text>
            <Text style={{ color: theme.colors.text, fontSize: 14, lineHeight: 20 }}>
              {explanation?.meaning}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
              Example: {explanation?.example}
            </Text>
            <PressOpacity
              accessibilityLabel="Close"
              onPress={() => setSelected(null)}
              style={[
                styles.closeModalBtn,
                { backgroundColor: theme.colors.tertiary },
              ]}
            >
              <Text
                style={{
                  color: readableTextColor(theme.colors.tertiary),
                  fontWeight: "800",
                }}
              >
                Close
              </Text>
            </PressOpacity>
          </View>
        </PressOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  metaCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: 6,
    padding: tokens.spacing.lg,
  },
  metaHeader: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  categoryCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  categoryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryLabelWrap: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: tokens.spacing.sm,
  },
  colorDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  categoryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  scoreWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  scoreText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  track: {
    borderRadius: 999,
    height: 12,
    overflow: "hidden",
  },
  overlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    maxWidth: 420,
    padding: tokens.spacing.lg,
    width: "100%",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeModalBtn: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: tokens.spacing.md,
  },
});
