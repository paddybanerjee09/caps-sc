import { isIanaTimeZone } from "../conditioning/dates";
import { getSkillActivity } from "./catalog";
import type { SkillActivityDraft, SkillDraft } from "./types";
import { MAX_SKILL_ACTIVITIES } from "./types";

export function validateSkillDraft(
  draft: SkillDraft,
  purpose: "log" | "template",
  now: number,
  timeZone?: string,
) {
  const title = draft.title.trim();
  if (title.length < 1 || title.length > 80) {
    return "Enter a session title.";
  }
  if (draft.activities.length < 1) {
    return "Add at least one activity.";
  }
  if (draft.activities.length > MAX_SKILL_ACTIVITIES) {
    return "This session already has 24 activities.";
  }
  for (const activity of draft.activities) {
    const error = validateActivity(activity);
    if (error) {
      return error;
    }
  }
  if (purpose === "log") {
    if (!Number.isFinite(draft.endedAt) || draft.endedAt > now) {
      return "Choose an end time that is not in the future.";
    }
    if (timeZone != null && !isIanaTimeZone(timeZone)) {
      return "The timezone on this device is not valid.";
    }
  }
  return null;
}

function validateActivity(activity: SkillActivityDraft) {
  const definition = getSkillActivity(activity.activityKey);
  if (!definition || definition.discipline !== activity.discipline) {
    return "Choose an activity.";
  }
  if (
    activity.rpeBand !== "easy" &&
    activity.rpeBand !== "moderate" &&
    activity.rpeBand !== "hard"
  ) {
    return `Choose a rate of perceived exertion for ${definition.name}.`;
  }
  if (definition.modes) {
    const mode = definition.modes.find((entry) => entry.mode === activity.sessionMode);
    if (!mode) {
      return `Choose a mode for ${definition.name}.`;
    }
  } else if (activity.sessionMode != null) {
    return `Remove the mode from ${definition.name}.`;
  }
  if (activity.timingMode === "duration") {
    if (!isPositiveInt(activity.durationSeconds)) {
      return `Enter a duration for ${definition.name}.`;
    }
    return null;
  }
  if (activity.timingMode === "rounds") {
    if (!isPositiveInt(activity.rounds)) {
      return `Enter the rounds for ${definition.name}.`;
    }
    if (!isPositiveInt(activity.secondsPerRound)) {
      return `Enter the work time for ${definition.name}.`;
    }
    if (!isNonnegativeInt(activity.restBetweenRoundsSeconds)) {
      return `Enter the rest for ${definition.name}.`;
    }
    return null;
  }
  return "Choose duration or rounds.";
}

function isPositiveInt(value: number) {
  return Number.isInteger(value) && value > 0;
}

function isNonnegativeInt(value: number) {
  return Number.isInteger(value) && value >= 0;
}
