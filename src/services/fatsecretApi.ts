import {
  FATSECRET_DETAILS_METHOD,
  FATSECRET_SEARCH_METHOD,
  normalizeFatSecretFood,
  normalizeFatSecretSearch,
} from "./fatsecretNormalize";
import { fetchWithTimeout, ProviderError } from "./providerError";
import type { CatalogFood, FoodSearchHit } from "../types/nutrition";

const TIMEOUT_MS = 8000;

function proxyBaseUrl() {
  const value = process.env.EXPO_PUBLIC_FATSECRET_PROXY_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function searchFatSecretFoods(
  query: string,
  signal?: AbortSignal,
): Promise<FoodSearchHit[]> {
  const baseUrl = proxyBaseUrl();

  if (!baseUrl) {
    throw new ProviderError("not-configured", "FatSecret proxy is not configured");
  }

  const url = new URL(`${baseUrl}/foods/search`);
  url.searchParams.set("q", query);
  const response = await fetchWithTimeout(url.toString(), { method: "GET" }, signal, TIMEOUT_MS);
  return normalizeFatSecretSearch(await readProxyJson(response));
}

export async function getFatSecretFood(
  foodId: string,
  signal?: AbortSignal,
): Promise<CatalogFood> {
  const baseUrl = proxyBaseUrl();

  if (!baseUrl) {
    throw new ProviderError("not-configured", "FatSecret proxy is not configured");
  }

  if (!/^\d+$/.test(foodId)) {
    throw new ProviderError("invalid-response", "Invalid FatSecret food id");
  }

  const url = new URL(`${baseUrl}/foods/details`);
  url.searchParams.set("food_id", foodId);
  const response = await fetchWithTimeout(url.toString(), { method: "GET" }, signal, TIMEOUT_MS);
  return normalizeFatSecretFood(await readProxyJson(response));
}

async function readProxyJson(response: Response) {
  if (response.status === 429) {
    throw new ProviderError("rate-limit", "FatSecret rate limit");
  }

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    throw new ProviderError("invalid-response", "FatSecret proxy returned invalid JSON");
  }

  if (!response.ok) {
    const code =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      (payload as { error?: string }).error === "not-configured"
        ? "not-configured"
        : "http";
    throw new ProviderError(code, "FatSecret request failed");
  }

  return payload;
}

export { FATSECRET_DETAILS_METHOD, FATSECRET_SEARCH_METHOD };
