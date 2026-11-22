const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
type CalendarDate = { year: number; month: number; day: number };

function validCalendarDate(year: number, month: number, day: number): CalendarDate | null {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null;
}

function calendarDate(value: Date | string): CalendarDate | null {
  if (typeof value === "string") {
    const key = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    // Calendar keys are already local dates. Never interpret them as midnight UTC.
    if (key) return validCalendarDate(Number(key[1]), Number(key[2]), Number(key[3]));
    const stamp = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
    if (!stamp || !validCalendarDate(Number(stamp[1]), Number(stamp[2]), Number(stamp[3]))) return null;
  }
  const instant = value instanceof Date ? value : new Date(value);
  return Number.isFinite(instant.getTime()) ? validCalendarDate(instant.getFullYear(), instant.getMonth() + 1, instant.getDate()) : null;
}

/** Presentation only. Persist/query/sort using the original ISO date or timestamp. */
export function formatDisplayDate(value: Date | string): string {
  const date = calendarDate(value);
  return date ? `${date.day} ${MONTHS[date.month - 1]}, ${date.year}` : "--";
}

export function formatDisplayMonth(value: Date | string): string {
  const key = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  const date = key ? validCalendarDate(Number(key[1]), Number(key[2]), 1) : calendarDate(value);
  return date ? `${MONTHS[date.month - 1]}, ${date.year}` : "--";
}

export function formatDisplayYear(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}$/.test(value)) return Number(value) >= 1 ? String(Number(value)) : "--";
  const date = calendarDate(value);
  return date ? String(date.year) : "--";
}
