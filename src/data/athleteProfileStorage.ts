import Storage from "expo-sqlite/kv-store";

import type { AthleteProfile } from "../state/AppStateContext";
import { deserializeAthleteProfile, serializeAthleteProfile, type AthleteProfilePatch } from "../utils/athleteProfile";
export type { AthleteProfilePatch } from "../utils/athleteProfile";

// The profile has no relational row in the existing schema. Keep its settings in
// SQLite's bundled key-value store; bodyweight remains owned by weight_logs.
const profileKey = "caps.athlete-profile.v1";

export async function loadAthleteProfile(): Promise<AthleteProfilePatch | null> {
  const stored = await Storage.getItemAsync(profileKey);
  if (!stored) return null;
  return deserializeAthleteProfile(stored);
}

export async function storeAthleteProfile(profile: AthleteProfile) {
  await Storage.setItemAsync(profileKey, serializeAthleteProfile(profile));
}
