import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { PressOpacity } from "../../components/PressOpacity";
import { getStrengthSession, listSameLiftReferences } from "../../data/strengthRepository";
import {
  emphasisFromDraft,
  emphasisHeadline,
  strengthQualities,
  strengthQualityColors,
  strengthQualityLabels,
  type StrengthEmphasis,
  type StrengthQuality,
} from "../../strength/emphasis";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

const meanings: Record<StrengthQuality, string> = {
  hypertrophy:
    "Challenging sets in the 5–30 rep range. Effort raises the index when RPE is filled in. This is not a muscle-growth measurement.",
  muscular_endurance:
    "Sets of 15 or more reps with rest or RPE filled in. Short rests raise the index. Missing rest and effort stays unknown.",
  power:
    "Work marked with explosive intent. Low reps without that mark stay unknown. This is not a bar-speed measurement.",
  strength:
    "Work compared with the latest same-lift load. Without that reference, strength stays unknown.",
};

export function StrengthAdaptationsScreen({ sessionId }: { sessionId: string | null }) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useStrengthWorkspace();
  const [result, setResult] = useState<StrengthEmphasis | null>(null);
  const [selected, setSelected] = useState<StrengthQuality | null>(null);

  useEffect(() => {
    workspace.registerBackHandler(() => {
      workspace.pop();
      return true;
    });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (sessionId) {
        const session = await getStrengthSession(db, sessionId);
        if (!cancelled) {
          setResult(session?.emphasis ?? null);
        }
        return;
      }
      const draft = workspace.draft;
      if (!draft) {
        return;
      }
      const references = await listSameLiftReferences(
        db,
        draft.exercises
          .map((exercise) => exercise.catalogExerciseId)
          .filter((id): id is string => id != null),
        workspace.mode === "log" ? draft.endedAt : Date.now(),
      );
      if (!cancelled) {
        setResult(emphasisFromDraft(draft.exercises, references));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, sessionId, workspace.draft, workspace.mode]);

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <PressOpacity accessibilityLabel="Back" onPress={workspace.pop} style={styles.headerHit}>
          <Text style={[styles.headerAction, { color: theme.colors.text }]}>Back</Text>
        </PressOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Estimated focus</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
          ]}
        >
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
            PROVISIONAL HEURISTIC
          </Text>
          <Text style={[styles.body, { color: theme.colors.text }]}>
            {result ? emphasisHeadline(result) : "Not enough evidence"}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Four independent indexes. They can overlap, and they do not measure adaptation.
            {result ? ` ${result.modelVersion}.` : ""}
          </Text>
        </View>
        {strengthQualities.map((quality) => {
          const score = result?.qualities[quality].score ?? null;
          const primary = result?.primary === quality;
          const color = strengthQualityColors[quality];
          return (
            <PressOpacity
              accessibilityLabel={`${strengthQualityLabels[quality]}${score == null ? ", unknown" : `, ${score}`}`}
              key={quality}
              onPress={() => setSelected((current) => (current === quality ? null : quality))}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: primary ? color : theme.colors.borderStrong,
                },
              ]}
            >
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.quality, { color: theme.colors.text }]}>
                  {strengthQualityLabels[quality]}
                  {primary ? " · Primary" : ""}
                </Text>
                <Text style={[styles.score, { color: theme.colors.text }]}>
                  {score == null ? "Unknown" : score.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: theme.colors.surfaceMuted }]}>
                <View
                  style={{
                    backgroundColor: score == null ? theme.colors.border : color,
                    borderRadius: 999,
                    height: 12,
                    width: `${Math.max(0, Math.min(100, score ?? 0))}%`,
                  }}
                />
              </View>
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                {result?.qualities[quality].rationale ?? "No work sets yet."}
              </Text>
              {selected === quality ? (
                <Text style={[styles.body, { color: theme.colors.text }]}>{meanings[quality]}</Text>
              ) : null}
            </PressOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  headerHit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 64,
  },
  headerAction: { fontSize: 16, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "800" },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.md },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.sm,
    padding: tokens.spacing.lg,
  },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  body: { fontSize: 16, fontWeight: "700", lineHeight: 22 },
  hint: { fontSize: 13, lineHeight: 18 },
  row: { alignItems: "center", flexDirection: "row", gap: tokens.spacing.sm },
  dot: { borderRadius: 6, height: 12, width: 12 },
  quality: { flex: 1, fontSize: 16, fontWeight: "800" },
  score: { fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "800" },
  track: { borderRadius: 999, height: 12, overflow: "hidden" },
});
