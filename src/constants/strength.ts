import { appColorPalette } from "../theme/theme";
import type { StrengthAdaptation } from "../types/strength";

export const strengthModelVersion = "strength-v1.0.0";
export const strengthAdaptationOrder: StrengthAdaptation[] = ["hypertrophy", "power", "endurance"];
export const strengthAdaptations = {
  hypertrophy: { label: "Hypertrophy", color: appColorPalette.purple, contentColor: "#FFFFFF" },
  power: { label: "Power", color: appColorPalette.orange, contentColor: "#111214" },
  endurance: { label: "Endurance", color: appColorPalette.turquoise, contentColor: "#111214" },
};
export const strengthScoringDisclaimer = "Heuristic training-stimulus estimates, not medical advice or scientifically validated physiological predictions. Scores do not predict individual adaptation.";
export const strengthLimits = { exercises: 100, sets: 50, reps: 500, loadKg: 2000, notes: 2000 };

// Trapezoids: zero at outer endpoints, full preference between inner endpoints.
export const strengthCurves = {
  hypertrophyReps: [1, 6, 20, 35], hypertrophyRpe: [4, 7, 10, 11], hypertrophyIntensity: [20, 55, 80, 100],
  powerReps: [0, 1, 5, 12], powerRpe: [1, 5, 8, 10], powerIntensity: [10, 40, 85, 101],
  powerExposure: [0, 3, 30, 80], enduranceReps: [3, 20, 100, 501], enduranceIntensity: [0, 10, 50, 85],
  hardSetRpeFloor: 4, hardSetRpeSpan: 4, missingIntensityPreference: 0.5,
  hypertrophyVolumeLoadKg: 2000, volumeLoadFloor: 0.6,
  unknownPowerFactor: 0.25, nonExplosivePowerFactor: 0.1,
  sessionHardSets: 6, sessionRepetitions: 60, exposureFloor: 0.25,
} as const;
