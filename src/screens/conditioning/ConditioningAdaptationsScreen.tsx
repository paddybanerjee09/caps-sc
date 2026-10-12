import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import { ScreenHeading } from "../../components/conditioning/ConditioningFields";
import {
  emphasisCategories,
  emphasisColors,
  emphasisLabels,
  estimateEmphasis,
  type EmphasisCategory,
  type EmphasisResult,
} from "../../conditioning/emphasis";
import { getConditioningSession } from "../../data/conditioningRepository";
import { templateConfigFromDraft } from "../../conditioning/drafts";
import { buildWorkoutSnapshot } from "../../conditioning/phases";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useConditioningOwner } from "./useConditioningOwner";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";

const tokens = themes.dark;

const explanations: Record<EmphasisCategory, { example: string; meaning: string }> = {
  aerobic_endurance: {
    example: "A long road run or a steady pad round that stays conversational.",
    meaning: "Sustained work capacity. Power is about rate; capacity is about how much work can be supplied.",
  },
  aerobic_power: {
    example: "Hard three-minute rounds with incomplete recovery.",
    meaning: "A faster aerobic energy rate. It overlaps endurance when the bout is long.",
  },
  alactic_capacity: {
    example: "Repeated short bursts with enough rest to keep each one sharp.",
    meaning: "Repeated brief efforts. Alactic work overlaps lactic work as rests get shorter.",
  },
  alactic_power: {
    example: "A single explosive shot or sprawl with a long recovery.",
    meaning: "The highest short burst rate. It is not a separate fuel tank from the other systems.",
  },
  lactic_capacity: {
    example: "A 60–90 second all-out effort, such as a long combination chain.",
    meaning: "Hard work that lasts long enough to draw on fast glycolysis.",
  },
  lactic_power: {
    example: "A 20–40 second burst with substantial recovery before the next one.",
    meaning: "A high rate of hard work. Repeated bursts cross several systems.",
  },
};

export function ConditioningAdaptationsScreen({ sessionId }: { sessionId: string | null }) {
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
          : estimateFromSnapshot(session.snapshot, session.sessionRpe, "actual");
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
          setResult(estimateFromSnapshot(snapshot, null, "target_preview"));
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
      <ScreenHeading onBack={workspace.pop} title="Estimated Training Emphasis" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: theme.colors.text }}>
          A provisional estimate of this session’s training emphasis; it does not measure physiological adaptation.
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>
          {result
            ? `${result.version} · ${result.coverage.replaceAll("_", " ")} · ${result.confidence} confidence · ${result.source.replaceAll("_", " ")}`
            : "Not enough information to estimate this session."}
        </Text>
        {emphasisCategories.map((category) => {
          const score = result?.scores[category];
          return (
            <View key={category}>
              <PressOpacity accessibilityLabel={emphasisLabels[category]} onPress={() => setSelected(category)}>
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                  {emphasisLabels[category]}
                  {result?.labels.primary === category ? " · Primary" : ""}
                  {result?.labels.secondary.includes(category) ? " · Secondary" : ""}
                </Text>
              </PressOpacity>
              <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={{
                    backgroundColor: score == null ? theme.colors.border : emphasisColors[category],
                    height: 12,
                    width: `${score ?? 0}%`,
                  }}
                />
              </View>
              <Text style={{ color: readableTextColor(emphasisColors[category]) === "#FFFFFF" ? theme.colors.text : theme.colors.text }}>
                {score == null ? "Unavailable" : `${score} / 100`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Modal animationType="fade" onRequestClose={() => setSelected(null)} transparent visible={selected != null}>
        <PressOpacity accessibilityLabel="Close explanation" onPress={() => setSelected(null)} style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {selected ? emphasisLabels[selected] : ""}
            </Text>
            <Text style={{ color: theme.colors.text }}>{explanation?.meaning}</Text>
            <Text style={{ color: theme.colors.textMuted }}>{explanation?.example}</Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Timing and RPE cannot establish measured energy contributions. Training response also depends on history and recovery.
            </Text>
            <PressOpacity accessibilityLabel="Close" onPress={() => setSelected(null)}>
              <Text style={{ color: theme.colors.tertiary, fontWeight: "700" }}>Close</Text>
            </PressOpacity>
          </View>
        </PressOpacity>
      </Modal>
    </View>
  );
}

function estimateFromSnapshot(
  snapshot: { phases: { durationSeconds: number; target: { rpe: number | null } | null; type: string }[] },
  sessionRpe: number | null,
  source: "actual" | "target_preview",
) {
  const work = snapshot.phases.filter((phase) => phase.type === "work");
  const recovery = snapshot.phases
    .filter((phase) => phase.type !== "work" && phase.type !== "preparation")
    .reduce((total, phase) => total + phase.durationSeconds, 0);
  return estimateEmphasis({
    bouts: work.map((phase) => ({
      workRpe: phase.target?.rpe ?? null,
      workSeconds: phase.durationSeconds > 0 ? phase.durationSeconds : null,
    })),
    recoverySeconds: recovery,
    sessionRpe,
    source,
  });
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  track: { borderRadius: 999, height: 12, overflow: "hidden" },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    flex: 1,
    justifyContent: "center",
    padding: tokens.spacing.lg,
  },
  card: { borderRadius: tokens.radius.lg, gap: tokens.spacing.sm, padding: tokens.spacing.lg },
  cardTitle: { fontSize: 18, fontWeight: "700" },
});
