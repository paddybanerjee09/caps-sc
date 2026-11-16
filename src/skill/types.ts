export const SKILL_ENERGY_VERSION = "skill-energy-v1";
export const REFERENCE_WEIGHT_KG = 75;
export const MAX_SKILL_ACTIVITIES = 24;
export const RECOVERY_MET = 1.5;

export type SkillDiscipline = "general" | "muay_thai" | "boxing" | "bjj";
export type SkillFocus = SkillDiscipline | "mixed";
export type RpeBand = "easy" | "moderate" | "hard";
export type SessionMode = "technical" | "medium" | "hard" | "flow";
export type TimingMode = "duration" | "rounds";
export type TemplateLink = "new" | "linked" | "detached";
export type WeightBasis = "logged" | "reference";
export type TemplateButtonLabel = "Save" | "Saved" | "Unsaved";

export type SkillModeDefinition = {
  baseMet: number;
  label: string;
  mode: SessionMode;
};

export type SkillActivityDefinition = {
  baseMet: number | null;
  discipline: SkillDiscipline;
  key: string;
  modes: readonly SkillModeDefinition[] | null;
  name: string;
};

export type SkillActivityDraft = {
  activityKey: string;
  discipline: SkillDiscipline;
  durationSeconds: number;
  id: string;
  name: string;
  restBetweenRoundsSeconds: number;
  rounds: number;
  rpeBand: RpeBand;
  secondsPerRound: number;
  sessionMode: SessionMode | null;
  timingMode: TimingMode;
};

export type SkillDraft = {
  activities: SkillActivityDraft[];
  endedAt: number;
  sessionId: string;
  sourceTemplateId: string | null;
  templateLink: TemplateLink;
  title: string;
};

export type SkillActivityRecord = SkillActivityDraft & {
  baseMet: number;
  energyKcal: number;
  position: number;
  restSeconds: number;
  rpeMultiplier: number;
  workSeconds: number;
};

export type SkillTemplateRecord = {
  activities: SkillActivityDraft[];
  archivedAt: number | null;
  id: string;
  title: string;
  updatedAt: number;
};

export type SkillSessionSummary = {
  endedAt: number;
  focus: SkillFocus;
  id: string;
  localEndDate: string;
  title: string;
};

export type SkillSessionRecord = SkillSessionSummary & {
  activities: SkillActivityRecord[];
  elapsedSeconds: number;
  energyKcal: number;
  estimatorVersion: string;
  sourceTemplateId: string | null;
  startedAt: number;
  timeZone: string;
  timelineEntryId: number;
  weightBasis: WeightBasis;
  weightKg: number;
};
