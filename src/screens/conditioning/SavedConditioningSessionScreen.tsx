import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenHeading } from "../../components/conditioning/ConditioningFields";
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
import { useEffect, useState } from "react";

const tokens = themes.dark;

export function SavedConditioningSessionScreen() {
  const { theme } = useAppTheme();
  const workspace = useConditioningWorkspace();
  const { db, ownerId } = useConditioningOwner();
  const [templates, setTemplates] = useState<ConditioningTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
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
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, ownerId, workspace.revision]);

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
      <ScreenHeading onBack={workspace.pop} title="Saved Workouts" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: theme.colors.textMuted }}>
          Opening a workout does not log it.
        </Text>
        <SavedWorkoutGrid
          error={error}
          loading={loading}
          onPress={openTemplate}
          onRetry={() => workspace.bumpRevision()}
          templates={templates}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: tokens.spacing.md,
  },
});
