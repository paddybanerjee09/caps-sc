import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { getExerciseDbDetail, isExerciseRequestCancelled, isStrengthSearchResult, searchExerciseDb } from "../services/exerciseDbApi";
import { useAppTheme } from "../theme/ThemeContext";
import type { ExerciseDbExercise } from "../types/exerciseDb";
import { PressOpacity } from "./PressOpacity";
import { StrengthButton, StrengthField, StrengthMessage, strengthStyles as s } from "./StrengthFormPrimitives";

// A view within the session's native Modal, matching conditioning's subview pattern.
export function ExerciseSearchModal({ onSelect, onCancel }: { onSelect: (exercise: ExerciseDbExercise) => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState(""); const [retry, setRetry] = useState(0);
  const [results, setResults] = useState<ExerciseDbExercise[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController(); request.current = controller;
    const valid = query.replace(/\s/g, "").length >= 2;
    const timer = setTimeout(async () => {
      if (!valid) return;
      try {
        const page = await searchExerciseDb(query, controller.signal);
        if (version === generation.current && !controller.signal.aborted) { setResults(page.exercises); setCursor(page.nextCursor); }
      } catch (e) { if (!controller.signal.aborted && !isExerciseRequestCancelled(e)) setError(e instanceof Error ? e.message : "Search failed."); }
      finally { if (version === generation.current && !controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); request.current?.abort(); if (generation.current === version) generation.current += 1; };
  }, [query, retry]);
  async function loadMore() {
    if (!cursor || loading || selecting) return;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(null);
    try {
      const page = await searchExerciseDb(query, controller.signal, cursor);
      if (!controller.signal.aborted) { setResults(current => [...current, ...page.exercises.filter(e => !current.some(old => old.exerciseId === e.exerciseId))]); setCursor(page.nextCursor); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Search failed."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function select(exercise: ExerciseDbExercise) {
    if (selecting) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setSelecting(true); setLoading(false); setError(null);
    try {
      const detail = exercise.instructions.length && exercise.bodyParts.length && exercise.targetMuscles.length && exercise.equipments.length
        ? exercise : await getExerciseDbDetail(exercise.exerciseId, controller.signal);
      if (!controller.signal.aborted) {
        if (!isStrengthSearchResult(detail)) throw new Error("This exercise is classified as cardio. Choose another exercise.");
        onSelect(detail);
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Couldn't load exercise details. Select it again to retry."); }
    finally { if (!controller.signal.aborted) setSelecting(false); }
  }
  return <View style={{ height: "100%", maxHeight: 620 }}>
    <View style={s.header}><Text style={[s.title, { color: theme.colors.text }]}>Add exercise</Text>
      <StrengthField label="Search exercises" value={query} autoFocus onChangeText={value => {
        request.current?.abort(); setResults([]); setCursor(null); setError(null); setSelecting(false);
        setLoading(value.replace(/\s/g, "").length >= 2); setQuery(value);
      }} />
      {query.replace(/\s/g, "").length < 2 ? <StrengthMessage>Enter at least two characters.</StrengthMessage> : null}
      {loading || selecting ? <ActivityIndicator accessibilityLabel={selecting ? "Loading exercise details" : "Searching exercises"} color={theme.colors.tertiary} /> : null}
      {error ? <><StrengthMessage>{error}</StrengthMessage><StrengthButton label="Retry search" onPress={() => { setError(null); setLoading(true); setRetry(n => n + 1); }} /></> : null}
    </View>
    <FlatList data={results} keyExtractor={e => e.exerciseId} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}
      renderItem={({ item }) => <PressOpacity disabled={selecting} accessibilityLabel={`Select ${item.name}`} onPress={() => void select(item)} style={[s.card, { borderColor: theme.colors.border }]}>
        <Text style={{ color: theme.colors.text }}>{item.name}</Text><Text style={{ color: theme.colors.textMuted }}>{item.targetMuscles.join(", ")}</Text>
      </PressOpacity>}
      ListEmptyComponent={!loading && !error && query.replace(/\s/g, "").length >= 2 ? <StrengthMessage>No exercises found.</StrengthMessage> : null}
      ListFooterComponent={cursor ? <StrengthButton label="Load more exercises" disabled={loading || selecting} onPress={() => void loadMore()} /> : null} />
    <View style={s.actions}><StrengthButton label="Cancel" onPress={() => { request.current?.abort(); onCancel(); }} /></View>
  </View>;
}
