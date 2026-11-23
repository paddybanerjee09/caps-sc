/** Date-only profile values use local calendar dates, never UTC timestamps. */
export function birthDateParts(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day } : null;
}

export function formatBirthDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calculateAge(value: string | null | undefined, today = new Date()) {
  const birth = birthDateParts(value);
  if (!birth) return null;
  let age = today.getFullYear() - birth.year;
  if (today.getMonth() + 1 < birth.month || (today.getMonth() + 1 === birth.month && today.getDate() < birth.day)) age -= 1;
  return age >= 0 ? age : null;
}

export function isValidBirthDate(value: string, today = new Date()) {
  const parts = birthDateParts(value);
  return parts !== null && parts.year >= today.getFullYear() - 120 && value <= formatBirthDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
}
