import { conditioningAdaptations } from "../constants/conditioning";
import { strengthAdaptations } from "../constants/strength";
import { timelineCategories, type TimelineCategoryPresentation } from "../constants/timelineCategories";
import type { TimelineKind } from "../data/timelineRepository";
import type { ConditioningAdaptationKey } from "../types/conditioning";
import type { StrengthAdaptation } from "../types/strength";

export type TimelineColorPresentation = Pick<TimelineCategoryPresentation, "color" | "contentColor"> & {
  label: string;
};

function isStrengthAdaptation(value: string): value is StrengthAdaptation {
  return value in strengthAdaptations;
}

function isConditioningAdaptation(value: string): value is ConditioningAdaptationKey {
  return value in conditioningAdaptations;
}

export function getDayTimelinePresentation(kind: TimelineKind): TimelineCategoryPresentation {
  return timelineCategories[kind];
}

export function getStrengthMonthPresentation(
  adaptation: StrengthAdaptation | string | null | undefined,
): TimelineColorPresentation {
  if (adaptation && isStrengthAdaptation(adaptation)) {
    return strengthAdaptations[adaptation];
  }

  return {
    label: timelineCategories.strength.label,
    color: timelineCategories.strength.color,
    contentColor: timelineCategories.strength.contentColor,
  };
}

export function getConditioningMonthPresentation(
  adaptation: ConditioningAdaptationKey | string | null | undefined,
): TimelineColorPresentation {
  if (adaptation && isConditioningAdaptation(adaptation)) {
    return conditioningAdaptations[adaptation];
  }

  return {
    label: timelineCategories.conditioning.label,
    color: timelineCategories.conditioning.color,
    contentColor: timelineCategories.conditioning.contentColor,
  };
}

export function getStatusPresentation(status: "pending" | "scored" | "insufficient"): TimelineColorPresentation {
  if (status === "pending") {
    return {
      label: "Adaptation pending",
      color: timelineCategories.skill.color,
      contentColor: timelineCategories.skill.contentColor,
    };
  }

  if (status === "insufficient") {
    return {
      label: "Insufficient data",
      color: timelineCategories.weight.color,
      contentColor: timelineCategories.weight.contentColor,
    };
  }

  return {
    label: "Scored",
    color: timelineCategories.strength.color,
    contentColor: timelineCategories.strength.contentColor,
  };
}
