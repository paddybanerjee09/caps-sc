import type {
  SkillActivityDefinition,
  SkillDiscipline,
  SessionMode,
} from "./types";

export const SKILL_CATALOG: readonly SkillActivityDefinition[] = [
  {
    key: "stretching",
    name: "Stretching / Generic Warm-Up",
    discipline: "general",
    baseMet: 2.3,
    modes: null,
  },
  {
    key: "skipping",
    name: "Skipping Rope",
    discipline: "general",
    baseMet: 11,
    modes: null,
  },
  {
    key: "shadowboxing",
    name: "Shadowboxing",
    discipline: "general",
    baseMet: 5.3,
    modes: null,
  },
  {
    key: "padwork-muay",
    name: "Padwork (Muay Thai/KB)",
    discipline: "muay_thai",
    baseMet: 9.3,
    modes: null,
  },
  {
    key: "partner-padwork-muay",
    name: "Partner Padwork (Muay Thai/KB)",
    discipline: "muay_thai",
    baseMet: 7,
    modes: null,
  },
  {
    key: "padwork-boxing",
    name: "Pad Work (Boxing)",
    discipline: "boxing",
    baseMet: 8.5,
    modes: null,
  },
  {
    key: "partner-padwork-boxing",
    name: "Partner Pad Work (Boxing)",
    discipline: "boxing",
    baseMet: 6.5,
    modes: null,
  },
  {
    key: "bag-muay",
    name: "Bag Work (Muay Thai/KB)",
    discipline: "muay_thai",
    baseMet: 8.5,
    modes: null,
  },
  {
    key: "bag-boxing",
    name: "Bag Work (Boxing)",
    discipline: "boxing",
    baseMet: 5.8,
    modes: null,
  },
  {
    key: "sparring-muay",
    name: "Sparring (Muay Thai/KB)",
    discipline: "muay_thai",
    baseMet: null,
    modes: [
      { mode: "technical", label: "Technical", baseMet: 5.3 },
      { mode: "medium", label: "Medium", baseMet: 8.5 },
      { mode: "hard", label: "Hard", baseMet: 10.3 },
    ],
  },
  {
    key: "sparring-boxing",
    name: "Sparring (Boxing)",
    discipline: "boxing",
    baseMet: null,
    modes: [
      { mode: "technical", label: "Technical", baseMet: 5.5 },
      { mode: "medium", label: "Medium", baseMet: 7.8 },
      { mode: "hard", label: "Hard", baseMet: 10 },
    ],
  },
  {
    key: "rolling-bjj",
    name: "Rolling (BJJ/No-Gi)",
    discipline: "bjj",
    baseMet: null,
    modes: [
      { mode: "flow", label: "Flow", baseMet: 5.3 },
      { mode: "medium", label: "Medium", baseMet: 7.8 },
      { mode: "hard", label: "Hard", baseMet: 10.3 },
    ],
  },
  {
    key: "drilling-muay",
    name: "Technical Drilling (Muay Thai/KB)",
    discipline: "muay_thai",
    baseMet: 5.3,
    modes: null,
  },
  {
    key: "drilling-boxing",
    name: "Technical Drilling (Boxing)",
    discipline: "boxing",
    baseMet: 5,
    modes: null,
  },
  {
    key: "drilling-bjj",
    name: "Technical Drilling (BJJ/No-Gi)",
    discipline: "bjj",
    baseMet: 5.3,
    modes: null,
  },
];

const byKey = new Map(SKILL_CATALOG.map((activity) => [activity.key, activity]));

export function getSkillActivity(key: string) {
  return byKey.get(key) ?? null;
}

export function activitiesForDiscipline(discipline: SkillDiscipline) {
  return SKILL_CATALOG.filter((activity) => activity.discipline === discipline);
}

export function baseMetFor(key: string, sessionMode: SessionMode | null) {
  const activity = getSkillActivity(key);
  if (!activity) {
    return null;
  }
  if (activity.modes) {
    return activity.modes.find((mode) => mode.mode === sessionMode)?.baseMet ?? null;
  }
  return activity.baseMet;
}

/** Display kcal for 10 work minutes at 75 kg and Moderate RPE. */
export function moderateTenMinuteKcal(baseMet: number) {
  return Math.round((75 * baseMet * 10) / 60);
}
