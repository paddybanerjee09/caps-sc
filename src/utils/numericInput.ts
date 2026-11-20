/** Parse a complete decimal entry, including keyboards that use a comma separator. */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
