import { trainingMetric, type MetricReason, type MetricResult } from "../domain/training/metric";
import { performedSets, supportsStrengthMaxTest } from "./drafts";
import type { ExerciseDraft, StrengthSetRecord } from "./types";

/** CAPS v1 defaults for logged exposure, with no gain or adaptation prediction. */
export const STRENGTH_STIMULUS_V1 = {
  trialEffortZeroAtRir: 6,
  trialEffortRirSpan: 4,
  secondaryInvolvement: 0.5,
  hardSetMaxRir: 2,
  veryLowRelativeLoad: 0.30,
} as const;

type RepMeasurements = {
  /** Stable device, source, sampling protocol and exercise setup identifier. */
  methodKey: string;
  values: readonly (number | null)[];
};

export type StrengthStimulusSet = Omit<StrengthSetRecord, "position"> & {
  repPowerWatts?: RepMeasurements;
  concentricVelocityMps?: RepMeasurements;
};

export type StrengthStimulusExercise = Pick<ExerciseDraft,
  "catalogExerciseId" | "equipment" | "id" | "loadMode" | "muscleGroups" | "name" | "unilateral"
> & {
  /** Supply only explicitly supported secondary catalog targets. */
  secondaryMuscleGroups?: readonly string[];
  sets: readonly StrengthStimulusSet[];
};

export type StrengthMaxReference = {
  catalogExerciseId: string;
  equipment: string;
  unilateral: boolean;
  rom: string | null;
  kg: number;
  performedAt: number;
  sessionId: string;
};

type MetricOptions = {
  metricId: string;
  value: number | null;
  unit: string;
  method: string;
  valid: number;
  total: number;
  usedInputs?: string[];
  missingInputs?: string[];
  reasons?: MetricReason[];
  fallback?: boolean;
};

function metric({ metricId, value, unit, method, valid, total, usedInputs, missingInputs, reasons, fallback }: MetricOptions): MetricResult {
  return trainingMetric({
    metricId, value, unit, method, coverage: { valid, total }, usedInputs, missingInputs,
    reasonCodes: reasons ?? (valid < total ? ["incomplete-coverage"] : []),
    status: value == null ? "unavailable" : fallback || valid < total ? "partial" : "available",
  });
}

function numeric(value: number | null | undefined, minimum = 0): value is number {
  return value != null && Number.isFinite(value) && value >= minimum;
}

function positive(value: number | null | undefined): value is number {
  return numeric(value) && value > 0;
}

function validRir(rir: number | null | undefined): rir is number {
  return numeric(rir) && Number.isInteger(rir) && rir <= 10;
}

function positiveReps(set: StrengthStimulusSet) {
  return !set.isometric && Number.isInteger(set.reps) && set.reps > 0;
}

function workingSets(exercises: readonly StrengthStimulusExercise[]) {
  const visited = new Set<string>();
  return exercises.flatMap((exercise) => exercise.sets.flatMap((set) => {
    if (set.skipped || set.warmup || visited.has(set.id)) return [];
    if (!(set.isometric ? positive(set.workSeconds) : positiveReps(set))) return [];
    visited.add(set.id);
    return [{ exercise, set }];
  }));
}

type Context = { sessionId: string; endedAt: number };
type WorkingSet = ReturnType<typeof workingSets>[number];

function strengthKey({ catalogExerciseId, equipment, unilateral, loadMode }: StrengthStimulusExercise, rom: string | null | undefined) {
  const confirmedEquipment = equipment.trim().toLowerCase();
  return JSON.stringify([catalogExerciseId, confirmedEquipment, unilateral, loadMode, normalizedRom(rom)]);
}

function normalizedRom(rom: string | null | undefined) {
  return rom?.trim().toLowerCase() || null;
}

function referencesFor(references: readonly StrengthMaxReference[], context: Context) {
  const map = new Map<string, StrengthMaxReference>();
  for (const reference of references) {
    if (!Number.isFinite(reference.performedAt) || reference.performedAt >= context.endedAt
      || reference.sessionId === context.sessionId || !positive(reference.kg)) continue;
    const equipment = reference.equipment.trim().toLowerCase();
    const key = JSON.stringify([reference.catalogExerciseId, equipment, reference.unilateral, normalizedRom(reference.rom)]);
    const previous = map.get(key);
    if (!previous || reference.performedAt > previous.performedAt
      || (reference.performedAt === previous.performedAt && reference.kg > previous.kg)) {
      map.set(key, reference);
    }
  }
  return map;
}

function findReference({ exercise, set }: WorkingSet, references: ReturnType<typeof referencesFor>) {
  if (!supportsStrengthMaxTest(exercise)) return undefined;
  return references.get(JSON.stringify([
    exercise.catalogExerciseId, exercise.equipment.trim().toLowerCase(), exercise.unilateral, normalizedRom(set.rom),
  ]));
}

function muscleSets(sets: readonly WorkingSet[]) {
  const buckets = new Map<string, { work: WorkingSet; involvement: number }[]>();
  for (const work of sets) {
    const tags = new Map<string, number>();
    for (const tag of work.exercise.muscleGroups) {
      if (tag.trim() && tag !== "full body") tags.set(tag.trim(), 1);
    }
    for (const tag of work.exercise.secondaryMuscleGroups ?? []) {
      if (tag.trim() && tag !== "full body" && !tags.has(tag.trim())) tags.set(tag.trim(), STRENGTH_STIMULUS_V1.secondaryInvolvement);
    }
    for (const [tag, involvement] of tags) {
      const bucket = buckets.get(tag) ?? [];
      bucket.push({ work, involvement });
      buckets.set(tag, bucket);
    }
  }
  return buckets;
}

export function strengthMuscleExposure(exercises: readonly StrengthStimulusExercise[]) {
  return [...muscleSets(workingSets(exercises))].map(([muscle, rows]) => ({
    muscle,
    workingSets: rows.length,
    rirLogged: rows.filter(({ work }) => validRir(work.set.rir)).length,
    hardSets: rows.filter(({ work }) => validRir(work.set.rir) && work.set.rir <= STRENGTH_STIMULUS_V1.hardSetMaxRir).length,
  }));
}

function hypertrophyMetrics(sets: readonly WorkingSet[], recent: readonly StrengthStimulusExercise[], references: ReturnType<typeof referencesFor>) {
  const recentCounts = new Map(strengthMuscleExposure(recent).map((item) => [item.muscle, item.workingSets]));
  return [...muscleSets(sets)].map(([muscle, rows]) => {
    let weightedSets = 0;
    let valid = 0;
    let limitedEvidence = 0;
    let missingRir = false;
    let invalidRir = false;
    for (const { work, involvement } of rows) {
      const { rir, loadKg } = work.set;
      const reference = findReference(work, references);
      if (!reference || !positive(loadKg) || loadKg > reference.kg || loadKg / reference.kg < STRENGTH_STIMULUS_V1.veryLowRelativeLoad) limitedEvidence++;
      if (!validRir(rir)) {
        if (rir == null) missingRir = true;
        else invalidRir = true;
        continue;
      }
      const effortWeight = Math.max(0, Math.min(1, (STRENGTH_STIMULUS_V1.trialEffortZeroAtRir - rir) / STRENGTH_STIMULUS_V1.trialEffortRirSpan));
      weightedSets += involvement * effortWeight;
      valid++;
    }
    const total = rows.length;
    const reasons: MetricReason[] = [
      ...(missingRir ? ["missing" as const] : []),
      ...(invalidRir ? ["invalid" as const] : []),
    ];
    return {
      muscle, limitedEvidence, recentWorkingSets: total + (recentCounts.get(muscle) ?? 0),
      workingSets: metric({ metricId: "strength.hypertrophy.workingSets", value: total, unit: "sets",
        method: "Tagged working-set exposure", valid: total, total, usedInputs: ["catalog muscle targets", "completed working sets"] }),
      weighted: metric({ metricId: "strength.hypertrophy.weightedSets", value: valid > 0 ? weightedSets : null, unit: "weighted sets",
        method: valid < total ? "RIR-weighted subtotal" : "RIR-weighted exposure", valid, total, reasons,
        usedInputs: ["catalog muscle targets", "logged RIR"], missingInputs: valid < total ? ["valid actual RIR"] : [] }),
    };
  });
}

function exerciseMetrics(work: readonly WorkingSet[], references: ReturnType<typeof referencesFor>) {
  const reps = work.filter(({ set }) => positiveReps(set));
  const referenceDates = new Set<number>();
  let strengthValid = 0;
  let strengthWeighted = 0;
  let missingLoad = false;
  let missingReference = false;
  let incompatibleReference = false;
  let aboveReference = false;
  let invalidLoad = false;
  let explosive = 0;
  let intentLogged = 0;
  let volumeLoad = 0;
  let volumeValid = 0;
  const relativeLoads: number[] = [];
  for (const item of reps) {
    const { exercise, set } = item;
    if (set.intent === "explosive") explosive += set.reps;
    if (set.intent === "explosive" || set.intent === "controlled") intentLogged++;
    if (exercise.loadMode === "external" && positive(set.loadKg)) {
      volumeLoad += set.reps * set.loadKg;
      volumeValid++;
    }
    const reference = findReference(item, references);
    if (!supportsStrengthMaxTest(exercise)) incompatibleReference = true;
    else if (!reference) missingReference = true;
    if (set.loadKg == null) missingLoad = true;
    else if (!positive(set.loadKg)) invalidLoad = true;
    if (!reference || !positive(set.loadKg)) continue;
    const relativeLoad = set.loadKg / reference.kg;
    relativeLoads.push(relativeLoad);
    referenceDates.add(reference.performedAt);
    if (relativeLoad > 1) {
      aboveReference = true;
      continue;
    }
    strengthWeighted += set.reps * relativeLoad ** 2;
    strengthValid++;
  }
  const strengthReasons: MetricReason[] = [
    ...(missingLoad || missingReference ? ["missing" as const] : []),
    ...(incompatibleReference ? ["incompatible" as const] : []),
    ...(aboveReference ? ["stale" as const] : []),
    ...(invalidLoad ? ["invalid" as const] : []),
  ];
  const active = work.flatMap(({ set }) => positive(set.workSeconds) ? [set.workSeconds] : []);
  const continuous = active.length ? Math.max(...active) : null;
  const activeSeconds = active.reduce((sum, seconds) => sum + seconds, 0);
  const holds = work.filter(({ set }) => set.isometric);
  let rest = 0;
  let actualRestCount = 0;
  let restNeeded = 0;
  for (const [index, { exercise, set }] of work.entries()) {
    if (work[index - 1]?.exercise.id !== exercise.id) continue;
    const previous = exercise.sets[exercise.sets.indexOf(set) - 1];
    restNeeded++;
    if (previous !== work[index - 1]?.set || !numeric(set.precedingRestSeconds)) continue;
    rest += set.precedingRestSeconds;
    actualRestCount++;
  }
  const densityValid = active.length === work.length && actualRestCount === restNeeded && activeSeconds > 0;
  const repeatCount = reps.reduce((sum, { set }) => sum + set.reps, 0);

  return {
    max: metric({ metricId: "strength.maximalStrength", value: strengthValid ? strengthWeighted : null,
      unit: "weighted reps", method: strengthValid < reps.length ? "Relative-load subtotal" : "Relative-load weighting",
      valid: strengthValid, total: reps.length, reasons: strengthReasons,
      usedInputs: ["completed load", "completed reps", "earlier compatible 1RM"],
      missingInputs: [
        ...(missingLoad || invalidLoad ? ["valid actual load"] : []),
        ...(missingReference || incompatibleReference || aboveReference ? ["current compatible tested 1RM"] : []),
      ] }),
    practiceSets: work.length,
    referenceDates: [...referenceDates],
    aboveReference,
    relativeLoads,
    loadKg: reps.flatMap(({ set }) => positive(set.loadKg) ? [set.loadKg] : []),
    rom: [...new Set(work.flatMap(({ set }) => set.rom ? [set.rom] : []))],
    repetitions: metric({ metricId: "strength.endurance.reps", value: reps.length ? repeatCount : null,
      unit: "reps", method: "Repeated-effort exposure", valid: reps.length, total: reps.length, fallback: true,
      usedInputs: ["completed repetitions"], missingInputs: ["target task protocol"] }),
    holdSeconds: metric({ metricId: "strength.endurance.holdSeconds", value: holds.length
      ? holds.reduce((sum, { set }) => sum + (set.workSeconds ?? 0), 0) : null,
    unit: "s", method: "Repeated-effort exposure · holds", valid: holds.length, total: holds.length, fallback: true,
    usedInputs: ["completed timed holds"], missingInputs: ["target task protocol"] }),
    longest: metric({ metricId: "strength.endurance.longestBout", value: continuous, unit: "s",
      method: active.length < work.length ? "Longest recorded bout" : "Longest continuous bout",
      valid: active.length, total: work.length, usedInputs: ["actual active seconds"], missingInputs: active.length < work.length ? ["actual active seconds"] : [] }),
    volume: metric({ metricId: "strength.volumeLoad", value: volumeValid ? volumeLoad : null,
      unit: "kg × reps", method: volumeValid < reps.length ? "External volume-load subtotal" : "External volume-load",
      valid: volumeValid, total: reps.length, usedInputs: ["logged external load", "completed reps"],
      missingInputs: volumeValid < reps.length ? ["actual external load"] : [] }),
    density: metric({ metricId: "strength.workDensity", value: densityValid ? 100 * activeSeconds / (activeSeconds + rest) : null,
      unit: "%", method: "Active time within recorded exercise blocks", valid: active.length + actualRestCount,
      total: work.length + restNeeded, usedInputs: ["actual active and preceding rest seconds"],
      missingInputs: densityValid ? [] : ["complete actual work and rest timing"] }),
    rest: metric({ metricId: "strength.recordedPrecedingRest", value: actualRestCount || (restNeeded === 0 && active.length) ? rest : null,
      unit: "s", method: actualRestCount < restNeeded ? "Recorded rest subtotal" : "Within-block preceding rest",
      valid: actualRestCount, total: restNeeded, usedInputs: ["actual preceding rest seconds"],
      missingInputs: actualRestCount < restNeeded ? ["actual preceding rest seconds"] : [] }),
    explosive: metric({ metricId: "strength.power.explosiveIntent", value: intentLogged ? explosive : null,
      unit: "reps", method: intentLogged < reps.length ? "Explosive-intent exposure subtotal" : "Explosive-intent exposure",
      valid: intentLogged, total: reps.length, fallback: true, usedInputs: ["actual movement intent", "completed reps"],
      missingInputs: intentLogged < reps.length ? ["explicit actual intent"] : [] }),
    power: repMeasurementMetrics(reps, "repPowerWatts"),
    velocity: repMeasurementMetrics(reps, "concentricVelocityMps"),
    velocityLoss: reps.flatMap(({ set }) => {
      if (!set.intent || !set.concentricVelocityMps) return [];
      const { methodKey, values } = set.concentricVelocityMps;
      if (!methodKey || values.length !== set.reps) return [];
      const valid = values.filter(positive);
      const last = values.at(-1);
      if (!positive(last) || valid.length < 2) return [];
      const fastest = Math.max(...valid);
      return [{ setId: set.id, result: metric({ metricId: "strength.velocityLoss",
        value: 100 * (fastest - last) / fastest, unit: "%",
        method: valid.length < set.reps ? "Concentric velocity loss within recorded reps" : "Concentric velocity loss",
        valid: valid.length, total: set.reps, usedInputs: ["consistent concentric velocity", "actual movement intent"],
        missingInputs: valid.length < set.reps ? ["complete concentric velocity"] : [] }) }];
    }),
  };
}

function repMeasurementMetrics(work: readonly WorkingSet[], field: "repPowerWatts" | "concentricVelocityMps") {
  const groups = new Map<string, { values: number[]; total: number }>();
  for (const { set } of work) {
    const measurement = set[field];
    if (!measurement?.methodKey || measurement.values.length !== set.reps) continue;
    const previous = groups.get(measurement.methodKey) ?? { values: [], total: 0 };
    previous.values.push(...measurement.values.filter(field === "repPowerWatts" ? numericMeasurementPower : positive));
    previous.total += set.reps;
    groups.set(measurement.methodKey, previous);
  }
  const derivedUnit = field === "repPowerWatts" ? "W" : "m/s";
  return [...groups].map(([methodKey, { values, total }]) => {
    const valid = values.length;
    const options = { unit: derivedUnit, valid, total, usedInputs: [field],
      missingInputs: valid < total ? ["complete comparable rep measurement"] : [] };
    return {
      methodKey,
      mean: metric({ ...options, metricId: `strength.${field}.mean`, method: "Mean of recorded reps",
        value: valid ? values.reduce((sum, value) => sum + value, 0) / valid : null }),
      best: metric({ ...options, metricId: `strength.${field}.best`, method: "Best of recorded reps", value: valid ? Math.max(...values) : null }),
    };
  });
}

function numericMeasurementPower(value: number | null) {
  return numeric(value);
}

export function strengthStimulusFromDraft(exercises: readonly ExerciseDraft[]): StrengthStimulusExercise[] {
  return exercises.map((exercise) => ({ ...exercise, sets: performedSets(exercise) }));
}

export function calculateStrengthStimulus({
  exercises, references = [], recent = [], sessionId, endedAt, status, now = Date.now(),
}: Context & {
  exercises: readonly StrengthStimulusExercise[];
  references?: readonly StrengthMaxReference[];
  recent?: readonly StrengthStimulusExercise[];
  status: "planned" | "completed";
  now?: number;
}) {
  const eligible = status === "completed" && Number.isFinite(endedAt) && endedAt <= now;
  const performed = eligible ? workingSets(exercises) : [];
  const byVariant = new Map<string, WorkingSet[]>();
  for (const item of performed) {
    // An unidentified variant can retain its own work rows and cannot share a group.
    const key = item.exercise.catalogExerciseId ? strengthKey(item.exercise, item.set.rom) : JSON.stringify([item.exercise.id, normalizedRom(item.set.rom)]);
    const bucket = byVariant.get(key) ?? [];
    bucket.push(item);
    byVariant.set(key, bucket);
  }
  const compatibleReferences = referencesFor(references, { sessionId, endedAt });
  return {
    hypertrophy: hypertrophyMetrics(performed, recent, compatibleReferences),
    workingSets: performed.length,
    exercises: [...byVariant].map(([id, work]) => ({
      id, label: work[0].exercise.name, equipment: work[0].exercise.equipment,
      ...exerciseMetrics(work, compatibleReferences),
    })),
  };
}
