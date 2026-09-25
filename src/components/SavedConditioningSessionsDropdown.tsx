import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { listConditioningTemplates } from "../data/conditioningRepository";
import { useAppTheme } from "../theme/ThemeContext";
import { themes } from "../theme/theme";
import type { StoredConditioningTemplate } from "../types/conditioning";
import { CollectionStateView } from "./CollectionStateView";
import { PressOpacity } from "./PressOpacity";
import { SavedSessionCardGrid } from "./SavedSessionCardGrid";

const tokens = themes.dark;

type Props = {
  onSelect: (template: StoredConditioningTemplate) => void;
  visible: boolean;
};

export function SavedConditioningSessionsDropdown({ onSelect, visible }: Props) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [templates, setTemplates] = useState<StoredConditioningTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError(null);
    void listConditioningTemplates(db)
      .then((nextTemplates) => {
        if (active) setTemplates(nextTemplates);
      })
      .catch(() => {
        if (active) setError("Couldn't load saved conditioning sessions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db, loadRevision, visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceMuted }]}> 
      {loading ? (
        <CollectionStateView label="Loading saved sessions…" variant="loading" />
      ) : error ? (
        <CollectionStateView
          actionLabel="Retry saved sessions"
          label={error}
          onAction={() => setLoadRevision((revision) => revision + 1)}
          variant="error"
        />
      ) : templates.length === 0 ? (
        <CollectionStateView label="No saved conditioning sessions yet." variant="empty" />
      ) : (
        <SavedSessionCardGrid
          data={templates}
          keyExtractor={(template) => String(template.id)}
          renderItem={(template, size) => {
            const compact = size.width < 140;

            return (
            <PressOpacity
              accessibilityLabel={`Log saved conditioning session ${template.title}`}
              onPress={() => onSelect(template)}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  gap: compact ? tokens.spacing.xs : tokens.spacing.sm,
                  padding: compact ? tokens.spacing.sm : tokens.spacing.md,
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  compact && styles.compactIcon,
                  { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                <MaterialCommunityIcons color={theme.colors.tertiary} name="run-fast" size={compact ? 18 : 22} />
              </View>
              <View style={styles.text}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.title,
                    {
                      color: theme.colors.text,
                      fontSize: compact ? 10 : tokens.typography.label.fontSize,
                      lineHeight: compact ? 13 : tokens.typography.label.lineHeight,
                    },
                  ]}
                >
                  {template.title}
                </Text>
                <Text
                  numberOfLines={compact ? 3 : 2}
                  style={[
                    styles.details,
                    {
                      color: theme.colors.textMuted,
                      fontSize: compact ? 9 : tokens.typography.caption.fontSize,
                      lineHeight: compact ? 11 : tokens.typography.caption.lineHeight,
                    },
                  ]}
                >
                  {template.activity} · {template.protocol.type}
                </Text>
              </View>
            </PressOpacity>
            );
          }}
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
  card: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flex: 1, flexDirection: "row" },
  icon: { alignItems: "center", borderRadius: tokens.radius.sm, height: 40, justifyContent: "center", width: 40 },
  compactIcon: { height: 32, width: 32 },
  text: { flex: 1, gap: tokens.spacing.xs },
  title: { fontSize: tokens.typography.label.fontSize, fontWeight: "700" },
  details: { fontSize: tokens.typography.caption.fontSize },
});
