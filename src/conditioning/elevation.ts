export const ELEVATION_VERSION = "elevation-v0.1";
export const ELEVATION_WINDOW = 5;
export const ELEVATION_HYSTERESIS_METERS = 3;
export const ELEVATION_ACCURACY_CEILING_METERS = 30;

export type AltitudeSample = {
  altitude: number | null;
  altitudeAccuracy: number | null;
};

export function estimateElevation(segments: AltitudeSample[][]) {
  let gainMeters = 0;
  let lossMeters = 0;
  let usedSegment = false;

  for (const segment of segments) {
    const reliable = segment.filter(isReliableAltitude).map((sample) => sample.altitude as number);
    if (reliable.length < ELEVATION_WINDOW) {
      continue;
    }

    usedSegment = true;
    const smoothed = rollingMedian(reliable, ELEVATION_WINDOW);
    let reference = smoothed[0] ?? 0;
    for (const value of smoothed.slice(1)) {
      const delta = value - reference;
      if (delta >= ELEVATION_HYSTERESIS_METERS) {
        gainMeters += delta;
        reference = value;
      } else if (delta <= -ELEVATION_HYSTERESIS_METERS) {
        lossMeters += -delta;
        reference = value;
      }
    }
  }

  if (!usedSegment) {
    return { gainMeters: null, lossMeters: null };
  }

  return { gainMeters, lossMeters };
}

function isReliableAltitude(sample: AltitudeSample) {
  return (
    sample.altitude != null &&
    Number.isFinite(sample.altitude) &&
    (sample.altitudeAccuracy == null ||
      (Number.isFinite(sample.altitudeAccuracy) &&
        sample.altitudeAccuracy <= ELEVATION_ACCURACY_CEILING_METERS))
  );
}

function rollingMedian(values: number[], window: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - Math.floor(window / 2));
    const end = Math.min(values.length, start + window);
    const slice = values.slice(start, end).sort((left, right) => left - right);
    return slice[Math.floor(slice.length / 2)] ?? values[index] ?? 0;
  });
}
