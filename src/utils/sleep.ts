export function dateAtMinute(date: Date, minute: number) {
  const result = new Date(date);
  result.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return result;
}

export function getSleepBounds(
  wakeDate: Date,
  startMinute: number,
  endMinute: number,
) {
  const endAt = dateAtMinute(wakeDate, endMinute).getTime();
  const startDate = dateAtMinute(wakeDate, startMinute);

  if (startMinute > endMinute) {
    startDate.setDate(startDate.getDate() - 1);
  }

  return { startAt: startDate.getTime(), endAt };
}
