import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";

import { ActionButton } from "../../components/ActionButton";
import { PressOpacity } from "../../components/PressOpacity";
import { ExerciseImage } from "../../components/strength/ExerciseImage";
import { WorkflowHeader, WorkflowFooter } from "../../components/WorkflowChrome";
import { createId } from "../../conditioning/ids";
import { listStrengthExercises } from "../../data/strengthRepository";
import { listStrengthExerciseFavouriteIds, setStrengthExerciseFavourite } from "../../data/strengthExerciseFavourites";
import { STRENGTH_SEARCH_PAGE, searchExercises } from "../../strength/catalog";
import { MAX_EXERCISES, addCatalogExercise } from "../../strength/drafts";
import { strengthExerciseImageUrl } from "../../strength/media";
import type { CatalogExercise } from "../../strength/types";
import { useStrengthWorkspace } from "../../state/StrengthWorkspaceContext";
import { useAppTheme } from "../../theme/ThemeContext";
import { readableTextColor, themes } from "../../theme/theme";
import { feedbackWarn } from "../../utils/feedback";

const tokens = themes.dark;

export function AddExercisesScreen() {
  const db = useSQLiteContext();
  const { theme } = useAppTheme();
  const workspace = useStrengthWorkspace();
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "favourites">("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const favouriteLocks = useRef(new Set<string>());
  const selecting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listStrengthExercises(db), listStrengthExerciseFavouriteIds()])
      .then(([exercises, ids]) => {
        if (cancelled) return;
        setCatalog(exercises);
        setFavourites(ids);
        setLoadError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setLoadError("Couldn’t load exercises. Try again."); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [db, retry]);

  useEffect(() => {
    workspace.registerBackHandler(() => { workspace.pop(); return true; });
    return () => workspace.registerBackHandler(null);
  }, [workspace]);

  const results = useMemo(() => searchExercises(tab === "favourites" ? catalog.filter((exercise) => favourites.includes(exercise.id)) : catalog, workspace.searchQuery, workspace.searchLimit), [catalog, favourites, tab, workspace.searchQuery, workspace.searchLimit]);

  async function toggleFavourite(exercise: CatalogExercise) {
    if (favouriteLocks.current.has(exercise.id)) return;
    favouriteLocks.current.add(exercise.id);
    setPending((current) => [...current, exercise.id]);
    const isFavourite = favourites.includes(exercise.id);
    setActionError(null);
    try {
      await setStrengthExerciseFavourite(exercise.id, !isFavourite);
      setFavourites((current) => isFavourite ? current.filter((id) => id !== exercise.id) : [...current, exercise.id]);
    } catch {
      feedbackWarn();
      setActionError("Couldn’t update favourite. Try again.");
    } finally {
      favouriteLocks.current.delete(exercise.id);
      setPending((current) => current.filter((id) => id !== exercise.id));
    }
  }

  function select(exercise: CatalogExercise) {
    const draft = workspace.draft;
    if (!draft || selecting.current) return;
    if (draft.exercises.length >= MAX_EXERCISES) { feedbackWarn(); setActionError("This workout already has 40 exercises."); return; }
    selecting.current = true;
    const next = addCatalogExercise(draft, exercise);
    const added = next.exercises.at(-1);
    if (!added) { selecting.current = false; return; }
    workspace.updateDraft(next);
    workspace.push({ baseline: JSON.stringify(draft), exerciseId: added.id, fresh: true, key: createId(), name: "editor" });
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <WorkflowHeader title="Add Exercises" onClose={workspace.closeBranch} />
      <View style={styles.controls}>
        <TextInput accessibilityLabel="Search exercise database" onChangeText={(query) => { workspace.setSearchQuery(query); workspace.setSearchLimit(STRENGTH_SEARCH_PAGE); }} placeholder="Search exercises" placeholderTextColor={theme.colors.textMuted} style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong, color: theme.colors.text }]} value={workspace.searchQuery} />
        <View style={styles.tabs}>
          {(["all", "favourites"] as const).map((value) => (
            <PressOpacity accessibilityLabel={value === "all" ? "All exercises" : "Favourite exercises"} accessibilityState={{ selected: tab === value }} key={value} onPress={() => { setTab(value); workspace.setSearchLimit(STRENGTH_SEARCH_PAGE); }} style={[styles.tab, { backgroundColor: tab === value ? theme.colors.tertiary : theme.colors.surfaceMuted, borderColor: theme.colors.borderStrong }]}>
              <Text style={[styles.tabText, { color: tab === value ? readableTextColor(theme.colors.tertiary) : theme.colors.text }]}>{value === "all" ? "All" : "Favourites"}</Text>
            </PressOpacity>
          ))}
        </View>
        {actionError ? <Text accessibilityRole="alert" style={{ color: theme.colors.tertiary }}>{actionError}</Text> : null}
      </View>
      <FlatList
        contentContainerStyle={styles.results}
        data={loading || loadError ? [] : results.matches}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(exercise) => exercise.id}
        ListEmptyComponent={<View style={styles.empty}><Text style={{ color: theme.colors.textMuted }}>{loading ? "Loading exercises…" : loadError ?? (workspace.searchQuery.trim() ? "No matching exercises." : tab === "favourites" ? "No favourite exercises." : "No exercises available.")}</Text>{loadError ? <ActionButton label="Retry" onPress={() => { setLoading(true); setLoadError(null); setRetry((current) => current + 1); }} tone="secondary" /> : null}</View>}
        ListFooterComponent={!loading && !loadError && results.total > results.matches.length ? <ActionButton label="Load more" onPress={() => workspace.setSearchLimit(workspace.searchLimit + STRENGTH_SEARCH_PAGE)} tone="secondary" /> : undefined}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <PressOpacity accessibilityLabel={`Configure ${item.name}`} onPress={() => select(item)} style={styles.exercise}>
              <ExerciseImage uri={strengthExerciseImageUrl(item)} name={item.name} />
              <View style={styles.copy}><Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text><Text style={[styles.equipment, { color: theme.colors.textMuted }]}>{item.equipment}</Text></View>
            </PressOpacity>
            <PressOpacity accessibilityLabel={`${favourites.includes(item.id) ? "Remove" : "Add"} ${item.name} ${favourites.includes(item.id) ? "from" : "to"} favourites`} accessibilityState={{ selected: favourites.includes(item.id), disabled: pending.includes(item.id) }} disabled={pending.includes(item.id)} onPress={() => { void toggleFavourite(item); }} style={styles.star}>
              <Ionicons name={favourites.includes(item.id) ? "star" : "star-outline"} size={23} color={favourites.includes(item.id) ? theme.colors.tertiary : theme.colors.textMuted} />
            </PressOpacity>
          </View>
        )}
        style={styles.scroller}
      />
      <WorkflowFooter backLabel="Back" onBack={workspace.pop} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroller: { flex: 1 },
  controls: { padding: tokens.spacing.md, gap: tokens.spacing.md },
  search: { borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 12, fontSize: 16 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48, borderWidth: 1, borderRadius: 12 },
  tabText: { fontSize: 14, fontWeight: "700" },
  results: { paddingHorizontal: tokens.spacing.md, paddingBottom: tokens.spacing.md, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: tokens.radius.lg, padding: 8, gap: 4 },
  exercise: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 72, gap: 12 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 15, fontWeight: "700" },
  equipment: { fontSize: 12 },
  star: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 16, gap: 12 },
});
