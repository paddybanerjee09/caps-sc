import type { ExerciseDbExercise } from "../types/strength";

export const exerciseDbFreeBaseUrl = "https://oss.exercisedb.dev/api/v1";
// Enhanced requests are ONLY for a future first-party server proxy. No key/header
// configuration exists in this client adapter.
export type ExerciseDbConfig = { tier: "free"; baseUrl?: string } | { tier: "proxy"; baseUrl: string };
export type ExerciseSearchPage = { exercises: ExerciseDbExercise[]; nextCursor: string | null };
export class ExerciseDbError extends Error {
  constructor(message: string, public readonly kind: "network" | "http" | "rate-limit" | "malformed", public readonly status?: number) { super(message); this.name = "ExerciseDbError"; }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExerciseDbError("Exercise service returned an invalid response.", "malformed");
  return value as Record<string, unknown>;
}
function strings(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(v => typeof v === "string")) throw new ExerciseDbError("Exercise fields are invalid.", "malformed");
  return value.map(v => v.trim()).filter(Boolean);
}
function mediaUrl(value: unknown): string | null {
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
}
function firstMedia(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.values(value).map(mediaUrl).find(Boolean) ?? null;
}
export function normalizeExerciseDbExercise(value: unknown): ExerciseDbExercise {
  const row = object(value);
  if (typeof row.exerciseId !== "string" || !row.exerciseId.trim() || typeof row.name !== "string" || !row.name.trim())
    throw new ExerciseDbError("Exercise identity is missing.", "malformed");
  return { exerciseId: row.exerciseId, name: row.name.trim(), gifUrl: mediaUrl(row.gifUrl) ?? firstMedia(row.gifUrls) ?? mediaUrl(row.imageUrl) ?? firstMedia(row.imageUrls),
    bodyParts: strings(row.bodyParts), targetMuscles: strings(row.targetMuscles), secondaryMuscles: strings(row.secondaryMuscles),
    equipments: strings(row.equipments), instructions: strings(row.instructions),
    ...(row.exerciseTypes === undefined ? {} : { exerciseTypes: strings(row.exerciseTypes) }) };
}
export function isStrengthSearchResult(e: ExerciseDbExercise) {
  if (e.exerciseTypes?.some(type => type.toLowerCase() === "cardio")) return false;
  // Free records lack exerciseTypes. Only obvious cardio names are excluded.
  return e.exerciseTypes !== undefined || !/\b(treadmill|elliptical|stationary bike|jump rope|jumping jack|running|jogging)\b/i.test(e.name);
}
export function buildExerciseSearchUrl(query: string, cursor: string | null = null, config: ExerciseDbConfig = { tier: "free" }) {
  const base = (config.baseUrl ?? exerciseDbFreeBaseUrl).replace(/\/$/, "");
  const params = new URLSearchParams({ limit: "25" });
  if (config.tier === "proxy") {
    params.set("name", query.trim()); params.set("exerciseTypes", "strength");
    if (cursor) params.set("after", cursor);
    return `${base}/exercises?${params.toString()}`;
  }
  params.set("q", query.trim());
  if (cursor) params.set("offset", cursor);
  return `${base}/exercises/search?${params.toString()}`;
}
async function request(url: string, signal?: AbortSignal): Promise<unknown> {
  try {
    signal?.throwIfAborted();
    const response = await fetch(url, { signal, cache: "no-store" });
    if (response.status === 429) throw new ExerciseDbError("Exercise service rate limit reached. Wait a moment, then retry.", "rate-limit", 429);
    if (!response.ok) throw new ExerciseDbError(`Exercise service request failed (${response.status}). Please retry.`, "http", response.status);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ExerciseDbError("Exercise service returned invalid JSON.", "malformed"); }
    signal?.throwIfAborted();
    if (object(payload).success === false || object(payload).error) throw new ExerciseDbError("Exercise service reported an API error. Please retry.", "http");
    return payload;
  } catch (error) {
    if (signal?.aborted || isExerciseRequestCancelled(error) || error instanceof ExerciseDbError) throw error;
    throw new ExerciseDbError("Couldn't reach the exercise service. Check your connection and retry.", "network");
  }
}
export function isExerciseRequestCancelled(error: unknown) { return error instanceof Error && error.name === "AbortError"; }
export async function searchExerciseDb(query: string, signal?: AbortSignal, cursor: string | null = null, config: ExerciseDbConfig = { tier: "free" }): Promise<ExerciseSearchPage> {
  if (query.replace(/\s/g, "").length < 2) return { exercises: [], nextCursor: null };
  const payload = object(await request(buildExerciseSearchUrl(query, cursor, config), signal));
  const data = Array.isArray(payload.data) ? payload.data : object(payload.data).exercises;
  if (!Array.isArray(data)) throw new ExerciseDbError("Exercise results are missing.", "malformed");
  const exercises = data.map(normalizeExerciseDbExercise).filter(isStrengthSearchResult);
  let nextCursor: string | null = null;
  if (config.tier === "proxy") {
    const meta = object(payload.meta);
    if (meta.hasNextPage === true && typeof meta.nextCursor === "string") nextCursor = meta.nextCursor;
  } else {
    const meta = payload.metadata && typeof payload.metadata === "object" ? object(payload.metadata) : null;
    if (meta && typeof meta.nextPage === "string" && meta.nextPage) {
      try { nextCursor = new URL(meta.nextPage, exerciseDbFreeBaseUrl).searchParams.get("offset"); } catch { /* Ignore malformed pagination links. */ }
    } else if (data.length === 25) nextCursor = String(Number(cursor ?? 0) + 25);
  }
  return { exercises, nextCursor };
}
export async function getExerciseDbDetail(id: string, signal?: AbortSignal): Promise<ExerciseDbExercise> {
  if (!id.trim()) throw new ExerciseDbError("Exercise ID is missing.", "malformed");
  const payload = object(await request(`${exerciseDbFreeBaseUrl}/exercises/${encodeURIComponent(id)}`, signal));
  const exercise = normalizeExerciseDbExercise(payload.data);
  if (exercise.exerciseId !== id) throw new ExerciseDbError("Exercise detail ID did not match.", "malformed");
  return exercise;
}
