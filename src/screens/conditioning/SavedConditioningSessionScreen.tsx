import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ConditioningFooter, ScreenHeading } from "../../components/conditioning/ConditioningFields";
import { SavedWorkoutGrid } from "../../components/conditioning/SavedWorkoutGrid";
import { draftFromTemplate } from "../../conditioning/drafts";
import { formatLocalDate } from "../../conditioning/dates";
import {
  listConditioningTemplates,
  type ConditioningTemplateRecord,
} from "../../data/conditioningRepository";
import { useConditioningWorkspace } from "../../state/ConditioningWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { useConditioningOwner } from "./useConditioningOwner";

const tokens = themes.dark;

export function SavedConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [templates, setTemplates] = useState<ConditioningTemplateRecord[]>([]);
  const fetchKey = `${ownerId ?? "pending"}:${workspace.revision}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== fetchKey;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    void listConditioningTemplates(db, ownerId)
      .then((saved) => {
        if (!cancelled) {
          setTemplates(saved);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn’t load saved workouts");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedKey(fetchKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, fetchKey, ownerId]);

  function openTemplate(template: ConditioningTemplateRecord) {
    const draft = draftFromTemplate(template.config, formatLocalDate(new Date()));
    workspace.openEditor({
      draft,
      format: template.format,
      planSessionId: null,
      savedSnapshot: JSON.stringify(draft),
      templateId: template.id,
    });
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScreenHeading title="Saved Workouts" />
      <View style={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
              flex: 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardHeaderLabel, { color: theme.colors.textMuted }]}>
              SAVED TEMPLATES LIBRARY
            </Text>
            <Text style={[styles.countBadge, { color: theme.colors.tertiary }]}>
              {templates.length} TOTAL
            </Text>
          </View>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            Opening a workout loads it into the composer—it does not log a session.
          </Text>
          <SavedWorkoutGrid
            error={error}
            loading={loading}
            onPress={openTemplate}
            onRetry={() => workspace.bumpRevision()}
            templates={templates}
          />
        </View>
      </View>
      <ConditioningFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    flex: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  countBadge: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
