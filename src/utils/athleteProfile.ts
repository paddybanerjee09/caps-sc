import type { AthleteProfile, CombatSport } from "../state/AppStateContext";
import { isValidBirthDate } from "./biometrics";

export type AthleteProfilePatch = Partial<Omit<AthleteProfile, "weightKg">>;
export const combatSports: CombatSport[] = ["Muay Thai", "Kickboxing", "Boxing", "MMA", "BJJ (Gi)", "BJJ (No-Gi)", "Wrestling", "Judo", "Jiu-Jitsu", "Karate"];

/** Validate saved settings and keep history-owned weight outside the profile. */
export function deserializeAthleteProfile(stored: string, today = new Date()): AthleteProfilePatch {
  const value: unknown = JSON.parse(stored);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved athlete profile");
  const profile = value as AthleteProfilePatch;
  return {
    ...(typeof profile.firstName === "string" ? { firstName: profile.firstName } : {}),
    ...(typeof profile.lastName === "string" ? { lastName: profile.lastName } : {}),
    ...(profile.age === null || (typeof profile.age === "number" && Number.isInteger(profile.age) && profile.age >= 0 && profile.age <= 120) ? { age: profile.age } : {}),
    ...(profile.dateOfBirth === null || (typeof profile.dateOfBirth === "string" && isValidBirthDate(profile.dateOfBirth, today)) ? { dateOfBirth: profile.dateOfBirth } : {}),
    ...(profile.sex === "Male" || profile.sex === "Female" || profile.sex === null ? { sex: profile.sex } : {}),
    ...(profile.heightCm === null || (typeof profile.heightCm === "number" && Number.isFinite(profile.heightCm) && profile.heightCm >= 60 && profile.heightCm <= 275) ? { heightCm: profile.heightCm } : {}),
    ...(Array.isArray(profile.sports) ? { sports: profile.sports.filter((sport): sport is CombatSport => combatSports.includes(sport)) } : {}),
  };
}

export function serializeAthleteProfile(profile: AthleteProfile) {
  return JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName, age: profile.age, dateOfBirth: profile.dateOfBirth, sex: profile.sex, heightCm: profile.heightCm, sports: profile.sports });
}
