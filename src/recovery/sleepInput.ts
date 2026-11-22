/** Construct only real local wall times; Date.setHours otherwise silently normalizes DST gaps. */
export function sleepClockInstant(base: Date, minutes: number): Date | null {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440 || minutes % 15) return null;
  const next = new Date(base);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next.getHours() * 60 + next.getMinutes() === minutes ? next : null;
}

/** A repeated local clock time can have two instants; expose the alternative explicitly. */
export function alternateSleepInstant(value: Date): Date | null {
  for (let offset = -120; offset <= 120; offset += 30) {
    if (!offset) continue;
    const other = new Date(value.getTime() + offset * 60_000);
    if (other.getFullYear() === value.getFullYear() && other.getMonth() === value.getMonth() && other.getDate() === value.getDate() && other.getHours() === value.getHours() && other.getMinutes() === value.getMinutes() && other.getTimezoneOffset() !== value.getTimezoneOffset()) return other;
  }
  return null;
}
