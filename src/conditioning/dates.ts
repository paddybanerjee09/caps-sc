import type { SessionStatus } from "./types";

/** Monday. CAPS has no week-start setting. */
export const DEFAULT_WEEK_START = 1;

export function deviceTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone || "UTC";
}

export function isIanaTimeZone(value: string) {
  if (!value.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isLocalDateString(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isLocalTimeString(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function localDateFromInstant(instant: number) {
  return formatLocalDate(new Date(instant));
}

export function localTimeFromInstant(instant: number) {
  const date = new Date(instant);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function scheduledInstant(localDate: string, localTime: string | null) {
  if (!isLocalDateString(localDate)) {
    return null;
  }

  if (localTime !== null && !isLocalTimeString(localTime)) {
    return null;
  }

  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime ? localTime.split(":").map(Number) : [0, 0];
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

export function combineLocalDateAndTime(localDate: string, time: Date) {
  if (!isLocalDateString(localDate)) {
    return null;
  }

  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  ).getTime();
}

export function calendarDateForSession(session: {
  performedLocalDate: string | null;
  scheduledLocalDate: string | null;
}) {
  return session.performedLocalDate ?? session.scheduledLocalDate;
}

export function markerForSessionStatus(status: SessionStatus) {
  if (status === "completed" || status === "ended_early") {
    return "logged" as const;
  }

  if (status === "planned") {
    return "planned" as const;
  }

  return "draft" as const;
}

export function isPerformedTimestampAllowed(timestamp: number, now = Date.now()) {
  return Number.isFinite(timestamp) && timestamp <= now;
}
