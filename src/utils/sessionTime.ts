export class SessionTimeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionTimeValidationError";
  }
}

export function deriveSessionBoundsFromEnd(
  endedAt: number,
  durationSeconds: number,
  now: number = Date.now(),
): { startAt: number; endAt: number } {
  if (!Number.isInteger(endedAt) || endedAt < 0) {
    throw new SessionTimeValidationError("Session end time is invalid.");
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    throw new SessionTimeValidationError("Session duration is invalid.");
  }

  if (endedAt > now) {
    throw new SessionTimeValidationError(
      "Completed sessions cannot end in the future.",
    );
  }

  const durationMs =
    durationSeconds === 0 ? 1_000 : Math.round(durationSeconds * 1_000);
  const startAt = endedAt - durationMs;

  if (!Number.isFinite(startAt) || startAt < 0) {
    throw new SessionTimeValidationError("Session start time is invalid.");
  }

  if (startAt > now) {
    throw new SessionTimeValidationError(
      "Completed sessions cannot start in the future.",
    );
  }

  return { endAt: endedAt, startAt };
}
