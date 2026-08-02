import {
  conditioningAdaptationOrder,
  conditioningValidationLimits,
} from "../constants/conditioning";
import type {
  ConditioningAdaptationKey,
  ConditioningAdaptationScores,
  ConditioningProtocolMetrics,
  ConditioningScoreResult,
  ConditioningScoringInput,
  SnapshottedConditioningIntensity,
} from "../types/conditioning";
import { evaluateConditioningProtocol } from "./conditioningProtocol";

export const CONDITIONING_SCORING_MODEL_VERSION =
  "conditioning-v1.0.0" as const;

type ScoringFactor = {
  value: number | null;
  weight: number;
};

type StructureScores = Record<ConditioningAdaptationKey, number>;

const STRUCTURE_SCORES = {
  continuous: {
    aerobic_base: 1,
    aerobic_power: 0.45,
    alactic_power: 0,
    alactic_capacity: 0,
    lactic_power: 0,
    lactic_capacity: 0,
    recovery: 1,
  },
  time_intervals: {
    aerobic_base: 0.35,
    aerobic_power: 1,
    alactic_power: 1,
    alactic_capacity: 1,
    lactic_power: 1,
    lactic_capacity: 1,
    recovery: 0.1,
  },
  distance_intervals: {
    aerobic_base: 0.35,
    aerobic_power: 1,
    alactic_power: 1,
    alactic_capacity: 1,
    lactic_power: 1,
    lactic_capacity: 1,
    recovery: 0.1,
  },
  circuit: {
    aerobic_base: 0.25,
    aerobic_power: 0.7,
    alactic_power: 0.7,
    alactic_capacity: 0.7,
    lactic_power: 0.7,
    lactic_capacity: 0.7,
    recovery: 0.1,
  },
} as const satisfies Record<
  ConditioningProtocolMetrics["protocolType"],
  StructureScores
>;

export const CONDITIONING_SCORING_MODELS = {
  [CONDITIONING_SCORING_MODEL_VERSION]: {
    workDurationRangesSeconds: {
      aerobicPower: [120, 480],
      alacticPower: [3, 10],
      alacticCapacity: [8, 20],
      lacticPower: [20, 45],
      lacticCapacity: [45, 120],
      recovery: [600, 3600],
    },
    weights: {
      aerobicBase: [0.2, 0.2, 0.35, 0.25],
      aerobicPower: [0.3, 0.25, 0.2, 0.2, 0.05],
      alacticPower: [0.35, 0.35, 0.25, 0.05],
      alacticCapacity: [0.25, 0.25, 0.25, 0.2, 0.05],
      lacticPower: [0.3, 0.25, 0.2, 0.2, 0.05],
      lacticCapacity: [0.25, 0.2, 0.15, 0.25, 0.1, 0.05],
      recovery: [0.45, 0.3, 0.25],
    },
  },
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function sigmoidUp(value: number, midpoint: number, scale: number) {
  if (![value, midpoint, scale].every(Number.isFinite) || scale <= 0) {
    return 0;
  }

  return clamp(1 / (1 + Math.exp(-(value - midpoint) / scale)), 0, 1);
}

export function sigmoidDown(value: number, midpoint: number, scale: number) {
  return 1 - sigmoidUp(value, midpoint, scale);
}

export function gaussian(value: number, target: number, width: number) {
  if (![value, target, width].every(Number.isFinite) || width <= 0) {
    return 0;
  }

  return clamp(Math.exp(-0.5 * ((value - target) / width) ** 2), 0, 1);
}

export function softRange(
  value: number,
  low: number,
  high: number,
  scale: number,
) {
  if (
    ![value, low, high, scale].every(Number.isFinite) ||
    low >= high ||
    scale <= 0
  ) {
    return 0;
  }

  const raw =
    sigmoidUp(value, low, scale) * sigmoidDown(value, high, scale);
  const center = (low + high) / 2;
  const maximum =
    sigmoidUp(center, low, scale) * sigmoidDown(center, high, scale);

  return maximum > 0 ? clamp(raw / maximum, 0, 1) : 0;
}

function averageCurve(
  values: number[],
  curve: (value: number) => number,
) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((sum, value) => sum + curve(value), 0) / values.length
  );
}

function weightedScore(factors: ScoringFactor[]) {
  let weightedTotal = 0;
  let includedWeight = 0;

  for (const factor of factors) {
    if (factor.value === null || !Number.isFinite(factor.value)) {
      continue;
    }

    weightedTotal += factor.weight * clamp(factor.value, 0, 1);
    includedWeight += factor.weight;
  }

  if (includedWeight <= 0) {
    return 0;
  }

  return clamp((weightedTotal / includedWeight) * 100, 0, 100);
}

function normalizeIntensity(
  intensity: SnapshottedConditioningIntensity,
): { value: number | null; reason: string | null } {
  if (intensity === null) {
    return { value: null, reason: "Intensity was not provided." };
  }

  if (intensity.method === "rpe") {
    if (
      !Number.isFinite(intensity.value) ||
      intensity.value < conditioningValidationLimits.rpe.minimum ||
      intensity.value > conditioningValidationLimits.rpe.maximum
    ) {
      return { value: null, reason: "RPE must be from 1 to 10." };
    }

    return { value: clamp((intensity.value - 1) / 9, 0, 1), reason: null };
  }

  if (intensity.method === "heart_rate") {
    if (
      !Number.isFinite(intensity.valueBpm) ||
      !Number.isFinite(intensity.maxHeartRateBpm) ||
      intensity.maxHeartRateBpm <
        conditioningValidationLimits.maximumHeartRateBpm.minimum ||
      intensity.maxHeartRateBpm >
        conditioningValidationLimits.maximumHeartRateBpm.maximum ||
      intensity.valueBpm <
        conditioningValidationLimits.sessionHeartRateBpm.minimum ||
      intensity.valueBpm > intensity.maxHeartRateBpm
    ) {
      return {
        value: null,
        reason: "Heart rate and maximum heart rate are invalid.",
      };
    }

    const relativeHeartRate =
      intensity.valueBpm / intensity.maxHeartRateBpm;
    return {
      value: clamp((relativeHeartRate - 0.5) / 0.5, 0, 1),
      reason: null,
    };
  }

  if (intensity.reference === "threshold_pace") {
    if (
      !Number.isFinite(intensity.paceSecondsPerKm) ||
      !Number.isFinite(intensity.thresholdPaceSecondsPerKm) ||
      intensity.paceSecondsPerKm <
        conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum ||
      intensity.paceSecondsPerKm >
        conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum ||
      intensity.thresholdPaceSecondsPerKm <
        conditioningValidationLimits.thresholdPaceSecondsPerKm.minimum ||
      intensity.thresholdPaceSecondsPerKm >
        conditioningValidationLimits.thresholdPaceSecondsPerKm.maximum
    ) {
      return { value: null, reason: "Pace and threshold pace are invalid." };
    }

    const relativeSpeed =
      intensity.thresholdPaceSecondsPerKm / intensity.paceSecondsPerKm;
    return {
      value: clamp((relativeSpeed - 0.5) / 0.7, 0, 1),
      reason: null,
    };
  }

  if (
    !Number.isFinite(intensity.speedKph) ||
    !Number.isFinite(intensity.maximumAerobicSpeedKph) ||
    intensity.speedKph <= 0 ||
    intensity.speedKph > conditioningValidationLimits.maximumAerobicSpeedKph ||
    intensity.maximumAerobicSpeedKph <= 0 ||
    intensity.maximumAerobicSpeedKph >
      conditioningValidationLimits.maximumAerobicSpeedKph
  ) {
    return {
      value: null,
      reason: "Speed and maximum aerobic speed are invalid.",
    };
  }

  const relativeSpeed = intensity.speedKph / intensity.maximumAerobicSpeedKph;
  return {
    value: clamp((relativeSpeed - 0.5) / 0.7, 0, 1),
    reason: null,
  };
}

function roundScore(score: number) {
  return Math.round(clamp(score, 0, 100) * 100) / 100;
}

function getPrimaryAdaptation(scores: ConditioningAdaptationScores) {
  return conditioningAdaptationOrder.reduce((currentPrimary, key) =>
    scores[key] > scores[currentPrimary] ? key : currentPrimary,
  );
}

function calculateScores(
  metrics: ConditioningProtocolMetrics,
  intensity: number | null,
): ConditioningAdaptationScores {
  const structure = STRUCTURE_SCORES[metrics.protocolType];
  const restToWorkRatio =
    metrics.totalWorkSeconds > 0
      ? metrics.totalRestSeconds / metrics.totalWorkSeconds
      : 0;
  const config =
    CONDITIONING_SCORING_MODELS[CONDITIONING_SCORING_MODEL_VERSION];
  const [aerobicPowerLow, aerobicPowerHigh] =
    config.workDurationRangesSeconds.aerobicPower;
  const [alacticPowerLow, alacticPowerHigh] =
    config.workDurationRangesSeconds.alacticPower;
  const [alacticCapacityLow, alacticCapacityHigh] =
    config.workDurationRangesSeconds.alacticCapacity;
  const [lacticPowerLow, lacticPowerHigh] =
    config.workDurationRangesSeconds.lacticPower;
  const [lacticCapacityLow, lacticCapacityHigh] =
    config.workDurationRangesSeconds.lacticCapacity;
  const [recoveryLow, recoveryHigh] =
    config.workDurationRangesSeconds.recovery;

  const boutRange = (low: number, high: number) =>
    averageCurve(metrics.workBoutSeconds, (seconds) =>
      softRange(seconds, low, high, Math.max(1, (high - low) * 0.12)),
    );

  const aerobicBaseScore = weightedScore([
    {
      value: sigmoidUp(metrics.averageWorkBoutSeconds, 600, 240),
      weight: 0.2,
    },
    {
      value:
        intensity === null ? null : softRange(intensity, 0.2, 0.7, 0.12),
      weight: 0.2,
    },
    { value: sigmoidUp(metrics.totalWorkSeconds, 1200, 300), weight: 0.35 },
    { value: structure.aerobic_base, weight: 0.25 },
  ]);

  const aerobicPowerScore = weightedScore([
    {
      value: boutRange(aerobicPowerLow, aerobicPowerHigh),
      weight: 0.3,
    },
    {
      value: intensity === null ? null : sigmoidUp(intensity, 0.68, 0.1),
      weight: 0.25,
    },
    { value: softRange(restToWorkRatio, 0.3, 1.5, 0.22), weight: 0.2 },
    {
      value: softRange(metrics.totalWorkSeconds, 600, 2400, 260),
      weight: 0.2,
    },
    { value: structure.aerobic_power, weight: 0.05 },
  ]);

  const alacticPowerScore = weightedScore([
    {
      value: boutRange(alacticPowerLow, alacticPowerHigh),
      weight: 0.35,
    },
    {
      value: intensity === null ? null : sigmoidUp(intensity, 0.82, 0.07),
      weight: 0.35,
    },
    { value: sigmoidUp(restToWorkRatio, 4, 0.8), weight: 0.25 },
    { value: structure.alactic_power, weight: 0.05 },
  ]);

  const alacticCapacityScore = weightedScore([
    {
      value: boutRange(alacticCapacityLow, alacticCapacityHigh),
      weight: 0.25,
    },
    {
      value: intensity === null ? null : sigmoidUp(intensity, 0.72, 0.09),
      weight: 0.25,
    },
    { value: softRange(restToWorkRatio, 1, 4, 0.45), weight: 0.25 },
    { value: sigmoidUp(metrics.totalBouts, 8, 2), weight: 0.2 },
    { value: structure.alactic_capacity, weight: 0.05 },
  ]);

  const lacticPowerScore = weightedScore([
    { value: boutRange(lacticPowerLow, lacticPowerHigh), weight: 0.3 },
    {
      value: intensity === null ? null : sigmoidUp(intensity, 0.7, 0.1),
      weight: 0.25,
    },
    { value: softRange(restToWorkRatio, 1, 3, 0.35), weight: 0.2 },
    {
      value: softRange(metrics.totalWorkSeconds, 180, 1200, 160),
      weight: 0.2,
    },
    { value: structure.lactic_power, weight: 0.05 },
  ]);

  const lacticCapacityScore = weightedScore([
    {
      value: boutRange(lacticCapacityLow, lacticCapacityHigh),
      weight: 0.25,
    },
    {
      value:
        intensity === null ? null : softRange(intensity, 0.55, 0.95, 0.1),
      weight: 0.2,
    },
    { value: softRange(restToWorkRatio, 0.3, 1.5, 0.22), weight: 0.15 },
    { value: sigmoidUp(metrics.totalWorkSeconds, 600, 180), weight: 0.25 },
    { value: sigmoidUp(metrics.totalBouts, 6, 1.5), weight: 0.1 },
    { value: structure.lactic_capacity, weight: 0.05 },
  ]);

  const recoveryScore = weightedScore([
    {
      value: intensity === null ? null : sigmoidDown(intensity, 0.28, 0.1),
      weight: 0.45,
    },
    {
      value: softRange(
        metrics.totalSessionSeconds,
        recoveryLow,
        recoveryHigh,
        300,
      ),
      weight: 0.3,
    },
    { value: structure.recovery, weight: 0.25 },
  ]);

  return {
    aerobic_base: roundScore(aerobicBaseScore),
    aerobic_power: roundScore(aerobicPowerScore),
    alactic_power: roundScore(alacticPowerScore),
    alactic_capacity: roundScore(alacticCapacityScore),
    lactic_power: roundScore(lacticPowerScore),
    lactic_capacity: roundScore(lacticCapacityScore),
    recovery: roundScore(recoveryScore),
  };
}

export function scoreConditioningSession(
  input: ConditioningScoringInput,
): ConditioningScoreResult {
  const protocolResult = evaluateConditioningProtocol(input.protocol);

  if (!protocolResult.ok) {
    return {
      status: "insufficient",
      scores: null,
      primaryAdaptation: null,
      evidence: "insufficient",
      reasons: protocolResult.issues.map((issue) => issue.message),
      modelVersion: CONDITIONING_SCORING_MODEL_VERSION,
    };
  }

  const intensity = normalizeIntensity(input.intensity);

  if (input.intensity !== null && intensity.reason !== null) {
    return {
      status: "insufficient",
      scores: null,
      primaryAdaptation: null,
      evidence: "insufficient",
      reasons: [intensity.reason],
      modelVersion: CONDITIONING_SCORING_MODEL_VERSION,
    };
  }

  const scores = calculateScores(protocolResult.metrics, intensity.value);
  const missingInputs: string[] = [];

  if (input.intensity === null) {
    missingInputs.push("Intensity was not provided.");
  }

  if (protocolResult.metrics.estimatedWorkDuration) {
    missingInputs.push(
      "Work duration was estimated from elapsed duration and scheduled rest.",
    );
  }

  return {
    status: "scored",
    scores,
    primaryAdaptation: getPrimaryAdaptation(scores),
    evidence: missingInputs.length > 0 ? "limited" : "full",
    missingInputs,
    modelVersion: CONDITIONING_SCORING_MODEL_VERSION,
  };
}
