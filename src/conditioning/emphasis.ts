export const EMPHASIS_VERSION = "heuristic-v0.1";

export const emphasisCategories = [
  "aerobic_endurance",
  "aerobic_power",
  "lactic_capacity",
  "lactic_power",
  "alactic_capacity",
  "alactic_power",
] as const;

export type EmphasisCategory = (typeof emphasisCategories)[number];

export type EmphasisBout = {
  recoverySeconds?: number | null;
  workRpe: number | null;
  workSeconds: number | null;
};

export type EmphasisInput = {
  bouts: EmphasisBout[];
  recoverySeconds: number | null;
  sessionRpe: number | null;
  source: "actual" | "target_preview";
};

export type EmphasisResult = {
  confidence: "low";
  coverage: "complete" | "partial" | "insufficient_data";
  labels: { primary: EmphasisCategory | null; secondary: EmphasisCategory[] };
  missingFields: string[];
  scores: Record<EmphasisCategory, number | null>;
  source: EmphasisInput["source"];
  version: typeof EMPHASIS_VERSION;
};

const profiles: { test: (rpe: number, duration: number, ratio: number) => boolean; scores: number[] }[] = [
  { test: (rpe) => rpe <= 5, scores: [90, 25, 10, 5, 5, 0] },
  { test: (rpe, duration) => rpe <= 7 && duration >= 120, scores: [60, 75, 35, 15, 5, 0] },
  { test: (rpe, duration) => rpe <= 7 && duration < 120, scores: [50, 60, 50, 25, 15, 10] },
  { test: (rpe, duration, ratio) => rpe >= 8 && duration <= 10 && ratio >= 5, scores: [10, 20, 15, 20, 50, 90] },
  { test: (rpe, duration, ratio) => rpe >= 8 && duration <= 15 && ratio >= 2, scores: [15, 25, 30, 35, 80, 55] },
  { test: (rpe, duration, ratio) => rpe >= 8 && duration <= 15 && ratio < 2, scores: [25, 65, 65, 45, 50, 40] },
  { test: (rpe, duration, ratio) => rpe >= 8 && duration <= 45 && ratio >= 3, scores: [15, 40, 60, 85, 30, 20] },
  { test: (rpe, duration) => rpe >= 8 && duration <= 120, scores: [25, 60, 85, 55, 20, 10] },
  { test: (rpe, duration) => rpe >= 8 && duration > 120, scores: [50, 90, 55, 30, 5, 0] },
];

export function estimateEmphasis(input: EmphasisInput): EmphasisResult {
  const missing = new Set<string>();
  const known: { duration: number; rpe: number }[] = [];
  let unknownBout = false;

  for (const bout of input.bouts) {
    const rpe = bout.workRpe ?? input.sessionRpe;
    if (bout.workSeconds == null || rpe == null) {
      unknownBout = true;
      if (bout.workSeconds == null) {
        missing.add("work_duration");
      }
      if (rpe == null) {
        missing.add("work_rpe");
      }
      continue;
    }
    known.push({ duration: bout.workSeconds, rpe });
  }

  const knownWork = known.reduce((total, bout) => total + bout.duration, 0);
  if (known.length === 0 || knownWork <= 0 || input.recoverySeconds == null) {
    if (input.recoverySeconds == null) {
      missing.add("recovery");
    }
    return emptyResult(input.source, [...missing]);
  }

  const ratio = input.recoverySeconds / knownWork;
  const totals = [0, 0, 0, 0, 0, 0];
  for (const bout of known) {
    const profile = profiles.find((candidate) => candidate.test(bout.rpe, bout.duration, ratio));
    if (!profile) {
      return emptyResult(input.source, ["profile"]);
    }
    profile.scores.forEach((score, index) => {
      totals[index] += score * bout.duration;
    });
  }

  const scores = Object.fromEntries(
    emphasisCategories.map((category, index) => [
      category,
      clamp(Math.round(totals[index] / knownWork)),
    ]),
  ) as Record<EmphasisCategory, number>;

  const ranked = emphasisCategories
    .map((category) => ({ category, score: scores[category] }))
    .sort((left, right) => right.score - left.score || emphasisCategories.indexOf(left.category) - emphasisCategories.indexOf(right.category));
  const primary = ranked[0]?.category ?? null;
  const secondary = ranked
    .filter((item) => item.category !== primary && item.score >= 40)
    .slice(0, 2)
    .map((item) => item.category);

  return {
    confidence: "low",
    coverage: unknownBout ? "partial" : "complete",
    labels: { primary, secondary },
    missingFields: [...missing],
    scores,
    source: input.sessionRpe != null && input.bouts.some((bout) => bout.workRpe == null)
      ? input.source
      : input.source,
    version: EMPHASIS_VERSION,
  };
}

function emptyResult(source: EmphasisInput["source"], missingFields: string[]): EmphasisResult {
  return {
    confidence: "low",
    coverage: "insufficient_data",
    labels: { primary: null, secondary: [] },
    missingFields,
    scores: {
      aerobic_endurance: null,
      aerobic_power: null,
      alactic_capacity: null,
      alactic_power: null,
      lactic_capacity: null,
      lactic_power: null,
    },
    source,
    version: EMPHASIS_VERSION,
  };
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export const emphasisLabels: Record<EmphasisCategory, string> = {
  aerobic_endurance: "Aerobic endurance",
  aerobic_power: "Aerobic power",
  alactic_capacity: "Alactic capacity",
  alactic_power: "Alactic power",
  lactic_capacity: "Lactic capacity",
  lactic_power: "Lactic power",
};

export const emphasisColors: Record<EmphasisCategory, string> = {
  aerobic_endurance: "#2563EB",
  aerobic_power: "#0F766E",
  alactic_capacity: "#7C3AED",
  alactic_power: "#A21CAF",
  lactic_capacity: "#C2410C",
  lactic_power: "#B91C1C",
};
