import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";

import { PressOpacity } from "../../components/PressOpacity";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { createId } from "../../conditioning/ids";
import { SKILL_CATALOG } from "../../skill/catalog";
import { addCatalogActivity, updateActivity } from "../../skill/drafts";
import type { SkillActivityDefinition } from "../../skill/types";
import { useSkillWorkspace } from "../../state/SkillWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";

const tokens = themes.dark;

export function AddSkillActivitiesScreen() {
  const { theme } = useAppTheme();
  const workspace = useSkillWorkspace();
  const selecting = useRef(false);
  const query = workspace.searchQuery.trim().toLowerCase();
  const results = SKILL_CATALOG.filter((activity) => (activity.name + " " + activity.discipline.replace(/_/g, " ")).toLowerCase().includes(query));
  useEffect(() => {
    workspace.registerBackHandler(() => { workspace.pop(); return true; });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);
  function select(activity: SkillActivityDefinition) {
    const draft = workspace.draft;
    if (!draft || selecting.current || draft.activities.length >= 24) return;
    selecting.current = true;
    const next = addCatalogActivity(draft, activity.key);
    const added = next.activities.at(-1);
    if (!added) { selecting.current = false; return; }
    workspace.updateDraft(updateActivity(next, added.id, { timingMode: "reps" }));
    workspace.push({ key: createId(), name: "editor", activityId: added.id, baseline: JSON.stringify(draft), fresh: true });
  }
  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title="Add Activities" onClose={workspace.closeBranch} />
      <View style={styles.searchWrap}><TextInput accessibilityLabel="Search skill activities" onChangeText={workspace.setSearchQuery} placeholder="Search activities" placeholderTextColor={theme.colors.textMuted} style={[styles.search, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong }]} value={workspace.searchQuery} /></View>
      <FlatList contentContainerStyle={styles.results} data={results} keyboardShouldPersistTaps="handled" keyExtractor={(activity) => activity.key} ListEmptyComponent={<Text style={{ color: theme.colors.textMuted }}>No matching activities.</Text>} renderItem={({ item }) => <PressOpacity accessibilityLabel={"Configure " + item.name} onPress={() => select(item)} style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}><Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text></PressOpacity>} style={styles.scroller} />
      <WorkflowFooter backLabel="Back" onBack={() => workspace.pop()} />
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, scroller: { flex: 1 },
  searchWrap: { padding: tokens.spacing.md },
  search: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16 },
  results: { paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.md, gap: 12 },
  card: { minHeight: 64, justifyContent: "center", borderWidth: 1, borderRadius: tokens.radius.lg, padding: tokens.spacing.lg },
  name: { fontSize: 16, fontWeight: "700" },
});
