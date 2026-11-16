import { createId } from "../conditioning/ids";
import { getSkillActivity } from "./catalog";
import type {
  SkillActivityDraft,
  SkillDraft,
  SkillTemplateRecord,
  TemplateButtonLabel,
} from "./types";
import { MAX_SKILL_ACTIVITIES } from "./types";

const DEFAULT_DURATION_SECONDS = 180;
const DEFAULT_ROUNDS = 3;
const DEFAULT_REST_SECONDS = 60;

export function createActivityDraft(activityKey: string, id = createId()) {
  const definition = getSkillActivity(activityKey);
  if (!definition) {
    return null;
  }
  const draft: SkillActivityDraft = {
    activityKey: definition.key,
    discipline: definition.discipline,
    durationSeconds: DEFAULT_DURATION_SECONDS,
    id,
    name: definition.name,
    restBetweenRoundsSeconds: DEFAULT_REST_SECONDS,
    rounds: DEFAULT_ROUNDS,
    rpeBand: "moderate",
    secondsPerRound: DEFAULT_DURATION_SECONDS,
    sessionMode: definition.modes ? "medium" : null,
    timingMode: "duration",
  };
  return draft;
}

export function createSkillDraft(endedAt: number, sessionId = createId()): SkillDraft {
  return {
    activities: [],
    endedAt,
    sessionId,
    sourceTemplateId: null,
    templateLink: "new",
    title: "",
  };
}

export function draftFromTemplate(
  template: SkillTemplateRecord,
  endedAt: number,
  sessionId = createId(),
): SkillDraft {
  return {
    activities: template.activities.map((activity) => ({
      ...activity,
      id: createId(),
    })),
    endedAt,
    sessionId,
    sourceTemplateId: template.id,
    templateLink: "linked",
    title: template.title,
  };
}

export function addCatalogActivity(draft: SkillDraft, activityKey: string) {
  if (draft.activities.length >= MAX_SKILL_ACTIVITIES) {
    return draft;
  }
  const activity = createActivityDraft(activityKey);
  if (!activity) {
    return draft;
  }
  return { ...draft, activities: [...draft.activities, activity] };
}

export function updateActivity(
  draft: SkillDraft,
  activityId: string,
  patch: Partial<SkillActivityDraft>,
) {
  return {
    ...draft,
    activities: draft.activities.map((activity) =>
      activity.id === activityId ? { ...activity, ...patch, id: activity.id } : activity,
    ),
  };
}

export function removeActivity(draft: SkillDraft, activityId: string) {
  return {
    ...draft,
    activities: draft.activities.filter((activity) => activity.id !== activityId),
  };
}

export function moveActivity(
  draft: SkillDraft,
  activityId: string,
  direction: -1 | 1,
) {
  const index = draft.activities.findIndex((activity) => activity.id === activityId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= draft.activities.length) {
    return draft;
  }
  const activities = [...draft.activities];
  const [moved] = activities.splice(index, 1);
  if (!moved) {
    return draft;
  }
  activities.splice(nextIndex, 0, moved);
  return { ...draft, activities };
}

export function templateContent(draft: SkillDraft) {
  return {
    activities: draft.activities.map((activity) => ({
      activityKey: activity.activityKey,
      durationSeconds: activity.timingMode === "duration" ? activity.durationSeconds : null,
      name: activity.name,
      restBetweenRoundsSeconds:
        activity.timingMode === "rounds" ? activity.restBetweenRoundsSeconds : null,
      rounds: activity.timingMode === "rounds" ? activity.rounds : null,
      rpeBand: activity.rpeBand,
      secondsPerRound: activity.timingMode === "rounds" ? activity.secondsPerRound : null,
      sessionMode: activity.sessionMode,
      timingMode: activity.timingMode,
    })),
    title: draft.title.trim(),
  };
}

export function templateFingerprint(draft: SkillDraft) {
  return JSON.stringify(templateContent(draft));
}

export function templateButtonLabel(
  draft: SkillDraft,
  persistedFingerprint: string | null,
): TemplateButtonLabel {
  if (draft.templateLink === "detached") {
    return "Unsaved";
  }
  if (
    draft.templateLink === "linked" &&
    persistedFingerprint != null &&
    templateFingerprint(draft) === persistedFingerprint
  ) {
    return "Saved";
  }
  return "Save";
}
