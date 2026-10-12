import { METERS_PER_MILE } from "./units";

export type SplitPoint = {
  activeMs: number;
  cumulativeMeters: number;
  segmentSequence: number;
};

export type DistanceSplit = {
  activeSeconds: number;
  complete: boolean;
  distanceMeters: number;
  ordinal: number;
  partial: boolean;
  unitSystem: "kilometer" | "mile";
};

const boundaries = {
  kilometer: 1000,
  mile: METERS_PER_MILE,
} as const;

export function buildSplits(points: SplitPoint[]) {
  const ordered = points.slice().sort((left, right) => left.cumulativeMeters - right.cumulativeMeters);
  return {
    kilometer: splitsFor(ordered, "kilometer"),
    mile: splitsFor(ordered, "mile"),
  };
}

function splitsFor(points: SplitPoint[], unitSystem: keyof typeof boundaries) {
  const size = boundaries[unitSystem];
  const total = points.at(-1)?.cumulativeMeters ?? 0;
  if (total <= 0) {
    return [];
  }

  const fullCount = Math.floor(total / size);
  const splits: DistanceSplit[] = [];
  for (let ordinal = 1; ordinal <= fullCount; ordinal += 1) {
    splits.push(splitBetween(points, unitSystem, ordinal, (ordinal - 1) * size, ordinal * size, false));
  }

  const remainder = total - fullCount * size;
  if (remainder > 0.5) {
    splits.push(
      splitBetween(points, unitSystem, fullCount + 1, fullCount * size, total, true),
    );
  }

  return splits;
}

function splitBetween(
  points: SplitPoint[],
  unitSystem: keyof typeof boundaries,
  ordinal: number,
  startMeters: number,
  endMeters: number,
  partial: boolean,
): DistanceSplit {
  const start = crossing(points, startMeters);
  const end = crossing(points, endMeters);
  const gap = hasGap(points, startMeters, endMeters);
  return {
    activeSeconds:
      start == null || end == null || gap ? 0 : Math.max(0, (end.activeMs - start.activeMs) / 1000),
    complete: !gap && start != null && end != null,
    distanceMeters: endMeters - startMeters,
    ordinal,
    partial,
    unitSystem,
  };
}

function crossing(points: SplitPoint[], meters: number) {
  if (meters <= 0) {
    return { activeMs: points[0]?.activeMs ?? 0, segmentSequence: points[0]?.segmentSequence ?? 0 };
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (previous.cumulativeMeters > meters || point.cumulativeMeters < meters) {
      continue;
    }
    if (previous.segmentSequence !== point.segmentSequence) {
      return null;
    }
    const span = point.cumulativeMeters - previous.cumulativeMeters;
    const ratio = span === 0 ? 0 : (meters - previous.cumulativeMeters) / span;
    return {
      activeMs: previous.activeMs + ratio * (point.activeMs - previous.activeMs),
      segmentSequence: point.segmentSequence,
    };
  }

  return null;
}

function hasGap(points: SplitPoint[], startMeters: number, endMeters: number) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    if (previous.segmentSequence === point.segmentSequence) {
      continue;
    }
    const gapAt = previous.cumulativeMeters;
    if (gapAt > startMeters && gapAt < endMeters) {
      return true;
    }
  }

  return false;
}
