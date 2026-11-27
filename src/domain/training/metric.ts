export const METRIC_MODEL_VERSION = "caps-v1";
export const STIMULUS_REFERENCE_MINIMUM = 10;

export type MetricReason = "missing" | "opted-out" | "stale" | "incompatible" | "insufficient-history" | "invalid" | "incomplete-coverage";
export type MetricResult = {
  metricId: string;
  modelVersion: string;
  status: "available" | "partial" | "unavailable";
  value: number | null;
  unit: string;
  method: string;
  coverage: { valid: number; total: number };
  usedInputs: string[];
  missingInputs: string[];
  reasonCodes: MetricReason[];
};

type Input = Omit<MetricResult, "modelVersion" | "reasonCodes" | "usedInputs" | "missingInputs"> &
  Partial<Pick<MetricResult, "reasonCodes" | "usedInputs" | "missingInputs">>;

export function trainingMetric(input: Input): MetricResult {
  const { status, value, reasonCodes = [], usedInputs = [], missingInputs = [] } = input;
  const invalid = value !== null && !Number.isFinite(value);
  const available = status !== "unavailable" && value !== null && !invalid;
  return {
    ...input,
    modelVersion: METRIC_MODEL_VERSION,
    status: available ? status : "unavailable",
    value: available ? value : null,
    usedInputs,
    missingInputs,
    reasonCodes: [...new Set<MetricReason>(invalid ? [...reasonCodes, "invalid"] : reasonCodes)],
  };
}

export function personalPercentile(value: number, reference: readonly number[]): number | null {
  if (!Number.isFinite(value) || !reference.length || reference.some(item => !Number.isFinite(item))) return null;
  const rank = reference.reduce((sum, item) => sum + (item < value ? 1 : item === value ? 0.5 : 0), 0);
  return 100 * rank / reference.length;
}
