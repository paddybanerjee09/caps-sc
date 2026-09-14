import type { MovementProfile, MovementProfileSource } from "../types/strength";

// Add only manually verified stable provider IDs; no guessed IDs.
export const curatedMovementProfiles: Readonly<Record<string, MovementProfile>> = {};
// Word boundaries avoid matches such as "cleaning". Anatomy/equipment alone never imply intent.
const explosiveName = /\b(clean|snatch|jerk|throw|slam|jump|plyometric)\b|\bkettlebell swing\b/i;
const nonExplosiveName = /\b(bench press|biceps curl|leg extension|leg curl|calf raise)\b/i;
export function getStrengthMovementProfile(exerciseId: string, name: string,
  curated: Readonly<Record<string, MovementProfile>> = curatedMovementProfiles,
): { movementProfile: MovementProfile; movementProfileSource: MovementProfileSource } {
  if (Object.prototype.hasOwnProperty.call(curated, exerciseId)) {
    return { movementProfile: curated[exerciseId], movementProfileSource: "curated-id" };
  }
  if (explosiveName.test(name)) return { movementProfile: "explosive", movementProfileSource: "name-rule" };
  if (nonExplosiveName.test(name)) return { movementProfile: "non_explosive", movementProfileSource: "name-rule" };
  return { movementProfile: "unknown", movementProfileSource: "unknown" };
}

// Conservative whitelist: do not estimate 1RM for holds, carries, throws, jumps, or ambiguous labels.
export function isWeightedDynamicLabel(name: string) {
  return !/\b(hold|isometric|carry|throw|slam|jump|plank|assisted)\b/i.test(name) &&
    /\b(squat|press|deadlift|row|curl|extension|raise|clean|snatch|jerk)\b/i.test(name);
}
