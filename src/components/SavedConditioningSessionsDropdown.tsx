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

const tokens = themes.dark;

type Props = {
  onSelect: (template: StoredConditioningTemplate) => void;
  onRetry?: () => void;
  visible: boolean;
};

export function SavedConditioningSessionsDropdown({ onSelect, visible }: Props) {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const [templates, setTemplates] = useState<StoredConditioningTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [db, visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceMuted }]}> 
      {loading ? (
        <CollectionStateView label="Loading saved sessions…" variant="loading" />
      ) : error ? (
        <CollectionStateView label={error} variant="error" />
      ) : templates.length === 0 ? (
        <CollectionStateView label="No saved conditioning sessions yet." variant="empty" />
      ) : (
        <View style={styles.cards}>
          {templates.map((template) => (
            <PressOpacity
              key={template.id}
              accessibilityLabel={`Log saved conditioning session ${template.title}`}
              onPress={() => onSelect(template)}
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <View style={[styles.icon, { backgroundColor: theme.colors.surfaceMuted }]}>
                <MaterialCommunityIcons color={theme.colors.tertiary} name="run-fast" size={22} />
              </View>
              <View style={styles.text}>
                <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>{template.title}</Text>
                <Text numberOfLines={2} style={[styles.details, { color: theme.colors.textMuted }]}>{template.activity} · {template.protocol.type}</Text>
              </View>
            </PressOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: tokens.radius.md, padding: tokens.spacing.sm },
  cards: { gap: tokens.spacing.sm },
  card: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, flexDirection: "row", gap: tokens.spacing.md, minHeight: 76, padding: tokens.spacing.md },
  icon: { alignItems: "center", borderRadius: tokens.radius.sm, height: 40, justifyContent: "center", width: 40 },
  text: { flex: 1, gap: tokens.spacing.xs },
  title: { fontSize: tokens.typography.label.fontSize, fontWeight: "700" },
  details: { fontSize: tokens.typography.caption.fontSize },
});
