import { appColorPalette } from "../theme/theme";
import type { SkillDiscipline, SkillFocus } from "./types";

export const FOCUS_PRESENTATION: Record<
  SkillFocus,
  { color: string; label: string }
> = {
  muay_thai: {
    color: appColorPalette.orange,
    label: "Muay Thai / Kickboxing",
  },
  boxing: {
    color: appColorPalette.blue,
    label: "Boxing",
  },
  bjj: {
    color: appColorPalette.purple,
    label: "Brazilian Jiu-Jitsu / No-Gi",
  },
  mixed: {
    color: appColorPalette.pink,
    label: "Mixed Martial Arts Focus",
  },
  general: {
    color: appColorPalette.turquoise,
    label: "General Skill Work",
  },
};

export function focusFromDisciplines(
  disciplines: readonly SkillDiscipline[],
): SkillFocus | null {
  if (disciplines.length === 0) {
    return null;
  }
  const combat = new Set(disciplines.filter((discipline) => discipline !== "general"));
  if (combat.size === 0) {
    return "general";
  }
  if (combat.size === 1) {
    return [...combat][0] ?? "general";
  }
  return "mixed";
}
