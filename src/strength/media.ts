import type { CatalogExercise } from "./types";

/** Render only supplied media metadata; upstream exercise ids are not image rights. */
export function strengthExerciseImageUrl(exercise: CatalogExercise): string | null {
  const url = exercise.imageUrl?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}
