import type { LocationPointInput, OccurrenceInput, SplitInput } from "../conditioning/types";
import type { ConditioningSessionRecord, UploadJobRecord } from "./conditioningRepository";

export const POINT_BATCH_SIZE = 250;

export type SyncTransport = {
  finalize: (sessionId: string) => Promise<void>;
  uploadOccurrences: (sessionId: string, occurrences: OccurrenceInput[]) => Promise<void>;
  uploadPoints: (sessionId: string, points: LocationPointInput[]) => Promise<void>;
  uploadSplits: (sessionId: string, splits: SplitInput[]) => Promise<void>;
  upsertSession: (session: ConditioningSessionRecord) => Promise<void>;
};

export type SyncBundle = {
  job: UploadJobRecord;
  occurrences: OccurrenceInput[];
  points: LocationPointInput[];
  session: ConditioningSessionRecord;
  splits: SplitInput[];
};

export async function syncConditioningBundle(bundle: SyncBundle, transport: SyncTransport) {
  const job = { ...bundle.job, status: "uploading" as const };
  await transport.upsertSession(bundle.session);

  const pendingPoints = bundle.points
    .filter((point) => point.sequence > job.acknowledgedPointSequence)
    .sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < pendingPoints.length; index += POINT_BATCH_SIZE) {
    const batch = pendingPoints.slice(index, index + POINT_BATCH_SIZE);
    await transport.uploadPoints(bundle.session.id, batch);
    job.acknowledgedPointSequence = batch.at(-1)?.sequence ?? job.acknowledgedPointSequence;
  }

  if (job.acknowledgedOccurrenceCount < bundle.occurrences.length) {
    await transport.uploadOccurrences(bundle.session.id, bundle.occurrences);
    job.acknowledgedOccurrenceCount = bundle.occurrences.length;
  }

  if (job.acknowledgedSplitCount < bundle.splits.length) {
    await transport.uploadSplits(bundle.session.id, bundle.splits);
    job.acknowledgedSplitCount = bundle.splits.length;
  }

  const complete =
    job.acknowledgedPointSequence >= maxSequence(bundle.points) &&
    job.acknowledgedOccurrenceCount >= bundle.occurrences.length &&
    job.acknowledgedSplitCount >= bundle.splits.length;
  if (!complete) {
    return { ...job, status: "pending" as const };
  }

  await transport.finalize(bundle.session.id);
  return { ...job, lastError: null, status: "synced" as const };
}

export function createHttpTransport(baseUrl: string, token: string | null): SyncTransport {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  async function send(path: string, body: unknown) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      body: JSON.stringify(body),
      headers,
      method: "PUT",
    });
    if (!response.ok) {
      throw new Error(`Sync failed (${response.status})`);
    }
  }

  return {
    finalize: (sessionId) => send(`/sessions/${sessionId}/finalize`, {}),
    uploadOccurrences: (sessionId, occurrences) =>
      send(`/sessions/${sessionId}/occurrences`, { occurrences }),
    uploadPoints: (sessionId, points) => send(`/sessions/${sessionId}/points`, { points }),
    uploadSplits: (sessionId, splits) => send(`/sessions/${sessionId}/splits`, { splits }),
    upsertSession: (session) => send(`/sessions/${session.id}`, { session }),
  };
}

function maxSequence(points: LocationPointInput[]) {
  return points.reduce((max, point) => Math.max(max, point.sequence), 0);
}
