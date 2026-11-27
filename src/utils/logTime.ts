import { formatDisplayDate } from "./displayDate";

export function nextLogMinute(now: number, minuteInterval = 1) {
  const interval = minuteInterval * 60_000;
  return new Date((Math.floor(now / interval) + 1) * interval);
}

/** Change the local calendar day, preserving wall-clock time across DST changes. */
export function shiftLogDay(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

export function clampLogDate(value: Date, minimumDate?: Date, maximumDate?: Date) {
  return new Date(Math.min(maximumDate?.getTime() ?? Infinity,
    Math.max(minimumDate?.getTime() ?? -Infinity, value.getTime())));
}

export function formatLogDay(value: Date, today = new Date()) {
  const sameDay = value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth() && value.getDate() === today.getDate();
  const day = formatDisplayDate(value);
  return sameDay ? `Today, ${day}` : day;
}
