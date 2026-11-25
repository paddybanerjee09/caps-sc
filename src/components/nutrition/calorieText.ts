/** Fit fixed-width calorie displays without shortening or changing their value. */
export function calorieFontSize(
  text: string,
  maximumSize: number,
  availableWidth: number,
  fontScale = 1,
) {
  const widthUnits = Array.from(text).reduce(
    (width, character) => width + (/\d/.test(character) ? 0.7 : 0.35),
    0,
  );
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return Math.min(maximumSize, availableWidth / Math.max(1, widthUnits)) / scale;
}
