import { conditioningValidationLimits } from "../constants/conditioning";
import type { UnitSystem } from "../state/AppStateContext";
import type {
  AthleteConditioningBaselines,
  CircuitProtocol,
  ConditioningActivity,
  ConditioningIntensityInput,
  ConditioningProtocol,
  ConditioningProtocolMetrics,
  ConditioningProtocolType,
  ConditioningScoreResult,
  ConditioningSessionDefinition,
  ConditioningValidationIssue,
  SnapshottedConditioningIntensity,
} from "../types/conditioning";
import {
  convertDistanceToMeters,
  formatDistanceInput,
} from "./conditioningMeasurements";
import { evaluateConditioningProtocol } from "./conditioningProtocol";
import { scoreConditioningSession } from "./conditioningScoring";

export type ConditioningDistanceDraft = {
  canonicalMeters: number | null;
  dirty: boolean;
  displayInput: string;
  displayUnit: UnitSystem;
};

export type ConditioningIntensityDraft = {
  activeMethod: "heart_rate" | "rpe" | "legacy_pace" | null;
  dirty: boolean;
  heartRateInput: string;
  historicalSnapshot: SnapshottedConditioningIntensity;
  legacyPace: Extract<ConditioningIntensityInput, { method: "pace" }> | null;
  rpeInput: string;
};

export type ContinuousProtocolFormDraft = {
  distance: ConditioningDistanceDraft;
  durationSeconds: number | null;
};

export type IntervalsProtocolFormDraft = {
  distanceWork: {
    distance: ConditioningDistanceDraft;
    durationDirty: boolean;
    durationSeconds: number | null;
    legacyTotalDurationSeconds?: number;
    provenance: "explicit" | "legacy-derived";
  };
  intervalCountInput: string;
  restBetweenIntervalsSeconds: number;
  restBetweenRoundsSeconds: number;
  roundCountInput: string;
  timeWorkDurationSeconds: number | null;
  workMode: "time" | "distance";
};

export type CircuitProtocolFormDraft = {
  restBetweenRoundsSeconds: number;
  restBetweenStationsSeconds: number;
  roundCountInput: string;
  stations: {
    nameInput: string;
    workSeconds: number | null;
  }[];
};

export type ConditioningSessionFormDraft = {
  activity: ConditioningActivity;
  activeProtocolType: ConditioningProtocolType;
  circuit: CircuitProtocolFormDraft;
  continuous: ContinuousProtocolFormDraft;
  intensity: ConditioningIntensityDraft;
  intervals: IntervalsProtocolFormDraft;
  lastNonCircuitProtocolType: "continuous" | "intervals";
  notesInput: string;
  titleInput: string;
};

export type ConditioningDraftAnalysis =
  | {
      intensity: ConditioningIntensityInput;
      metrics: ConditioningProtocolMetrics;
      ok: true;
      protocol: ConditioningProtocol;
      score: Extract<ConditioningScoreResult, { status: "scored" }>;
      snapshot: SnapshottedConditioningIntensity;
    }
  | {
      issues: ConditioningValidationIssue[];
      message: string;
      ok: false;
      score: ConditioningScoreResult;
    };

const EMPTY_SCORE: Extract<
  ConditioningScoreResult,
  { status: "insufficient" }
> = {
  evidence: "insufficient",
  modelVersion: "conditioning-v1.0.0",
  primaryAdaptation: null,
  reasons: [],
  scores: null,
  status: "insufficient",
};

export function createDefaultConditioningSessionFormDraft(
  distanceUnit: UnitSystem = "metric",
): ConditioningSessionFormDraft {
  return {
    activity: "running",
    activeProtocolType: "continuous",
    circuit: createDefaultCircuitDraft(),
    continuous: {
      distance: createDistanceDraft(null, distanceUnit),
      durationSeconds: null,
    },
    intensity: createIntensityDraft(null, null),
    intervals: createDefaultIntervalsDraft(distanceUnit),
    lastNonCircuitProtocolType: "continuous",
    notesInput: "",
    titleInput: "",
  };
}

export function createConditioningSessionFormDraftFromDefinition(
  definition: ConditioningSessionDefinition,
  distanceUnit: UnitSystem = "metric",
  historicalSnapshot: SnapshottedConditioningIntensity = null,
): ConditioningSessionFormDraft {
  const draft = createDefaultConditioningSessionFormDraft(distanceUnit);
  const protocol = definition.protocol;

  draft.activity = definition.activity;
  draft.activeProtocolType = protocol.type;
  draft.lastNonCircuitProtocolType =
    protocol.type === "intervals" ? "intervals" : "continuous";
  draft.titleInput = definition.title;
  draft.notesInput = definition.notes ?? "";
  draft.intensity = createIntensityDraft(
    toIntensityInput(definition.intensity),
    historicalSnapshot,
  );

  if (protocol.type === "continuous") {
    draft.continuous = {
      distance: createDistanceDraft(protocol.distanceMeters, distanceUnit),
      durationSeconds: protocol.durationSeconds,
    };
  } else if (protocol.type === "intervals") {
    draft.intervals = {
      ...draft.intervals,
      intervalCountInput: String(protocol.intervalCount),
      restBetweenIntervalsSeconds: protocol.restBetweenIntervalsSeconds,
      restBetweenRoundsSeconds: protocol.restBetweenRoundsSeconds,
      roundCountInput: String(protocol.roundCount),
      workMode: protocol.work.mode,
      ...(protocol.work.mode === "time"
        ? { timeWorkDurationSeconds: protocol.work.durationSeconds }
        : {
            distanceWork: {
              distance: createDistanceDraft(
                protocol.work.distanceMeters,
                distanceUnit,
              ),
              durationDirty: false,
              durationSeconds: protocol.work.durationSeconds,
              legacyTotalDurationSeconds:
                protocol.work.legacyTotalDurationSeconds,
              provenance: protocol.work.provenance,
            },
          }),
    };
  } else {
    draft.circuit = {
      restBetweenRoundsSeconds: protocol.restBetweenRoundsSeconds,
      restBetweenStationsSeconds: protocol.restBetweenStationsSeconds,
      roundCountInput: String(protocol.roundCount),
      stations: [...protocol.stations]
        .sort((left, right) => left.position - right.position)
        .map((station) => ({
          nameInput: station.name,
          workSeconds: station.workSeconds,
        })),
    };
  }

  return draft;
}

export function selectConditioningActivity(
  draft: ConditioningSessionFormDraft,
  activity: ConditioningActivity,
): ConditioningSessionFormDraft {
  if (activity === "circuit") {
    return {
      ...draft,
      activity,
      activeProtocolType: "circuit",
      lastNonCircuitProtocolType:
        draft.activeProtocolType === "circuit"
          ? draft.lastNonCircuitProtocolType
          : draft.activeProtocolType,
    };
  }

  return {
    ...draft,
    activity,
    activeProtocolType:
      draft.activeProtocolType === "circuit"
        ? draft.lastNonCircuitProtocolType
        : draft.activeProtocolType,
  };
}

export function selectConditioningProtocolType(
  draft: ConditioningSessionFormDraft,
  type: "continuous" | "intervals",
): ConditioningSessionFormDraft {
  return {
    ...draft,
    activeProtocolType: draft.activity === "circuit" ? "circuit" : type,
    lastNonCircuitProtocolType: type,
  };
}

export function selectIntervalWorkMode(
  draft: ConditioningSessionFormDraft,
  workMode: "time" | "distance",
): ConditioningSessionFormDraft {
  return {
    ...draft,
    intervals: { ...draft.intervals, workMode },
  };
}

export function selectConditioningIntensityMethod(
  draft: ConditioningSessionFormDraft,
  activeMethod: "heart_rate" | "rpe",
): ConditioningSessionFormDraft {
  return {
    ...draft,
    intensity: {
      ...draft.intensity,
      activeMethod,
      dirty: true,
      historicalSnapshot: null,
      legacyPace: null,
    },
  };
}

export function clearConditioningIntensity(
  draft: ConditioningSessionFormDraft,
): ConditioningSessionFormDraft {
  return {
    ...draft,
    intensity: {
      ...draft.intensity,
      activeMethod: null,
      dirty: true,
      historicalSnapshot: null,
      legacyPace: null,
    },
  };
}

export function updateConditioningDistanceInput(
  distance: ConditioningDistanceDraft,
  displayInput: string,
  unit: UnitSystem,
): ConditioningDistanceDraft {
  if (!/^\d*(?:\.\d{0,3})?$/.test(displayInput)) {
    return distance;
  }

  const parsed =
    displayInput.trim() === "" || displayInput === "."
      ? null
      : Number(displayInput);

  return {
    canonicalMeters:
      parsed === null || !Number.isFinite(parsed)
        ? null
        : convertDistanceToMeters(parsed, unit),
    dirty: true,
    displayInput,
    displayUnit: unit,
  };
}

export function changeConditioningDistanceUnit(
  draft: ConditioningSessionFormDraft,
  distanceUnit: UnitSystem,
): ConditioningSessionFormDraft {
  const continuousDistance = reformatDistance(
    draft.continuous.distance,
    distanceUnit,
  );
  const intervalDistance = reformatDistance(
    draft.intervals.distanceWork.distance,
    distanceUnit,
  );

  if (
    continuousDistance === draft.continuous.distance &&
    intervalDistance === draft.intervals.distanceWork.distance
  ) {
    return draft;
  }

  return {
    ...draft,
    continuous: { ...draft.continuous, distance: continuousDistance },
    intervals: {
      ...draft.intervals,
      distanceWork: {
        ...draft.intervals.distanceWork,
        distance: intervalDistance,
      },
    },
  };
}

export function analyzeConditioningSessionFormDraft(
  draft: ConditioningSessionFormDraft,
  baselines: AthleteConditioningBaselines,
): ConditioningDraftAnalysis {
  const protocolResult = buildActiveProtocol(draft);

  if (!protocolResult.ok) {
    return insufficient(protocolResult.issues);
  }

  const intensityResult = buildActiveIntensity(draft.intensity, baselines);
  if (!intensityResult.ok) {
    return insufficient([intensityResult.issue]);
  }

  const score = scoreConditioningSession({
    activity: draft.activity,
    intensity: intensityResult.snapshot,
    protocol: protocolResult.protocol,
  });

  if (score.status !== "scored") {
    return {
      issues: score.reasons.map((message) => ({ field: "score", message })),
      message: score.reasons[0] ?? "Complete the conditioning session.",
      ok: false,
      score,
    };
  }

  return {
    intensity: intensityResult.input,
    metrics: protocolResult.metrics,
    ok: true,
    protocol: protocolResult.protocol,
    score,
    snapshot: intensityResult.snapshot,
  };
}

function createDefaultIntervalsDraft(
  distanceUnit: UnitSystem,
): IntervalsProtocolFormDraft {
  return {
    distanceWork: {
      distance: createDistanceDraft(null, distanceUnit),
      durationDirty: false,
      durationSeconds: null,
      provenance: "explicit",
    },
    intervalCountInput: "1",
    restBetweenIntervalsSeconds: 0,
    restBetweenRoundsSeconds: 0,
    roundCountInput: "1",
    timeWorkDurationSeconds: null,
    workMode: "time",
  };
}

function createDefaultCircuitDraft(): CircuitProtocolFormDraft {
  return {
    restBetweenRoundsSeconds: 0,
    restBetweenStationsSeconds: 0,
    roundCountInput: "1",
    stations: [{ nameInput: "", workSeconds: null }],
  };
}

function createDistanceDraft(
  canonicalMeters: number | null,
  displayUnit: UnitSystem,
): ConditioningDistanceDraft {
  return {
    canonicalMeters,
    dirty: false,
    displayInput: formatDistanceInput(canonicalMeters, displayUnit),
    displayUnit,
  };
}

function createIntensityDraft(
  intensity: ConditioningIntensityInput,
  historicalSnapshot: SnapshottedConditioningIntensity,
): ConditioningIntensityDraft {
  return {
    activeMethod:
      intensity === null
        ? null
        : intensity.method === "pace"
          ? "legacy_pace"
          : intensity.method,
    dirty: false,
    heartRateInput:
      intensity?.method === "heart_rate" ? String(intensity.valueBpm) : "",
    historicalSnapshot,
    legacyPace: intensity?.method === "pace" ? intensity : null,
    rpeInput: intensity?.method === "rpe" ? String(intensity.value) : "",
  };
}

function toIntensityInput(
  intensity: ConditioningIntensityInput | SnapshottedConditioningIntensity,
): ConditioningIntensityInput {
  if (intensity === null || intensity.method === "rpe") {
    return intensity;
  }
  if (intensity.method === "heart_rate") {
    return { method: "heart_rate", valueBpm: intensity.valueBpm };
  }
  return intensity.reference === "threshold_pace"
    ? {
        method: "pace",
        paceSecondsPerKm: intensity.paceSecondsPerKm,
        reference: "threshold_pace",
      }
    : {
        method: "pace",
        reference: "maximum_aerobic_speed",
        speedKph: intensity.speedKph,
      };
}

function reformatDistance(
  distance: ConditioningDistanceDraft,
  unit: UnitSystem,
) {
  if (distance.displayUnit === unit) {
    return distance;
  }

  return {
    ...distance,
    displayInput: formatDistanceInput(distance.canonicalMeters, unit),
    displayUnit: unit,
  };
}

function buildActiveProtocol(
  draft: ConditioningSessionFormDraft,
):
  | { ok: true; protocol: ConditioningProtocol; metrics: ConditioningProtocolMetrics }
  | { ok: false; issues: ConditioningValidationIssue[] } {
  let protocol: ConditioningProtocol;

  if (draft.activeProtocolType === "continuous") {
    const distance = draft.continuous.distance;
    protocol = {
      distanceMeters:
        distance.canonicalMeters === null && distance.displayInput.trim() !== ""
          ? Number.NaN
          : distance.canonicalMeters,
      durationSeconds: draft.continuous.durationSeconds ?? Number.NaN,
      type: "continuous",
    };
  } else if (draft.activeProtocolType === "intervals") {
    const intervalCount = Number(draft.intervals.intervalCountInput.trim());
    const roundCount = Number(draft.intervals.roundCountInput.trim());

    if (draft.intervals.workMode === "time") {
      protocol = {
        intervalCount,
        restBetweenIntervalsSeconds:
          draft.intervals.restBetweenIntervalsSeconds,
        restBetweenRoundsSeconds: draft.intervals.restBetweenRoundsSeconds,
        roundCount,
        type: "intervals",
        work: {
          durationSeconds:
            draft.intervals.timeWorkDurationSeconds ?? Number.NaN,
          mode: "time",
        },
      };
    } else {
      const distanceWork = draft.intervals.distanceWork;
      const boutCount = intervalCount * roundCount;
      const totalRestSeconds =
        draft.intervals.restBetweenIntervalsSeconds *
          (intervalCount - 1) *
          roundCount +
        draft.intervals.restBetweenRoundsSeconds * (roundCount - 1);
      const legacyDuration =
        distanceWork.provenance === "legacy-derived" &&
        !distanceWork.durationDirty &&
        distanceWork.legacyTotalDurationSeconds !== undefined &&
        Number.isFinite(boutCount) &&
        boutCount > 0
          ? (distanceWork.legacyTotalDurationSeconds - totalRestSeconds) /
            boutCount
          : distanceWork.durationSeconds;

      protocol = {
        intervalCount,
        restBetweenIntervalsSeconds:
          draft.intervals.restBetweenIntervalsSeconds,
        restBetweenRoundsSeconds: draft.intervals.restBetweenRoundsSeconds,
        roundCount,
        type: "intervals",
        work: {
          distanceMeters:
            distanceWork.distance.canonicalMeters ?? Number.NaN,
          durationSeconds: legacyDuration ?? Number.NaN,
          ...(distanceWork.provenance === "legacy-derived" &&
          !distanceWork.durationDirty
            ? {
                legacyTotalDurationSeconds:
                  distanceWork.legacyTotalDurationSeconds,
                provenance: "legacy-derived" as const,
              }
            : { provenance: "explicit" as const }),
          mode: "distance",
        },
      };
    }
  } else {
    const circuit: CircuitProtocol = {
      restBetweenRoundsSeconds: draft.circuit.restBetweenRoundsSeconds,
      restBetweenStationsSeconds: draft.circuit.restBetweenStationsSeconds,
      roundCount: Number(draft.circuit.roundCountInput.trim()),
      stations: draft.circuit.stations.map((station, position) => ({
        name: station.nameInput.trim(),
        position,
        workSeconds: station.workSeconds ?? Number.NaN,
      })),
      type: "circuit",
    };
    protocol = circuit;
  }

  const result = evaluateConditioningProtocol(protocol);
  return result.ok
    ? { metrics: result.metrics, ok: true, protocol: result.protocol }
    : { issues: result.issues, ok: false };
}

function buildActiveIntensity(
  draft: ConditioningIntensityDraft,
  baselines: AthleteConditioningBaselines,
):
  | {
      input: ConditioningIntensityInput;
      ok: true;
      snapshot: SnapshottedConditioningIntensity;
    }
  | { issue: ConditioningValidationIssue; ok: false } {
  if (!draft.dirty && draft.historicalSnapshot !== null) {
    return {
      input: toIntensityInput(draft.historicalSnapshot),
      ok: true,
      snapshot: draft.historicalSnapshot,
    };
  }

  if (draft.activeMethod === null) {
    return { input: null, ok: true, snapshot: null };
  }

  if (draft.activeMethod === "rpe") {
    const value = Number(draft.rpeInput.trim());
    if (
      !Number.isFinite(value) ||
      value < conditioningValidationLimits.rpe.minimum ||
      value > conditioningValidationLimits.rpe.maximum
    ) {
      return intensityFailure("RPE must be from 1 to 10.");
    }
    const intensity = { method: "rpe", value } as const;
    return { input: intensity, ok: true, snapshot: intensity };
  }

  if (draft.activeMethod === "heart_rate") {
    const valueBpm = Number(draft.heartRateInput.trim());
    const maximumHeartRateBpm = baselines.maximumHeartRateBpm;
    if (maximumHeartRateBpm === null) {
      return intensityFailure(
        "Set Maximum Heart Rate in Athlete Information before using heart-rate intensity.",
      );
    }
    if (
      !Number.isInteger(valueBpm) ||
      valueBpm < conditioningValidationLimits.sessionHeartRateBpm.minimum ||
      valueBpm > maximumHeartRateBpm
    ) {
      return intensityFailure(
        `Heart rate must be a whole number from ${conditioningValidationLimits.sessionHeartRateBpm.minimum} to ${maximumHeartRateBpm} BPM.`,
      );
    }
    return {
      input: { method: "heart_rate", valueBpm },
      ok: true,
      snapshot: { method: "heart_rate", valueBpm, maxHeartRateBpm: maximumHeartRateBpm },
    };
  }

  const legacyPace = draft.legacyPace;
  if (legacyPace === null) {
    return intensityFailure("Legacy pace intensity is invalid.");
  }

  if (legacyPace.reference === "threshold_pace") {
    const thresholdPaceSecondsPerKm = baselines.thresholdPaceSecondsPerKm;
    if (thresholdPaceSecondsPerKm === null) {
      return intensityFailure(
        "Set Threshold Pace in Athlete Information before using legacy pace intensity.",
      );
    }
    return {
      input: legacyPace,
      ok: true,
      snapshot: { ...legacyPace, thresholdPaceSecondsPerKm },
    };
  }

  const maximumAerobicSpeedKph = baselines.maximumAerobicSpeedKph;
  if (maximumAerobicSpeedKph === null) {
    return intensityFailure(
      "Set Maximum Aerobic Speed in Athlete Information before using legacy pace intensity.",
    );
  }
  return {
    input: legacyPace,
    ok: true,
    snapshot: { ...legacyPace, maximumAerobicSpeedKph },
  };
}

function intensityFailure(message: string) {
  return {
    issue: { field: "intensity", message },
    ok: false as const,
  };
}

function insufficient(
  issues: ConditioningValidationIssue[],
): ConditioningDraftAnalysis {
  const reasons = issues.map((issue) => issue.message);
  return {
    issues,
    message: reasons[0] ?? "Complete the conditioning session.",
    ok: false,
    score: { ...EMPTY_SCORE, reasons },
  };
}
