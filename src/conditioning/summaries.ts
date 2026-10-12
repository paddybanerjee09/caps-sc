import { circuitTiming, intervalDurations, sprintRecoveryDurations } from "./phases";
import type { TemplateConfig } from "./types";
import {
  metersToDistance,
  metersToElevation,
  type MeasurementSystem,
} from "./units";

export function formatTemplateSummary(
  config: TemplateConfig,
  distanceSystem: MeasurementSystem,
  elevationSystem: MeasurementSystem,
) {
  if (config.format === "time_interval" && config.interval) {
    const totals = intervalDurations(config.interval);
    return `${config.interval.workSeconds}s/${config.interval.restSeconds}s · ${config.interval.rounds}×${config.interval.intervalsPerRound} · ${formatClock(totals.workoutSeconds)}`;
  }

  if (config.format === "sprint" && config.sprint) {
    const distance = metersToDistance(config.sprint.distanceMeters, distanceSystem, "short");
    const unit = distanceSystem === "metric" ? "m" : "yd";
    const recovery = sprintRecoveryDurations(config.sprint);
    const elevation =
      config.sprint.targetElevationGainMeters === null
        ? ""
        : ` · ${metersToElevation(config.sprint.targetElevationGainMeters, elevationSystem).toFixed(0)} ${elevationSystem === "metric" ? "m" : "ft"} gain`;
    return `${distance.toFixed(0)} ${unit} · ${config.sprint.sets}×${config.sprint.sprintsPerSet} · ${formatClock(recovery.prescribedRecoverySeconds)} recovery${elevation}`;
  }

  if (config.format === "circuit" && config.circuit) {
    const timing = circuitTiming(config.circuit);
    const names = config.circuit.stations
      .slice(0, 3)
      .map((station) => station.exerciseName)
      .join(", ");
    const timed = timing.fullyKnown
      ? formatClock(timing.knownWorkSeconds + timing.knownRecoverySeconds)
      : `${formatClock(timing.knownWorkSeconds + timing.knownRecoverySeconds)} timed`;
    return `${config.circuit.stations.length} stations · ${config.circuit.rounds} rounds · ${timed}${names ? ` · ${names}` : ""}`;
  }

  return "";
}

export function formatName(format: TemplateConfig["format"] | "free") {
  switch (format) {
    case "time_interval":
      return "Time interval";
    case "sprint":
      return "Sprints";
    case "circuit":
      return "Circuit";
    default:
      return "Free session";
  }
}

export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
