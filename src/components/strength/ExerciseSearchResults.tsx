import Ionicons from "@expo/vector-icons/Ionicons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { listStrengthExerciseFavouriteIds, setStrengthExerciseFavourite } from "../../data/strengthExerciseFavourites";
import { listStrengthExercises } from "../../data/strengthRepository";
import { searchExercises } from "../../strength/catalog";
import type { CatalogExercise } from "../../strength/types";
import { useAppTheme } from "../../theme/ThemeContext";
import { themes } from "../../theme/theme";
import { feedbackWarn } from "../../utils/feedback";
import { ActionButton } from "../ActionButton";
import { PressOpacity } from "../PressOpacity";

const tokens = themes.dark;

export function useExerciseFavouriteColor() {
  const { colorScheme } = useAppTheme();
  return colorScheme === "dark" ? "#FFC548" : "#946700";
}

export function useExerciseCatalog() {
  const db = useSQLiteContext();
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<string[]>([]);
  const favouriteLocks = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    void Promise.all([listStrengthExercises(db), listStrengthExerciseFavouriteIds()])
      .then(([exercises, ids]) => {
        if (!active) return;
        setCatalog(exercises);
        setFavourites(ids);
        setLoadError(null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("Couldn’t load exercises.");
        setLoading(false);
      });
    return () => { active = false; };
  }, [db, retry]);

  async function toggleFavourite(id: string) {
    if (favouriteLocks.current.has(id)) return;
    favouriteLocks.current.add(id);
    setPending((ids) => [...ids, id]);
    setActionError(null);
    const alreadyFavourite = favourites.includes(id);
    try {
      await setStrengthExerciseFavourite(id, !alreadyFavourite);
      setFavourites((ids) => alreadyFavourite ? ids.filter((value) => value !== id) : [...ids, id]);
    } catch {
      feedbackWarn();
      setActionError("Couldn’t update favourite. Try again.");
    } finally {
      favouriteLocks.current.delete(id);
      setPending((ids) => ids.filter((value) => value !== id));
    }
  }

  return {
    actionError, catalog, favourites, loading, loadError, pending, toggleFavourite,
    retry: () => { setLoading(true); setLoadError(null); setRetry((version) => version + 1); },
  };
}

export function ExerciseSearchResults({
  source, query, favouritesOnly, maxHeight, onSelect,
}: {
  source: ReturnType<typeof useExerciseCatalog>;
  query: string;
  favouritesOnly: boolean;
  maxHeight: number;
  onSelect: (exercise: CatalogExercise) => void;
}) {
  const { theme } = useAppTheme();
  const favouriteColor = useExerciseFavouriteColor();
  const { actionError, catalog, favourites, loading, loadError, pending, retry, toggleFavourite } = source;
  const results = useMemo(() => {
    if (loading || loadError) return [];
    const pool = favouritesOnly ? catalog.filter((exercise) => favourites.includes(exercise.id)) : catalog;
    return searchExercises(pool, query, pool.length).matches;
  }, [catalog, favourites, favouritesOnly, loading, loadError, query]);

  return (
    <FlatList
      data={results}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(exercise) => exercise.id}
      ListEmptyComponent={(
        <View style={styles.message}>
          <Text accessibilityRole={loadError ? "alert" : undefined} style={{ color: theme.colors.textMuted }}>
            {loading ? "Loading exercises…" : loadError ?? (favouritesOnly && !query.trim() ? "No favourite exercises." : "No matching exercises.")}
          </Text>
          {loadError ? <ActionButton label="Retry" onPress={retry} tone="secondary" /> : null}
        </View>
      )}
      ListHeaderComponent={actionError ? (
        <Text accessibilityRole="alert" style={[styles.message, { color: theme.colors.text }]}>{actionError}</Text>
      ) : undefined}
      renderItem={({ item }) => {
        const favourite = favourites.includes(item.id);
        const muscles = item.muscleGroups.slice(0, 2).join(" & ");
        const equipment = item.equipment === "body only" ? "None" : item.equipment;
        return (
          <View style={[styles.result, { borderColor: theme.colors.border }]}>
            <PressOpacity
              accessibilityLabel={`Add ${item.name}, ${muscles || "muscles unspecified"}, equipment ${equipment || "unspecified"}`}
              onPress={() => onSelect(item)}
              style={styles.select}
            >
              <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
              <Text style={[styles.info, { color: theme.colors.textMuted }]}>{muscles || "—"}</Text>
              <Text style={[styles.info, { color: theme.colors.textMuted }]}>{equipment || "—"}</Text>
            </PressOpacity>
            <PressOpacity
              accessibilityLabel={favourite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
              accessibilityState={{ selected: favourite, disabled: pending.includes(item.id) }}
              disabled={pending.includes(item.id)}
              onPress={() => { void toggleFavourite(item.id); }}
              style={styles.star}
            >
              <Ionicons name={favourite ? "star" : "star-outline"} size={23} color={favourite ? favouriteColor : theme.colors.textMuted} />
            </PressOpacity>
          </View>
        );
      }}
      style={{ maxHeight }}
    />
  );
}

const styles = StyleSheet.create({
  result: { alignItems: "center", flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  select: { flex: 1, flexDirection: "row", gap: tokens.spacing.sm, alignItems: "center", minHeight: 48, paddingLeft: tokens.spacing.sm, paddingVertical: tokens.spacing.xs },
  name: { flex: 1.45, minWidth: 0, fontSize: 13, fontWeight: "700" },
  info: { flex: 1, minWidth: 0, fontSize: 12, textTransform: "capitalize" },
  star: { minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center" },
  message: { padding: tokens.spacing.md, gap: tokens.spacing.sm },
});
