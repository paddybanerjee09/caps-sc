import { FOCUS_PRESENTATION } from "./focus";
import { activityTiming } from "./timing";
import type {
  RpeBand,
  SessionMode,
  SkillActivityDraft,
  SkillFocus,
  WeightBasis,
} from "./types";

const RPE_LABEL: Record<RpeBand, string> = {
  easy: "Easy (RPE 6 or below)",
  moderate: "Moderate (RPE 7–8)",
  hard: "Hard (RPE 9–10)",
};

const MODE_LABEL: Record<SessionMode, string> = {
  technical: "Technical",
  medium: "Medium",
  hard: "Hard",
  flow: "Flow",
};

export function rpeLabel(band: RpeBand) {
  return RPE_LABEL[band];
}

export function modeLabel(mode: SessionMode) {
  return MODE_LABEL[mode];
}

export function focusLabel(focus: SkillFocus) {
  return FOCUS_PRESENTATION[focus].label;
}

export function formatMmSs(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function formatElapsed(seconds: number | null) {
  if (seconds == null) {
    return "--";
  }
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  if (remain === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${remain}s`;
  }
  return `${minutes} min ${remain}s`;
}

export function formatKcal(unrounded: number) {
  return `${Math.round(unrounded)} kcal`;
}

export function weightBasisText(basis: WeightBasis, kg: number) {
  const shown = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
  return basis === "logged" ? `${shown} kg logged` : `${shown} kg reference`;
}

export function activitySettingsLine(activity: SkillActivityDraft) {
  const effort = activity.rpe == null ? rpeLabel(activity.rpeBand) : "RPE " + activity.rpe;
  if (activity.timingMode === "reps") return [activity.sets + " sets × " + activity.reps + " reps", activity.rpe == null ? null : effort].filter(Boolean).join(" · ");
  const mode = activity.sessionMode ? modeLabel(activity.sessionMode) : null;
  if (activity.timingMode === "duration") {
    return [formatMmSs(activity.durationSeconds), mode, effort].filter(Boolean).join(" · ");
  }
  return [
    `${activity.rounds} × ${formatMmSs(activity.secondsPerRound)}`,
    `${formatMmSs(activity.restBetweenRoundsSeconds)} rest`,
    mode,
    effort,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function activityElapsedLabel(activity: SkillActivityDraft) {
  return formatElapsed(activityTiming(activity).elapsedSeconds);
}
