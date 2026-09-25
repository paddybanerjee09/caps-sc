const EXERCISE_DB_ACRONYMS: Record<string, string> = {
  ez: "EZ",
  trx: "TRX",
  rdl: "RDL",
  hiit: "HIIT",
};

function formatWord(word: string): string {
  const lower = word.toLowerCase();
  if (EXERCISE_DB_ACRONYMS[lower]) return EXERCISE_DB_ACRONYMS[lower];

  const apostropheIndex = word.indexOf("'");
  if (apostropheIndex >= 0) {
    const before = word.slice(0, apostropheIndex);
    const after = word.slice(apostropheIndex + 1);
    const formattedBefore = formatWord(before);
    if (!after) return `${formattedBefore}'`;
    return `${formattedBefore}'${after.toLowerCase()}`;
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function formatExerciseDbTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return trimmed
    .split(/([\s-]+)/)
    .map((segment) => {
      if (/^[\s-]+$/.test(segment)) return segment.replace(/\s+/g, " ");
      return formatWord(segment);
    })
    .join("");
}
