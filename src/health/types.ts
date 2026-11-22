import type { HealthMeasurement, HealthPlatform, HealthState } from "../recovery/types";

export type HealthReadResult = {
  measurements: HealthMeasurement[];
  deletedExternalIds: string[];
  cursor: string;
  capabilities: Record<string, string>;
  errors: string[];
};

export interface HealthAdapter {
  platform: HealthPlatform;
  availability(): Promise<{ available: boolean; reason: string | null }>;
  requestReadPermission(): Promise<void>;
  read(state: HealthState | null): Promise<HealthReadResult>;
  subscribe?(callback: () => void): () => void;
}

/** Minimal source samples retained with native cursors so upstream sleep edits/deletes are reversible. */
export type SleepStage = {
  id: string;
  source: string;
  sourceApp?: string;
  sourceDevice?: string;
  start: string;
  end: string;
  timezone: string;
  kind: "asleep" | "in_bed" | "awake" | "unknown";
  nativeStage?: number;
  manuallyEntered?: boolean;
  timezoneBasis?: "source_offset" | "session_end_offset" | "device_at_import";
  originalStartZoneOffset?: unknown;
  originalEndZoneOffset?: unknown;
  sessionId?: string;
};

export type SleepCache = { stages: SleepStage[]; emittedIds: string[] };

export const unavailableCapabilities: Record<string, string> = {
  hrr60: "Unavailable: a matched standardized exercise/recovery protocol is required.",
  temperature_deviation: "Unavailable: no comparable personal skin-temperature baseline is configured.",
};
