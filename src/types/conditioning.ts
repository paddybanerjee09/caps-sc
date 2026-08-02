export type ConditioningActivity =
  | "running"
  | "hill_sprints"
  | "assault_bike"
  | "rowing"
  | "swimming"
  | "circuit"
  | "other";

export type ConditioningProtocolType =
  | "continuous"
  | "time_intervals"
  | "distance_intervals"
  | "circuit";

export type ConditioningIntensityMethod =
  | "rpe"
  | "heart_rate"
  | "pace";

export type ConditioningPaceReference =
  | "threshold_pace"
  | "maximum_aerobic_speed";

export type ConditioningAdaptationKey =
  | "aerobic_base"
  | "aerobic_power"
  | "alactic_power"
  | "alactic_capacity"
  | "lactic_power"
  | "lactic_capacity"
  | "recovery";

export type ContinuousProtocol = {
  type: "continuous";
  durationSeconds: number;
  distanceMeters: number | null;
};

export type TimeIntervalsProtocol = {
  type: "time_intervals";
  workSeconds: number;
  restBetweenRepetitionsSeconds: number;
  repetitionsPerSet: number;
  setCount: number;
  restBetweenSetsSeconds: number;
};

export type DistanceIntervalsProtocol = {
  type: "distance_intervals";
  workDistanceMeters: number;
  elapsedDurationSeconds: number;
  restBetweenRepetitionsSeconds: number;
  repetitionsPerSet: number;
  setCount: number;
  restBetweenSetsSeconds: number;
};

export type CircuitStation = {
  name: string;
  position: number;
  workSeconds: number;
};

export type CircuitProtocol = {
  type: "circuit";
  stations: CircuitStation[];
  restBetweenStationsSeconds: number;
  roundCount: number;
  restBetweenRoundsSeconds: number;
};

export type ConditioningProtocol =
  | ContinuousProtocol
  | TimeIntervalsProtocol
  | DistanceIntervalsProtocol
  | CircuitProtocol;

export type ContinuousProtocolDraft = {
  type: "continuous";
  durationSecondsInput: string;
  distanceMetersInput: string;
};

export type TimeIntervalsProtocolDraft = {
  type: "time_intervals";
  workSecondsInput: string;
  restBetweenRepetitionsSecondsInput: string;
  repetitionsPerSetInput: string;
  setCountInput: string;
  restBetweenSetsSecondsInput: string;
};

export type DistanceIntervalsProtocolDraft = {
  type: "distance_intervals";
  workDistanceMetersInput: string;
  elapsedDurationSecondsInput: string;
  restBetweenRepetitionsSecondsInput: string;
  repetitionsPerSetInput: string;
  setCountInput: string;
  restBetweenSetsSecondsInput: string;
};

export type CircuitStationDraft = {
  nameInput: string;
  workSecondsInput: string;
};

export type CircuitProtocolDraft = {
  type: "circuit";
  stations: CircuitStationDraft[];
  restBetweenStationsSecondsInput: string;
  roundCountInput: string;
  restBetweenRoundsSecondsInput: string;
};

export type ConditioningProtocolDraft =
  | ContinuousProtocolDraft
  | TimeIntervalsProtocolDraft
  | DistanceIntervalsProtocolDraft
  | CircuitProtocolDraft;

export type ConditioningIntensityInput =
  | { method: "rpe"; value: number }
  | { method: "heart_rate"; valueBpm: number }
  | {
      method: "pace";
      reference: "threshold_pace";
      paceSecondsPerKm: number;
    }
  | {
      method: "pace";
      reference: "maximum_aerobic_speed";
      speedKph: number;
    }
  | null;

export type SnapshottedConditioningIntensity =
  | { method: "rpe"; value: number }
  | {
      method: "heart_rate";
      valueBpm: number;
      maxHeartRateBpm: number;
    }
  | {
      method: "pace";
      reference: "threshold_pace";
      paceSecondsPerKm: number;
      thresholdPaceSecondsPerKm: number;
    }
  | {
      method: "pace";
      reference: "maximum_aerobic_speed";
      speedKph: number;
      maximumAerobicSpeedKph: number;
    }
  | null;

export type AthleteConditioningBaselines = {
  maximumHeartRateBpm: number | null;
  thresholdPaceSecondsPerKm: number | null;
  maximumAerobicSpeedKph: number | null;
};

export type ConditioningSessionDefinition = {
  title: string;
  activity: ConditioningActivity;
  protocol: ConditioningProtocol;
  intensity: ConditioningIntensityInput;
  notes: string | null;
};

export type NewConditioningTemplate = ConditioningSessionDefinition;

export type StoredConditioningTemplate = ConditioningSessionDefinition & {
  id: number;
  createdAt: number;
  updatedAt: number;
};

export type NewConditioningLog = Omit<
  ConditioningSessionDefinition,
  "intensity"
> & {
  sourceTemplateId: number | null;
  startAt: number;
  intensity: SnapshottedConditioningIntensity;
};

export type ConditioningProtocolMetrics = {
  protocolType: ConditioningProtocolType;
  totalBouts: number;
  workBoutSeconds: number[];
  totalWorkSeconds: number;
  totalRestSeconds: number;
  totalSessionSeconds: number;
  totalDistanceMeters: number | null;
  averageWorkBoutSeconds: number;
  workToRestRatio: number | null;
  estimatedWorkDuration: boolean;
};

export type ConditioningValidationIssue = {
  field: string;
  message: string;
};

export type ConditioningProtocolResult =
  | {
      ok: true;
      protocol: ConditioningProtocol;
      metrics: ConditioningProtocolMetrics;
    }
  | {
      ok: false;
      issues: ConditioningValidationIssue[];
    };

export type ConditioningAdaptationScores = Record<
  ConditioningAdaptationKey,
  number
>;

export type ConditioningScoreResult =
  | {
      status: "scored";
      scores: ConditioningAdaptationScores;
      primaryAdaptation: ConditioningAdaptationKey;
      evidence: "full" | "limited";
      missingInputs: string[];
      modelVersion: "conditioning-v1.0.0";
    }
  | {
      status: "insufficient";
      scores: null;
      primaryAdaptation: null;
      evidence: "insufficient";
      reasons: string[];
      modelVersion: "conditioning-v1.0.0";
    };

export type ConditioningScoringInput = {
  activity: ConditioningActivity;
  protocol: ConditioningProtocol;
  intensity: SnapshottedConditioningIntensity;
};
