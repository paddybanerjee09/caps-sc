import type { ExerciseDbExercise } from "../types/exerciseDb";
import { formatExerciseDbTitle } from "../utils/exerciseDbFormatting";

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
function formatTaxonomy(values: string[]): string[] {
  return values.map(formatExerciseDbTitle).filter(Boolean);
}
export function normalizeExerciseDbExercise(value: unknown): ExerciseDbExercise {
  const row = object(value);
  if (typeof row.exerciseId !== "string" || !row.exerciseId.trim() || typeof row.name !== "string" || !row.name.trim())
    throw new ExerciseDbError("Exercise identity is missing.", "malformed");
  const instructions = strings(row.instructions);
  return {
    exerciseId: row.exerciseId.trim(),
    name: formatExerciseDbTitle(row.name),
    gifUrl: mediaUrl(row.gifUrl) ?? firstMedia(row.gifUrls) ?? mediaUrl(row.imageUrl) ?? firstMedia(row.imageUrls),
    bodyParts: formatTaxonomy(strings(row.bodyParts)),
    targetMuscles: formatTaxonomy(strings(row.targetMuscles)),
    secondaryMuscles: formatTaxonomy(strings(row.secondaryMuscles)),
    equipments: formatTaxonomy(strings(row.equipments)),
    instructions,
    ...(row.exerciseTypes === undefined ? {} : { exerciseTypes: formatTaxonomy(strings(row.exerciseTypes)) }),
  };
}
export function isStrengthSearchResult(e: ExerciseDbExercise) {
  if (e.exerciseTypes?.some(type => type.toLowerCase() === "cardio")) return false;
  // Free records lack exerciseTypes. Only obvious cardio names are excluded.
  return Boolean(e.exerciseTypes?.length) || !/\b(treadmill|elliptical|stationary bike|jump rope|jumping jacks?|running|jogging)\b/i.test(e.name);
}
export function buildExerciseSearchUrl(query: string, cursor: string | null = null, config: ExerciseDbConfig = { tier: "free" }) {
  const base = (config.baseUrl ?? exerciseDbFreeBaseUrl).replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("limit", "25");
  params.set("name", query.trim());
  if (config.tier === "proxy") params.set("exerciseTypes", "strength");
  if (cursor) params.set("after", cursor);
  return `${base}/exercises?${params.toString()}`;
}
async function request(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, 15_000);
  try {
    throwIfCancelled(controller.signal);
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (response.status === 429) throw new ExerciseDbError("Exercise service rate limit reached. Wait a moment, then retry.", "rate-limit", 429);
    if (!response.ok) throw new ExerciseDbError(`Exercise service request failed (${response.status}). Please retry.`, "http", response.status);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ExerciseDbError("Exercise service returned invalid JSON.", "malformed"); }
    throwIfCancelled(controller.signal);
    if (object(payload).success === false || object(payload).error) throw new ExerciseDbError("Exercise service reported an API error. Please retry.", "http");
    return payload;
  } catch (error) {
    if (signal?.aborted) throwIfCancelled(signal);
    if (controller.signal.aborted) throw new ExerciseDbError("Exercise request timed out. Please retry.", "network");
    if (isExerciseRequestCancelled(error) || error instanceof ExerciseDbError) throw error;
    throw new ExerciseDbError("Couldn't reach the exercise service. Check your connection and retry.", "network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
function throwIfCancelled(signal: AbortSignal) {
  if (signal.aborted) { const error = new Error("Exercise request cancelled."); error.name = "AbortError"; throw error; }
}
export function isExerciseRequestCancelled(error: unknown) { return error instanceof Error && error.name === "AbortError"; }
function parseSearchCursor(payload: Record<string, unknown>): string | null {
  if (!payload.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) return null;
  const meta = payload.meta as Record<string, unknown>;
  if (meta.hasNextPage === true && typeof meta.nextCursor === "string" && meta.nextCursor.trim()) return meta.nextCursor;
  return null;
}
export async function searchExerciseDb(query: string, signal?: AbortSignal, cursor: string | null = null, config: ExerciseDbConfig = { tier: "free" }): Promise<ExerciseSearchPage> {
  if (query.replace(/\s/g, "").length < 2) return { exercises: [], nextCursor: null };
  const payload = object(await request(buildExerciseSearchUrl(query, cursor, config), signal));
  const data = Array.isArray(payload.data) ? payload.data : object(payload.data).exercises;
  if (!Array.isArray(data)) throw new ExerciseDbError("Exercise results are missing.", "malformed");
  const exercises = data.map(normalizeExerciseDbExercise).filter(isStrengthSearchResult);
  return { exercises, nextCursor: parseSearchCursor(payload) };
}
export async function getExerciseDbDetail(id: string, signal?: AbortSignal, config: ExerciseDbConfig = { tier: "free" }): Promise<ExerciseDbExercise> {
  if (!id.trim()) throw new ExerciseDbError("Exercise ID is missing.", "malformed");
  const base = (config.baseUrl ?? exerciseDbFreeBaseUrl).replace(/\/$/, "");
  const payload = object(await request(`${base}/exercises/${encodeURIComponent(id)}`, signal));
  const exercise = normalizeExerciseDbExercise(payload.data);
  if (exercise.exerciseId !== id) throw new ExerciseDbError("Exercise detail ID did not match.", "malformed");
  return exercise;
}
