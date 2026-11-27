import { trainingMetric, type MetricReason, type MetricResult } from "../domain/training/metric";
import { isLocalDateString } from "./dates";
import type {
  ConditioningObservations,
  ConditioningOutputUnit,
  ConditioningProtocol,
  ConditioningReference,
  OccurrenceInput,
  SessionStatus,
} from "./types";

/** CAPS v1 screening defaults. These classify logged exposure, not adaptation. */
export const CONDITIONING_STIMULUS_V1 = {
  vo2Fraction: 0.9,
  sustainedHardMinimumSeconds: 60,
  sprintMaximumSeconds: 10,
  sprintQualityFraction: 0.9,
} as const;

type SessionEvidence = {
  status: SessionStatus;
  performedAt: number | null;
  performedLocalDate: string | null;
  activeSeconds: number | null;
  elapsedSeconds: number | null;
  sessionSeconds: number | null;
  sessionRpe: number | null;
  continuous: boolean;
  expectedWorkBouts: number;
  sprintProtocol: boolean;
  observations?: ConditioningObservations;
  occurrences: OccurrenceInput[];
  now: number;
};

type Bout = {
  occurrence: OccurrenceInput;
  seconds: number | null;
  rest: number | null;
  sprintClassified: boolean;
  speed: number | null;
  watts: number | null;
};

const measuredUnit = (protocol?: ConditioningProtocol) =>
  protocol?.mode === "run" ? "m/s" :
    protocol?.mode === "cycling" || protocol?.mode === "assault_bike" ? "W" : null;

function positive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function nonnegative(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function sameProtocol(left: ConditioningProtocol | undefined, right: ConditioningProtocol) {
  if (!left?.test?.trim() || !left.source?.trim() ||
    (left.mode === "assault_bike" && (!left.machine?.trim() || !left.technique?.trim()))) return false;
  return left.mode === right.mode && left.test === right.test && left.source === right.source &&
    left.machine === right.machine && left.technique === right.technique &&
    left.distanceMeters === right.distanceMeters;
}

type DatedProtocol = Pick<ConditioningReference, "testDate" | "protocol">;

function referenceReason(
  reference: DatedProtocol | undefined,
  protocol: ConditioningProtocol | undefined,
  day: string | null,
): MetricReason | null {
  if (!reference || !day) return "missing";
  if (!isLocalDateString(reference.testDate) || reference.testDate >= day) return "invalid";
  return sameProtocol(protocol, reference.protocol) ? null : "incompatible";
}

function numeric(
  metricId: string, value: number | null, unit: string, method: string,
  valid: number, total: number, usedInputs: string[], missingInputs: string[],
  reason: MetricReason = "missing", fallback = false,
): MetricResult {
  return trainingMetric({
    metricId, value, unit, method,
    status: value === null ? "unavailable" : valid < total || fallback ? "partial" : "available",
    coverage: { valid, total }, usedInputs,
    missingInputs: valid < total || fallback || value === null ? missingInputs : [],
    reasonCodes: value === null || fallback ? [reason] : valid < total ? ["incomplete-coverage"] : [],
  });
}

export function conditioningStimulus(input: SessionEvidence) {
  const eligible = (input.status === "completed" || input.status === "ended_early") &&
    Number.isFinite(input.performedAt) && input.performedAt! <= input.now;
  const unique = new Map<string, OccurrenceInput>();
  if (eligible) {
    for (const occurrence of input.occurrences) {
      if (occurrence.phaseType === "work" && occurrence.completionStatus === "completed" &&
        !unique.has(occurrence.id)) unique.set(occurrence.id, occurrence);
    }
  }
  const bouts: Bout[] = [...unique.values()].sort((a, b) => a.position - b.position).map((occurrence) => {
    const { actual, workSeconds } = occurrence;
    const seconds = positive(workSeconds) ? workSeconds : null;
    return {
      occurrence, seconds, rest: nonnegative(actual?.restSeconds) ? actual.restSeconds : null,
      sprintClassified: input.sprintProtocol || actual?.effort === "sprint",
      speed: seconds !== null && positive(actual?.distanceMeters) ? actual.distanceMeters / seconds : null,
      watts: nonnegative(actual?.watts) ? actual.watts : null,
    };
  });
  const timed = bouts.filter((bout) => bout.seconds !== null);
  const continuousSeconds = eligible && input.continuous ? timed.length === 1 ? timed[0].seconds :
    positive(input.activeSeconds) && input.activeSeconds === input.elapsedSeconds ? input.activeSeconds : null : null;
  const total = input.status === "completed" && eligible
    ? Math.max(bouts.length, input.expectedWorkBouts) : bouts.length;
  const recordedWork = timed.reduce((sum, bout) => sum + bout.seconds!, 0);
  const totalRecordedWork = timed.length ? recordedWork :
    eligible && input.continuous && nonnegative(input.activeSeconds) ? input.activeSeconds : null;
  const work = numeric("conditioning.work-duration", totalRecordedWork,
    "s", "Recorded work", timed.length || Number(totalRecordedWork !== null),
    total || 1, ["actual work duration"], ["actual work duration"]);
  const restBouts = bouts.slice(0, -1);
  const knownRest = restBouts.filter((bout) => bout.rest !== null);
  const restTotal = Math.max(0, total - 1);
  const restSeconds = knownRest.reduce((sum, bout) => sum + bout.rest!, 0);
  const rest = numeric("conditioning.rest-duration", knownRest.length ? restSeconds : null,
    "s", "Recorded inter-bout rest", knownRest.length, restTotal,
    ["actual rest duration"], ["actual inter-bout rest duration"]);
  const ratio = numeric("conditioning.work-rest-ratio",
    total > 1 && timed.length === total && knownRest.length === restTotal && restSeconds > 0
      ? recordedWork / restSeconds : null, ":1", "Recorded work divided by recorded rest",
    knownRest.length, restTotal, ["work and rest duration"], ["complete work and nonzero rest duration"]);
  const continuous = numeric("conditioning.continuous-duration", continuousSeconds, "s",
    "Continuous work", Number(continuousSeconds !== null), 1,
    ["uninterrupted recording"], ["uninterrupted recording"]);
  const sessionLoadAvailable = eligible && positive(input.sessionSeconds) &&
    nonnegative(input.sessionRpe) && input.sessionRpe <= 10;
  const sessionLoad = numeric("conditioning.internal-load",
    sessionLoadAvailable ? input.sessionSeconds! * input.sessionRpe! / 60 : null,
    "sRPE units", "Completed minutes × session RPE", Number(sessionLoadAvailable), 1,
    ["completed duration", "session RPE"], [
      ...(!positive(input.sessionSeconds) ? ["completed duration"] : []),
      ...(!nonnegative(input.sessionRpe) || input.sessionRpe > 10 ? ["session RPE"] : []),
    ]);
  const observations = input.observations;
  const protocol = observations?.protocol;
  const outputUnit = measuredUnit(protocol);
  const output = (bout: Bout) => outputUnit === "W" ? bout.watts : outputUnit === "m/s" ? bout.speed : null;

  const bounds = observations?.intensityBounds;
  const boundsReason = referenceReason(bounds, protocol, input.performedLocalDate) ??
    (bounds?.unit === outputUnit && positive(bounds?.moderate) && positive(bounds?.hard) &&
      bounds.hard > bounds.moderate ? null : "invalid");
  const measured = bounds && !boundsReason ? timed.filter((bout) => output(bout) !== null) : [];
  const manual = timed.filter((bout) => bout.occurrence.actual?.effort !== undefined);
  const domains = (["easy", "moderate", "sustained_hard"] as const).map((domain) => numeric(
    `conditioning.endurance.${domain}`,
    measured.length ? measured.reduce((sum, bout) => {
      const value = output(bout)!;
      const found = value >= bounds!.hard ? "sustained_hard" : value >= bounds!.moderate ? "moderate" : "easy";
      return sum + (found === domain ? bout.seconds! / 60 : 0);
    }, 0) : null,
    "min", "Measured output against tested bounds", measured.length, total,
    ["actual work duration", "measured output", "same-mode tested bounds"],
    ["compatible output and tested bounds"], boundsReason ?? "missing"));
  const manualDomains = (["easy", "moderate", "sustained_hard", "repeated_effort", "sprint"] as const)
    .filter((effort) => manual.some((bout) => bout.occurrence.actual?.effort === effort))
    .map((effort) => numeric(
      `conditioning.manual.${effort}`,
      manual.reduce((sum, bout) => sum + (bout.occurrence.actual?.effort === effort ? bout.seconds! / 60 : 0), 0),
      "min", "Logged effort labels", manual.length, total,
      ["actual work duration", "logged effort label"], ["actual duration and effort for remaining work"],
      "missing", true));

  const vo2max = observations?.vo2max;
  const vo2Reason = referenceReason(vo2max, protocol, input.performedLocalDate) ??
    (positive(vo2max?.value) ? null : "invalid");
  const oxygen = timed.flatMap((bout) => {
    const spans = bout.occurrence.actual?.oxygenUptake;
    if (vo2Reason || !spans?.length || spans.some((span) => !positive(span.seconds) || !positive(span.mlKgMin))) return [];
    const covered = spans.reduce((sum, span) => sum + span.seconds, 0);
    if (covered > bout.seconds!) return [];
    const above = spans.reduce((sum, span) =>
      sum + (span.mlKgMin >= vo2max!.value * CONDITIONING_STIMULUS_V1.vo2Fraction ? span.seconds : 0), 0);
    return [{ covered, above, complete: covered === bout.seconds }];
  });
  const oxygenSeconds = oxygen.reduce((sum, bout) => sum + bout.covered, 0);
  const vo2 = numeric("conditioning.vo2-time",
    oxygen.length ? oxygen.reduce((sum, bout) => sum + bout.above, 0) / 60 : null,
    "min", "Measured oxygen uptake ≥90% VO₂max",
    oxygen.filter((bout) => bout.complete).length, total, ["measured oxygen uptake", "same-mode VO₂max"],
    ["measured oxygen uptake and compatible VO₂max"], vo2Reason ?? "missing");

  const effortKnown = timed.filter((bout) => bout.sprintClassified ||
    bout.occurrence.actual?.effort !== undefined || measured.includes(bout));
  const sustainedSeconds = effortKnown.reduce((sum, bout) => {
    if (bout.sprintClassified) return sum;
    const hardLabel = bout.occurrence.actual?.effort === "sustained_hard";
    const qualifies = bout.seconds! >= CONDITIONING_STIMULUS_V1.sustainedHardMinimumSeconds &&
      measured.includes(bout) && output(bout)! >= bounds!.hard;
    return sum + (hardLabel || qualifies ? bout.seconds! : 0);
  }, 0);
  const sustained = numeric("conditioning.sustained-hard",
    effortKnown.length ? sustainedSeconds / 60 : null, "min", "Sustained-hard work",
    effortKnown.length, total, ["actual work duration", "logged effort or tested output"],
    ["sustained-hard label or compatible tested output", "measured oxygen uptake and VO₂max"], "missing", true);

  const critical = outputUnit === "W" ? observations?.criticalPower :
    outputUnit === "m/s" ? observations?.criticalSpeed : undefined;
  const criticalReason = referenceReason(critical, protocol, input.performedLocalDate) ??
    (positive(critical?.value) ? null : "invalid");
  const aboveCritical = critical && !criticalReason ? timed.filter((bout) => output(bout) !== null) : [];
  const above = numeric("conditioning.above-critical", aboveCritical.length
    ? aboveCritical.reduce((sum, bout) => sum + Math.max(0, output(bout)! - critical!.value) * bout.seconds!, 0)
      / (outputUnit === "W" ? 1000 : 1) : null,
  outputUnit === "m/s" ? "m" : "kJ",
  outputUnit === "m/s" ? "Distance above critical speed" : "Work above critical power",
  aboveCritical.length, total, ["measured output", "actual work duration", "compatible critical reference"],
  ["measured output and a compatible critical power or speed test"], criticalReason ?? "missing");
  const protocolKnown = timed.filter((bout) => bout.occurrence.actual?.effort !== undefined || input.sprintProtocol);
  const exposure = numeric("conditioning.protocol-exposure", protocolKnown.length
    ? protocolKnown.reduce((sum, bout) => {
      const effort = bout.occurrence.actual?.effort;
      return sum + (effort === "sustained_hard" || effort === "repeated_effort" || input.sprintProtocol ? bout.seconds! : 0);
    }, 0) : null,
  "s", "Protocol exposure", protocolKnown.length, total,
  ["explicit completed work protocol or effort", "actual work duration"],
  ["actual work duration and sustained-hard or repeated-effort label"], "missing", true);

  const shortSprints = timed.filter((bout) => bout.sprintClassified && bout.seconds! <= CONDITIONING_STIMULUS_V1.sprintMaximumSeconds);
  const shortSprintCoverage = timed.filter((bout) => bout.sprintClassified || bout.occurrence.actual?.effort !== undefined).length;
  const sprint = numeric("conditioning.short-sprints", shortSprintCoverage ? shortSprints.length : null,
    "bouts", "Completed short sprint bouts", shortSprintCoverage, total,
    ["sprint classification", "actual sprint duration"], ["sprint classification and actual sprint duration"], "missing", true);
  const sprintReference = observations?.sprintBest;
  const sprintUnit: ConditioningOutputUnit = sprintReference?.unit ?? outputUnit ?? "s";
  const sprintReason = referenceReason(sprintReference, protocol, input.performedLocalDate) ??
    (positive(sprintReference?.value) && (sprintUnit === outputUnit ||
      sprintUnit === "s" && positive(protocol?.distanceMeters)) ? null : "incompatible");
  const matchedSplit = (bout: Bout) => positive(protocol?.distanceMeters) &&
    bout.occurrence.actual?.distanceMeters === protocol.distanceMeters;
  const sprintOutput = (bout: Bout) => sprintUnit === "s" ? matchedSplit(bout) ? bout.seconds : null
    : sprintUnit === "m/s" && !matchedSplit(bout) ? null : output(bout);
  const sprintMeasured = shortSprints.filter((bout) => positive(sprintOutput(bout)));
  const best = sprintMeasured.reduce<number | null>((previous, bout) => {
    const value = sprintOutput(bout)!;
    return previous === null ? value : sprintUnit === "s" ? Math.min(previous, value) : Math.max(previous, value);
  }, null);
  const test = numeric("conditioning.sprint-quality", !sprintReason && sprintMeasured.length
    ? sprintMeasured.filter((bout) => {
      const value = sprintOutput(bout)!;
      return (sprintUnit === "s" ? sprintReference!.value / value : value / sprintReference!.value)
        >= CONDITIONING_STIMULUS_V1.sprintQualityFraction;
    }).length : null, "bouts", "Bouts ≥90% of prior matched best", sprintReason ? 0 : sprintMeasured.length,
  shortSprints.length + total - shortSprintCoverage, ["matched sprint output", "prior test result"],
  ["comparable ≤10 s sprint output and earlier same-test best"], sprintReason ?? "missing");
  const sprintBest = numeric("conditioning.sprint-best", best, sprintUnit, "Best short sprint this session",
    sprintMeasured.length, shortSprints.length + total - shortSprintCoverage,
    ["comparable sprint output"], ["observed matched split or same-machine sprint power"]);
  const sprintDrop = sprintMeasured.map((bout) => ({
    position: bout.occurrence.position,
    output: sprintOutput(bout)!,
    drop: 100 * (sprintUnit === "s" ? sprintOutput(bout)! / best! - 1 : 1 - sprintOutput(bout)! / best!),
  }));
  const comparableOutputs = timed.filter((bout) => positive(output(bout)));
  const first = comparableOutputs.at(0);
  const last = comparableOutputs.at(-1);
  const retention = numeric("conditioning.output-retention",
    first && last && first !== last && protocol?.source?.trim() &&
      (protocol.mode !== "assault_bike" || protocol.machine?.trim() && protocol.technique?.trim())
      ? 100 * output(last)! / output(first)! : null, "%",
  "Last measured work bout relative to first", comparableOutputs.length, total,
  ["comparable first and last bout output"], ["at least two compatible measured work outputs"]);
  return {
    work, rest, ratio, continuous, sessionLoad, domains, manualDomains, vo2, oxygenSeconds, sustained, above,
    exposure, sprint, test, sprintBest, sprintDrop, retention, sprintUnit,
    sprintMeasured: sprintMeasured.length, sprintTotal: shortSprints.length + total - shortSprintCoverage,
    bouts: bouts.map((bout) => ({
      position: bout.occurrence.position, seconds: bout.seconds, rest: bout.rest,
      restType: bout.occurrence.actual?.restType, restRpe: bout.occurrence.actual?.restRpe,
      effort: bout.occurrence.actual?.effort ?? (input.sprintProtocol ? "sprint" : undefined),
      watts: bout.watts, distance: bout.occurrence.actual?.distanceMeters ?? null,
      source: protocol?.source ?? bout.occurrence.completionMethod,
    })),
    protocol, references: observations,
  };
}
