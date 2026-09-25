import { useEffect, useRef, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { getExerciseDbDetail, isExerciseRequestCancelled, isStrengthSearchResult, searchExerciseDb } from "../services/exerciseDbApi";
import { useAppTheme } from "../theme/ThemeContext";
import type { ExerciseDbExercise } from "../types/exerciseDb";
import { CollectionStateView } from "./CollectionStateView";
import { CompactExerciseRow } from "./CompactExerciseRow";
import { ListRowSeparator } from "./ListRowSeparator";
import { PressOpacity } from "./PressOpacity";
import { StrengthButton, StrengthField, StrengthMessage, strengthStyles as s } from "./StrengthFormPrimitives";

const SEARCH_DEBOUNCE_MS = 300;

export function ExerciseSearchModal({ onSelect, onCancel }: { onSelect: (exercise: ExerciseDbExercise) => void; onCancel: () => void }) {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [results, setResults] = useState<ExerciseDbExercise[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const paginationGeneration = useRef(0);
  const validQuery = query.replace(/\s/g, "").length >= 2;

  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      if (!validQuery) return;
      setInitialLoad(true);
      setLoading(true);
      setError(null);
      setPaginationError(null);
      try {
        const page = await searchExerciseDb(query, controller.signal);
        if (version === generation.current && !controller.signal.aborted) {
          setResults(page.exercises);
          setCursor(page.nextCursor);
        }
      } catch (e) {
        if (!controller.signal.aborted && !isExerciseRequestCancelled(e)) {
          setError(e instanceof Error ? e.message : "Search failed.");
        }
      } finally {
        if (version === generation.current && !controller.signal.aborted) {
          setLoading(false);
          setInitialLoad(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      request.current?.abort();
      if (generation.current === version) generation.current += 1;
    };
  }, [query, retry, validQuery]);

  async function loadMore() {
    if (!cursor || loading || selecting || paginationError) return;
    const version = ++paginationGeneration.current;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const page = await searchExerciseDb(query, controller.signal, cursor);
      if (version === paginationGeneration.current && !controller.signal.aborted) {
        setResults((current) => [
          ...current,
          ...page.exercises.filter((exercise) => !current.some((existing) => existing.exerciseId === exercise.exerciseId)),
        ]);
        setCursor(page.nextCursor);
        setPaginationError(null);
      }
    } catch (e) {
      if (!controller.signal.aborted && !isExerciseRequestCancelled(e)) {
        setPaginationError(e instanceof Error ? e.message : "Couldn't load more exercises.");
      }
    } finally {
      if (version === paginationGeneration.current && !controller.signal.aborted) setLoading(false);
    }
  }

  async function select(exercise: ExerciseDbExercise) {
    if (selecting) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSelecting(true);
    setLoading(false);
    setError(null);
    try {
      const detail =
        exercise.instructions.length &&
        exercise.bodyParts.length &&
        exercise.targetMuscles.length &&
        exercise.equipments.length
          ? exercise
          : await getExerciseDbDetail(exercise.exerciseId, controller.signal);
      if (!controller.signal.aborted) {
        if (!isStrengthSearchResult(detail)) throw new Error("This exercise is classified as cardio. Choose another exercise.");
        onSelect(detail);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Couldn't load exercise details. Select it again to retry.");
      }
    } finally {
      if (!controller.signal.aborted) setSelecting(false);
    }
  }

  const listEmpty = !loading && !error && validQuery ? (
    <CollectionStateView compact label="No exercises found." variant="noMatch" />
  ) : null;

  const listFooter = (
    <>
      {paginationError ? (
        <CollectionStateView
          compact
          actionLabel="Retry"
          label={paginationError}
          variant="paginationError"
          onAction={() => {
            setPaginationError(null);
            void loadMore();
          }}
        />
      ) : null}
      {cursor && !paginationError ? (
        <PressOpacity
          accessibilityLabel="Load more exercises"
          disabled={loading || selecting}
          onPress={() => void loadMore()}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: "700", textAlign: "center" }}>
            {loading ? "Loading more..." : "Load more exercises"}
          </Text>
        </PressOpacity>
      ) : null}
      {loading && results.length > 0 ? (
        <CollectionStateView compact label="Loading more exercises..." variant="loading" />
      ) : null}
    </>
  );

  return (
    <View style={{ height: "100%", maxHeight: theme.layout.modalMaxHeight }}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.colors.text }]}>Add exercise</Text>
        <StrengthField
          autoFocus
          label="Search exercises"
          value={query}
          onChangeText={(value) => {
            request.current?.abort();
            paginationGeneration.current += 1;
            setResults([]);
            setCursor(null);
            setError(null);
            setPaginationError(null);
            setSelecting(false);
            const nextValid = value.replace(/\s/g, "").length >= 2;
            setLoading(nextValid);
            setInitialLoad(nextValid);
            setQuery(value);
          }}
        />
        {!validQuery ? <StrengthMessage>Enter at least two characters.</StrengthMessage> : null}
        {initialLoad && results.length === 0 ? (
          <CollectionStateView compact label={selecting ? "Loading exercise details" : "Searching exercises"} variant="loading" />
        ) : null}
        {error ? (
          <CollectionStateView
            actionLabel="Retry search"
            label={error}
            variant="error"
            onAction={() => {
              setError(null);
              setLoading(true);
              setInitialLoad(true);
              setRetry((value) => value + 1);
            }}
          />
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={s.body}
        data={results}
        ItemSeparatorComponent={ListRowSeparator}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(exercise) => exercise.exerciseId}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        renderItem={({ item }) => (
          <CompactExerciseRow disabled={selecting} exercise={item} onPress={() => void select(item)} />
        )}
      />
      <View style={s.actions}>
        <StrengthButton
          label="Cancel"
          onPress={() => {
            request.current?.abort();
            onCancel();
          }}
        />
      </View>
    </View>
  );
}
