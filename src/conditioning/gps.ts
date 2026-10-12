export const GPS_PROCESSING_VERSION = "gps-v0.1";

export const gpsDefaults = {
  continuityGapMs: 30_000,
  horizontalAccuracyCeilingMeters: 30,
  maxSpeedMps: { bike: 35, run: 12 },
  minimumMovementMeters: 3,
} as const;

export type GpsActivity = "run" | "bike";

export type GeoSample = {
  altitude: number | null;
  altitudeAccuracy: number | null;
  horizontalAccuracy: number | null;
  latitude: number;
  longitude: number;
  recordedAt: number;
};

export type GpsFix = {
  horizontalAccuracy: number | null;
  latitude: number;
  longitude: number;
  recordedAt: number;
};

export type GpsState = {
  activity: GpsActivity;
  anchor: GpsFix | null;
  cumulativeMeters: number;
  lastProcessedAt: number | null;
  paused: boolean;
  segmentSequence: number;
  sessionStartedAt: number;
};

export type ProcessedFix = GeoSample & {
  acceptance: "accepted" | "rejected";
  distanceDeltaMeters: number;
  rejectionReason: string | null;
  segmentSequence: number;
};

export function createGpsState(activity: GpsActivity, sessionStartedAt: number): GpsState {
  return {
    activity,
    anchor: null,
    cumulativeMeters: 0,
    lastProcessedAt: null,
    paused: false,
    segmentSequence: 0,
    sessionStartedAt,
  };
}

export function pauseGps(state: GpsState): GpsState {
  return { ...state, anchor: null, paused: true };
}

export function resumeGps(state: GpsState): GpsState {
  return {
    ...state,
    anchor: null,
    paused: false,
    segmentSequence: state.segmentSequence + 1,
  };
}

export function processLocationBatch(
  state: GpsState,
  samples: GeoSample[],
  seen: ReadonlySet<string> = new Set(),
) {
  const ordered = samples.slice().sort((left, right) => left.recordedAt - right.recordedAt);
  const nextSeen = new Set(seen);
  const points: ProcessedFix[] = [];
  let current = state;

  for (const sample of ordered) {
    const result = processOne(current, sample, nextSeen);
    current = result.state;
    points.push(result.point);
    if (result.point.rejectionReason !== "duplicate") {
      nextSeen.add(sampleKey(sample));
    }
  }

  return { points, seen: nextSeen, state: current };
}

export function haversineMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function processOne(state: GpsState, sample: GeoSample, seen: ReadonlySet<string>) {
  const reject = (reason: string, next = state): { point: ProcessedFix; state: GpsState } => ({
    point: {
      ...sample,
      acceptance: "rejected",
      distanceDeltaMeters: 0,
      rejectionReason: reason,
      segmentSequence: next.segmentSequence,
    },
    state: next,
  });

  if (!validCoordinate(sample.latitude, sample.longitude)) {
    return reject("invalid_coordinates");
  }

  const key = sampleKey(sample);
  if (seen.has(key)) {
    return reject("duplicate");
  }

  if (sample.recordedAt < state.sessionStartedAt) {
    return reject("before_session_start");
  }

  if (state.lastProcessedAt != null && sample.recordedAt < state.lastProcessedAt) {
    return reject("out_of_order");
  }

  const stamped = { ...state, lastProcessedAt: sample.recordedAt };
  if (stamped.paused) {
    return reject("paused", stamped);
  }

  if (
    sample.horizontalAccuracy == null ||
    sample.horizontalAccuracy > gpsDefaults.horizontalAccuracyCeilingMeters
  ) {
    return reject("poor_accuracy", stamped);
  }

  const fix: GpsFix = {
    horizontalAccuracy: sample.horizontalAccuracy,
    latitude: sample.latitude,
    longitude: sample.longitude,
    recordedAt: sample.recordedAt,
  };

  if (
    stamped.anchor == null ||
    sample.recordedAt - stamped.anchor.recordedAt > gpsDefaults.continuityGapMs
  ) {
    const segmentSequence =
      stamped.anchor == null ? stamped.segmentSequence : stamped.segmentSequence + 1;
    return {
      point: {
        ...sample,
        acceptance: "accepted",
        distanceDeltaMeters: 0,
        rejectionReason: null,
        segmentSequence,
      },
      state: { ...stamped, anchor: fix, segmentSequence },
    };
  }

  const distance = haversineMeters(stamped.anchor, fix);
  const seconds = (sample.recordedAt - stamped.anchor.recordedAt) / 1000;
  const speed = seconds > 0 ? distance / seconds : Number.POSITIVE_INFINITY;
  if (speed > gpsDefaults.maxSpeedMps[stamped.activity]) {
    return reject("implausible_speed", stamped);
  }

  const threshold = Math.max(
    gpsDefaults.minimumMovementMeters,
    0.5 * ((stamped.anchor.horizontalAccuracy ?? 0) + (sample.horizontalAccuracy ?? 0)),
  );
  if (distance < threshold) {
    return reject("stationary_drift", stamped);
  }

  return {
    point: {
      ...sample,
      acceptance: "accepted",
      distanceDeltaMeters: distance,
      rejectionReason: null,
      segmentSequence: stamped.segmentSequence,
    },
    state: {
      ...stamped,
      anchor: fix,
      cumulativeMeters: stamped.cumulativeMeters + distance,
    },
  };
}

function sampleKey(sample: GeoSample) {
  return `${sample.recordedAt}|${sample.latitude}|${sample.longitude}`;
}

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
