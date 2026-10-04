export type ProviderErrorCode =
  | "not-configured"
  | "rate-limit"
  | "network"
  | "timeout"
  | "not-found"
  | "invalid-code"
  | "http"
  | "invalid-response";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

export function providerErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ProviderError)) {
    return fallback;
  }

  switch (error.code) {
    case "not-configured":
      return "Food search isn't configured.";
    case "rate-limit":
      return "The food service is rate limited. Try again later.";
    case "network":
      return "Couldn't reach the food service. Check your connection.";
    case "timeout":
      return "The food service took too long to respond.";
    case "not-found":
      return "No product was found for that barcode.";
    case "invalid-code":
      return "Enter a valid barcode.";
    case "http":
    case "invalid-response":
      return fallback;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (parentSignal?.aborted) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("timeout", "Request timed out");
    }

    throw new ProviderError("network", "Network request failed");
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
