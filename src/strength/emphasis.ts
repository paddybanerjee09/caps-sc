import { appColorPalette } from "../theme/theme";
import { getStrengthTarget, performedSets, plannedSetTarget } from "./drafts";
import type { ExerciseDraft, LoadMode, StrengthSessionMode } from "./types";

/** Heuristic emphasis indexes. They may overlap and are not measured adaptation. */
export const STRENGTH_EMPHASIS_VERSION = "strength-emphasis-v2";

export const PRIMARY_SCORE_MINIMUM = 60;
export const PRIMARY_LEAD_MINIMUM = 15;

export const strengthQualities = [
  "hypertrophy",
  "power",
  "strength",
  "muscular_endurance",
] as const;

export type StrengthQuality = (typeof strengthQualities)[number];

export type EvidenceLevel = "unknown" | "low" | "moderate" | "high";

export type QualityEstimate = {
  coverage: number;
  evidenceLevel: EvidenceLevel;
  rationale: string;
  score: number | null;
  supportingSets: number;
};

export type StrengthEmphasis = {
  coverage: number;
  modelVersion: "strength-emphasis-v1" | typeof STRENGTH_EMPHASIS_VERSION;
  primary: StrengthQuality | null;
  qualities: Record<StrengthQuality, QualityEstimate>;
  tie: boolean;
  workSets: number;
};

export const strengthQualityLabels: Record<StrengthQuality, string> = {
  hypertrophy: "Hypertrophy",
  muscular_endurance: "Muscular Endurance",
  power: "Power",
  strength: "Strength",
};

export const strengthQualityColors: Record<StrengthQuality, string> = {
  hypertrophy: appColorPalette.purple,
  muscular_endurance: appColorPalette.green,
  power: appColorPalette.red,
  strength: appColorPalette.blue,
};

export const NEUTRAL_EMPHASIS_COLOR = "#9EA4B0";

const leadOrder: readonly StrengthQuality[] = [
  "strength",
  "hypertrophy",
  "power",
  "muscular_endurance",
];

export type EmphasisReference = {
  kg: number;
  kind: "load" | "assistance";
};

export type EmphasisSetInput = {
  assistanceKg: number | null;
  loadKg: number | null;
  maximalSingle?: boolean;
  reps: number;
  restSeconds: number | null;
  rir?: number | null;
  rpe: number | null;
  skipped: boolean;
  warmup: boolean;
};

export type EmphasisExerciseInput = {
  explosiveIntent: boolean;
  loadMode: LoadMode;
  reference: EmphasisReference | null;
  sets: readonly EmphasisSetInput[];
};

type WorkSet = EmphasisSetInput & {
  previousRestSeconds: number | null;
};

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function evidenceLevel(score: number | null): EvidenceLevel {
  if (score == null) {
    return "unknown";
  }
  if (score >= 75) {
    return "high";
  }
  if (score >= 55) {
    return "moderate";
  }
  return "low";
}

function workSetsOf(exercise: EmphasisExerciseInput): WorkSet[] {
  const sets: WorkSet[] = [];
  let previousRest: number | null = null;
  for (const set of exercise.sets) {
    if (set.skipped || set.warmup || set.reps <= 0) {
      continue;
    }
    sets.push({ ...set, previousRestSeconds: previousRest });
    previousRest = set.restSeconds;
  }
  return sets;
}

function relativeLoad(exercise: EmphasisExerciseInput, set: EmphasisSetInput) {
  const reference = exercise.reference;
  if (!reference || reference.kg <= 0) {
    return null;
  }
  if (
    (exercise.loadMode === "external" || exercise.loadMode === "bodyweight") &&
    reference.kind === "load" &&
    set.loadKg != null &&
    set.loadKg > 0
  ) {
    return set.loadKg / reference.kg;
  }
  if (
    exercise.loadMode === "assisted" &&
    reference.kind === "assistance" &&
    set.assistanceKg != null &&
    set.assistanceKg > 0
  ) {
    return reference.kg / set.assistanceKg;
  }
  return null;
}

function strengthSetScore(relative: number) {
  if (relative >= 1) {
    return 90;
  }
  if (relative >= 0.85) {
    return 75;
  }
  if (relative >= 0.7) {
    return 50;
  }
  return 25;
}

function strengthFromRepMaximum(set: EmphasisSetInput) {
  if (set.maximalSingle || (set.reps === 1 && set.rir === 0)) {
    return 90;
  }
  if (set.rir == null) {
    return null;
  }
  // Reps plus RIR estimate this set's rep maximum without inferring a weight.
  const estimatedRepMaximum = set.reps + set.rir;
  if (estimatedRepMaximum <= 3) {
    return 75;
  }
  if (estimatedRepMaximum <= 5) {
    return 65;
  }
  return null;
}

function powerSetScore(reps: number) {
  if (reps <= 5) {
    return 88;
  }
  if (reps <= 8) {
    return 62;
  }
  return 35;
}

function hypertrophyBase(count: number) {
  if (count <= 0) {
    return null;
  }
  if (count <= 2) {
    return 40;
  }
  if (count <= 5) {
    return 65;
  }
  if (count <= 9) {
    return 82;
  }
  return 92;
}

function enduranceBase(count: number) {
  if (count <= 0) {
    return null;
  }
  if (count <= 2) {
    return 45;
  }
  if (count <= 5) {
    return 70;
  }
  return 88;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number) {
  return roundScore(Math.min(100, Math.max(0, value)));
}

function unknownQuality(rationale: string): QualityEstimate {
  return {
    coverage: 0,
    evidenceLevel: "unknown",
    rationale,
    score: null,
    supportingSets: 0,
  };
}

function scoredQuality(
  score: number,
  supportingSets: number,
  workSets: number,
  rationale: string,
): QualityEstimate {
  return {
    coverage: workSets === 0 ? 0 : supportingSets / workSets,
    evidenceLevel: evidenceLevel(score),
    rationale,
    score,
    supportingSets,
  };
}

export function estimateStrengthEmphasis(
  exercises: readonly EmphasisExerciseInput[],
): StrengthEmphasis {
  const grouped = exercises.map((exercise) => ({
    exercise,
    sets: workSetsOf(exercise),
  }));
  const workSets = grouped.reduce((sum, group) => sum + group.sets.length, 0);

  const strengthScores: number[] = [];
  let loadComparisons = 0;
  const powerScores: number[] = [];
  const hypertrophySets: WorkSet[] = [];
  const enduranceSets: WorkSet[] = [];
  const contributed = new Set<WorkSet>();

  for (const group of grouped) {
    for (const set of group.sets) {
      const relative = relativeLoad(group.exercise, set);
      if (relative != null) {
        strengthScores.push(strengthSetScore(relative));
        loadComparisons += 1;
        contributed.add(set);
      } else {
        const repMaximumScore = strengthFromRepMaximum(set);
        if (repMaximumScore != null) {
          strengthScores.push(repMaximumScore);
          contributed.add(set);
        }
      }
      if (group.exercise.explosiveIntent) {
        powerScores.push(powerSetScore(set.reps));
        contributed.add(set);
      }
      if (set.reps >= 5 && set.reps <= 30) {
        hypertrophySets.push(set);
        contributed.add(set);
      }
      const observedRest =
        set.restSeconds != null || set.previousRestSeconds != null;
      if (set.reps >= 15 && (observedRest || set.rpe != null || set.rir != null)) {
        enduranceSets.push(set);
        contributed.add(set);
      }
    }
  }

  const qualities = {
    hypertrophy: scoreHypertrophy(hypertrophySets, workSets),
    muscular_endurance: scoreEndurance(enduranceSets, workSets),
    power: scorePower(powerScores, workSets),
    strength: scoreStrength(strengthScores, workSets, loadComparisons),
  };

  const ranked = strengthQualities
    .map((quality) => ({ quality, score: qualities[quality].score }))
    .filter((item): item is { quality: StrengthQuality; score: number } => item.score != null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        leadOrder.indexOf(left.quality) - leadOrder.indexOf(right.quality),
    );

  const leader = ranked[0];
  const runnerUp = ranked[1];
  let primary: StrengthQuality | null = null;
  let tie = false;
  if (leader && leader.score >= PRIMARY_SCORE_MINIMUM) {
    const lead = runnerUp ? leader.score - runnerUp.score : PRIMARY_LEAD_MINIMUM;
    if (lead < PRIMARY_LEAD_MINIMUM) {
      tie = true;
    } else {
      primary = leader.quality;
    }
  }

  return {
    coverage: workSets === 0 ? 0 : contributed.size / workSets,
    modelVersion: STRENGTH_EMPHASIS_VERSION,
    primary,
    qualities,
    tie,
    workSets,
  };
}

function scoreStrength(
  scores: number[],
  workSets: number,
  loadComparisons: number,
): QualityEstimate {
  if (scores.length === 0) {
    return unknownQuality("No same-lift load comparison or low-rep maximum estimate.");
  }
  const repMaximums = scores.length - loadComparisons;
  const rationale = [
    loadComparisons > 0 && `${loadComparisons} from same-lift loads`,
    repMaximums > 0 && `${repMaximums} from low-rep maximum estimates`,
  ].filter(Boolean).join(", ");
  return scoredQuality(
    roundScore(mean(scores)),
    scores.length,
    workSets,
    `Work sets supporting strength include ${rationale}.`,
  );
}

function scorePower(scores: number[], workSets: number): QualityEstimate {
  if (scores.length === 0) {
    return unknownQuality("No explosive intent, so power is unknown.");
  }
  return scoredQuality(
    roundScore(mean(scores)),
    scores.length,
    workSets,
    `${scores.length} work sets marked with explosive intent.`,
  );
}

function scoreHypertrophy(sets: WorkSet[], workSets: number): QualityEstimate {
  const base = hypertrophyBase(sets.length);
  if (base == null) {
    return unknownQuality("No work sets in the 5–30 rep range.");
  }
  const noRir = sets.filter((set) => set.rir == null);
  const fallback = hypertrophyWithRpe(base, noRir);
  const score = mean(
    sets.map((set) => set.rir == null ? fallback : hypertrophyWithRir(base, set.rir)),
  );
  const rirSets = sets.length - noRir.length;
  return scoredQuality(
    clampScore(score),
    sets.length,
    workSets,
    rirSets > 0
      ? `${sets.length} work sets in the 5–30 rep range, ${rirSets} with RIR.`
      : `${sets.length} work sets in the 5–30 rep range.`,
  );
}

function hypertrophyWithRpe(base: number, sets: readonly WorkSet[]) {
  const ratings = sets.flatMap((set) => set.rpe == null ? [] : [set.rpe]);
  if (ratings.length === 0 || ratings.length * 2 < sets.length) {
    return base;
  }
  const effort = mean(ratings);
  if (effort >= 8) {
    return base + 8;
  }
  if (effort <= 5) {
    return base - 12;
  }
  return base;
}

function hypertrophyWithRir(base: number, rir: number) {
  // Refalo et al. (2024, PMID 38393985) found similar growth at 0 and 1–2 RIR.
  // These weights are activity-index heuristics. The 10+ bin uses its lower bound.
  if (rir <= 2) {
    return base + 8;
  }
  return base * (1 - 0.125 * Math.max(0, Math.min(rir, 10) - 4));
}

function scoreEndurance(sets: WorkSet[], workSets: number): QualityEstimate {
  const base = enduranceBase(sets.length);
  if (base == null) {
    return unknownQuality(
      "No high-rep sets with rest or effort, so muscular endurance is unknown.",
    );
  }
  const rests = sets.map((set) =>
    set.restSeconds != null ? set.restSeconds : set.previousRestSeconds,
  );
  const observed = rests.filter((rest): rest is number => rest != null);
  let score = base;
  if (observed.length > 0 && mean(observed) <= 60) {
    score += 7;
  }
  return scoredQuality(
    clampScore(score),
    sets.length,
    workSets,
    `${sets.length} high-rep sets with rest or effort filled in.`,
  );
}

export function emphasisFromDraft(
  exercises: readonly ExerciseDraft[],
  references: ReadonlyMap<string, EmphasisReference>,
  mode: StrengthSessionMode = "completed",
) {
  return estimateStrengthEmphasis(
    exercises.map((exercise) => ({
      explosiveIntent: exercise.explosiveIntent,
      loadMode: exercise.loadMode,
      reference: exercise.catalogExerciseId
        ? (references.get(exercise.catalogExerciseId) ?? null)
        : null,
      sets: mode === "planned" ? plannedEmphasisSets(exercise) : performedSets(exercise),
    })),
  );
}

function plannedEmphasisSets(exercise: ExerciseDraft): EmphasisSetInput[] {
  const target = getStrengthTarget(exercise);
  const prescription = plannedSetTarget(exercise);
  const maximalSingle =
    target.repRange === "1RM" && (target.rir == null || target.rir === 0);
  // Repeated prescriptions weight the estimate by volume without creating draft sets.
  return Array.from({ length: target.sets }, () => ({
    ...prescription,
    maximalSingle,
    skipped: false,
    warmup: false,
  }));
}

export function emphasisMarkerColor(emphasis: StrengthEmphasis) {
  if (!emphasis.primary) {
    return NEUTRAL_EMPHASIS_COLOR;
  }
  return strengthQualityColors[emphasis.primary];
}

export function emphasisHeadline(emphasis: StrengthEmphasis) {
  if (emphasis.primary) {
    return strengthQualityLabels[emphasis.primary];
  }
  if (emphasis.tie) {
    return "Mixed focus";
  }
  return "Not enough evidence";
}
