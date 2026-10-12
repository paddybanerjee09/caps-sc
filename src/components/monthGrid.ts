export const DEFAULT_WEEK_START = 1;
export const MAX_DAY_MARKERS = 3;

export type MonthEvent = {
  color: string;
  id: string;
  localDate: string;
  status: string;
  title: string;
};

export type MonthCell = {
  dayNumber: number;
  events: MonthEvent[];
  inMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  isoDate: string;
  markers: MonthEvent[];
  overflow: number;
};

export type MonthGrid = {
  cells: MonthCell[];
  monthIndex: number;
  weekCount: number;
  weekdayLabels: string[];
  year: number;
};

export function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { day, monthIndex, year };
}

export function shiftMonth(year: number, monthIndex: number, amount: number) {
  const next = new Date(year, monthIndex + amount, 1);
  return { monthIndex: next.getMonth(), year: next.getFullYear() };
}

export function monthLabel(year: number, monthIndex: number, locale: string) {
  return new Date(year, monthIndex, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function weekdayLabels(locale: string, weekStartsOn = DEFAULT_WEEK_START) {
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + weekStartsOn + index);
    return date.toLocaleDateString(locale, { weekday: "short" });
  });
}

export function buildMonthGrid(input: {
  events: MonthEvent[];
  locale?: string;
  monthIndex: number;
  selectedDate: string;
  today: string;
  weekStartsOn?: number;
  year: number;
}): MonthGrid {
  const weekStartsOn = input.weekStartsOn ?? DEFAULT_WEEK_START;
  const locale = input.locale ?? undefined;
  const firstWeekday = new Date(input.year, input.monthIndex, 1).getDay();
  const leading = (firstWeekday - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(input.year, input.monthIndex + 1, 0).getDate();
  const eventsByDate = new Map<string, MonthEvent[]>();

  for (const event of input.events) {
    const current = eventsByDate.get(event.localDate) ?? [];
    current.push(event);
    eventsByDate.set(event.localDate, current);
  }

  const cells: MonthCell[] = [];
  const cursor = new Date(input.year, input.monthIndex, 1 - leading);
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

  for (let index = 0; index < totalCells; index += 1) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const dayNumber = cursor.getDate();
    const date = isoDate(year, monthIndex, dayNumber);
    const events = eventsByDate.get(date) ?? [];
    cells.push({
      dayNumber,
      events,
      inMonth: monthIndex === input.monthIndex && year === input.year,
      isSelected: date === input.selectedDate,
      isToday: date === input.today,
      isoDate: date,
      markers: events.slice(0, MAX_DAY_MARKERS),
      overflow: Math.max(0, events.length - MAX_DAY_MARKERS),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    cells,
    monthIndex: input.monthIndex,
    weekCount: cells.length / 7,
    weekdayLabels: weekdayLabels(locale ?? "en-US", weekStartsOn),
    year: input.year,
  };
}

export function eventsOnDate(grid: MonthGrid, iso: string) {
  return grid.cells.find((cell) => cell.isoDate === iso)?.events ?? [];
}
