import { normalizeBarcode } from "../nutrition/calculations";
import type { CatalogFood } from "../types/nutrition";
import { normalizeOpenFoodFactsProduct } from "./openFoodFactsNormalize";
import { fetchWithTimeout, ProviderError } from "./providerError";

const TIMEOUT_MS = 8000;
const USER_AGENT = "CAPS-SC/1.0 (nutrition barcode lookup)";

export async function lookupOpenFoodFactsBarcode(
  rawBarcode: string,
  signal?: AbortSignal,
): Promise<CatalogFood> {
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    throw new ProviderError("invalid-code", "Invalid barcode");
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_en,brands,serving_size,nutriments,status`;
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      method: "GET",
    },
    signal,
    TIMEOUT_MS,
  );

  if (response.status === 429) {
    throw new ProviderError("rate-limit", "Open Food Facts rate limit");
  }

  if (response.status === 404) {
    throw new ProviderError("not-found", "Product not found");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ProviderError("invalid-response", "Open Food Facts returned invalid JSON");
  }

  if (!response.ok) {
    throw new ProviderError("http", "Open Food Facts request failed");
  }

  return normalizeOpenFoodFactsProduct(payload, barcode);
}
