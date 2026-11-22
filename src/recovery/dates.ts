import type { Questionnaire } from "./types";

export function isValidTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); return timezone.trim().length > 0; } catch { return false; }
}

export function isLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localDateInZone(instant: string | number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isInstant(value: string) {
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  return parts !== null && isLocalDate(parts[1]) && Number(parts[2]) < 24 && Number(parts[3]) < 60 && Number(parts[4]) < 60 && (parts[5] === undefined || (Number(parts[5]) <= 14 && Number(parts[6]) < 60)) && Number.isFinite(Date.parse(value));
}

export function isQuarterHour(value: string, timezone: string) {
  if (!isInstant(value) || !isValidTimezone(timezone)) return false;
  const minute = new Intl.DateTimeFormat("en-US", { timeZone: timezone, minute: "2-digit" }).format(new Date(value));
  return Number(minute) % 15 === 0 && new Date(value).getUTCSeconds() === 0 && new Date(value).getUTCMilliseconds() === 0;
}

export function toQuarterHourIso(date: Date) {
  const result = new Date(date);
  result.setMinutes(Math.round(result.getMinutes() / 15) * 15, 0, 0);
  return result.toISOString();
}

export function validateSleepTimes(q: Questionnaire, complete: boolean) {
  const errors: string[] = [];
  for (const [name, value] of [["Sleep onset", q.sleepOnset], ["Wake time", q.wakeTime]] as const) {
    if (value === null) { if (complete) errors.push(`${name} is required.`); }
    else if (!isQuarterHour(value, q.timezone)) errors.push(`${name} must be a valid datetime in 15-minute increments.`);
  }
  if (q.wakeTime && isInstant(q.wakeTime) && isValidTimezone(q.timezone) && localDateInZone(q.wakeTime, q.timezone) !== q.localDate) errors.push("Wake time must belong to the selected recovery date.");
  if (q.sleepOnset && q.wakeTime && isInstant(q.sleepOnset) && isInstant(q.wakeTime)) {
    const minutes = (Date.parse(q.wakeTime) - Date.parse(q.sleepOnset)) / 60_000;
    if (minutes <= 0 || minutes > 24 * 60) errors.push("Sleep interval must be positive and no longer than 24 hours.");
    if (q.minutesAwake !== null && q.minutesAwake > minutes) errors.push("Minutes awake cannot exceed the sleep interval.");
  }
  return errors;
}
