import { appColorPalette } from "../theme/theme";
import type {
  ConditioningActivity,
  ConditioningAdaptationKey,
  ConditioningProtocolType,
} from "../types/conditioning";

export const conditioningActivityOptions = [
  { key: "running", label: "Running", icon: "run-fast" },
  { key: "hill_sprints", label: "Hill Sprints", icon: "slope-uphill" },
  { key: "assault_bike", label: "Assault Bike", icon: "bike-fast" },
  { key: "rowing", label: "Rowing", icon: "rowing" },
  { key: "swimming", label: "Swimming", icon: "swim" },
  { key: "circuit", label: "Circuit", icon: "sync" },
  { key: "other", label: "Other", icon: "dots-horizontal" },
] as const satisfies readonly {
  key: ConditioningActivity;
  label: string;
  icon: string;
}[];

export const conditioningProtocolOptions = [
  { key: "continuous", label: "Continuous" },
  { key: "time_intervals", label: "Time Intervals" },
  { key: "distance_intervals", label: "Distance Intervals" },
  { key: "circuit", label: "Circuit" },
] as const satisfies readonly {
  key: ConditioningProtocolType;
  label: string;
}[];

export const conditioningAdaptationOrder = [
  "aerobic_base",
  "aerobic_power",
  "alactic_power",
  "alactic_capacity",
  "lactic_power",
  "lactic_capacity",
  "recovery",
] as const satisfies readonly ConditioningAdaptationKey[];

export type ConditioningAdaptationPresentation = {
  label: string;
  color: string;
  contentColor: string;
};

export const conditioningAdaptations = {
  aerobic_base: {
    label: "Aerobic Base",
    color: appColorPalette.green,
    contentColor: "#111214",
  },
  aerobic_power: {
    label: "Aerobic Power (VO₂max)",
    color: appColorPalette.turquoise,
    contentColor: "#111214",
  },
  alactic_power: {
    label: "Alactic Power",
    color: appColorPalette.red,
    contentColor: "#FFFFFF",
  },
  alactic_capacity: {
    label: "Alactic Capacity",
    color: appColorPalette.orange,
    contentColor: "#111214",
  },
  lactic_power: {
    label: "Lactic Power",
    color: appColorPalette.purple,
    contentColor: "#FFFFFF",
  },
  lactic_capacity: {
    label: "Lactic Capacity",
    color: appColorPalette.blue,
    contentColor: "#FFFFFF",
  },
  recovery: {
    label: "Recovery",
    color: appColorPalette.pink,
    contentColor: "#111214",
  },
} satisfies Record<
  ConditioningAdaptationKey,
  ConditioningAdaptationPresentation
>;

export const conditioningValidationLimits = {
  titleLength: 80,
  notesLength: 2000,
  stationNameLength: 60,
  durationSeconds: 86400,
  distanceMeters: 1_000_000,
  repetitions: 100,
  sets: 50,
  stations: 30,
  maximumHeartRateBpm: { minimum: 60, maximum: 260 },
  sessionHeartRateBpm: { minimum: 30, maximum: 260 },
  thresholdPaceSecondsPerKm: { minimum: 30, maximum: 3600 },
  maximumAerobicSpeedKph: 60,
  rpe: { minimum: 1, maximum: 10 },
} as const;

export const conditioningScoringDisclaimer =
  "Estimated training stimulus only. These heuristic scores are not a medical or scientifically validated prediction of physiological adaptation.";
