import type { CatalogExercise } from "./types";

export const STRENGTH_SEARCH_PAGE = 12;

export function normalizeExerciseQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function haystack(exercise: CatalogExercise) {
  return [exercise.name, ...exercise.aliases].map(normalizeExerciseQuery);
}

function matches(exercise: CatalogExercise, tokens: string[]) {
  const fields = haystack(exercise);
  return tokens.every((token) => fields.some((field) => field.includes(token)));
}

function rank(exercise: CatalogExercise, query: string) {
  const name = normalizeExerciseQuery(exercise.name);
  const aliases = exercise.aliases.map(normalizeExerciseQuery);
  if (name.startsWith(query)) {
    return 0;
  }
  if (aliases.some((alias) => alias.startsWith(query))) {
    return 1;
  }
  if (name.includes(query)) {
    return 2;
  }
  return 3;
}

export function searchExercises(
  exercises: readonly CatalogExercise[],
  query: string,
  limit: number,
) {
  const normalized = normalizeExerciseQuery(query);
  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  const pool =
    tokens.length === 0
      ? [...exercises]
      : exercises.filter((exercise) => matches(exercise, tokens));

  pool.sort((left, right) => {
    if (tokens.length > 0) {
      const score = rank(left, normalized) - rank(right, normalized);
      if (score !== 0) {
        return score;
      }
    }
    const name = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    return name === 0 ? left.id.localeCompare(right.id) : name;
  });

  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    matches: pool.slice(0, safeLimit),
    total: pool.length,
  };
}
