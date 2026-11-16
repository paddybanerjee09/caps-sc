import type { CatalogExercise } from "./types";

export const STRENGTH_SEARCH_PAGE = 12;

function normalizeExerciseQuery(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rank(name: string, aliases: string[], query: string) {
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
  const tokens = normalized ? normalized.split(" ") : [];
  const pool: { exercise: CatalogExercise; rank: number }[] = [];

  for (const exercise of exercises) {
    if (!normalized) {
      pool.push({ exercise, rank: 0 });
      continue;
    }
    const name = normalizeExerciseQuery(exercise.name);
    const aliases = exercise.aliases.map(normalizeExerciseQuery);
    const fields = [name, ...aliases];
    if (tokens.every((token) => fields.some((field) => field.includes(token)))) {
      pool.push({ exercise, rank: rank(name, aliases, normalized) });
    }
  }

  pool.sort(({ exercise: left, rank: leftRank }, { exercise: right, rank: rightRank }) => {
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const name = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    return name === 0 ? left.id.localeCompare(right.id) : name;
  });

  const safeLimit = Math.max(0, Math.floor(limit));
  return {
    matches: pool.slice(0, safeLimit).map(({ exercise }) => exercise),
    total: pool.length,
  };
}
