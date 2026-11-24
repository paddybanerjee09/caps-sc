import Storage from "expo-sqlite/kv-store";

const favouritesKey = "caps.strength.exercise-favourites.v1";
let pendingUpdate: Promise<void> = Promise.resolve();

async function readFavouriteIds(): Promise<string[]> {
  const stored = await Storage.getItemAsync(favouritesKey);
  if (!stored) return [];
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
  } catch {
    return [];
  }
}

export async function listStrengthExerciseFavouriteIds(): Promise<string[]> {
  await pendingUpdate.catch(() => undefined);
  return readFavouriteIds();
}

export function setStrengthExerciseFavourite(exerciseId: string, isFavourite: boolean): Promise<void> {
  // Serialize updates so quick taps on different rows cannot replace each other.
  const next = pendingUpdate.catch(() => undefined).then(async () => {
    const ids = new Set(await readFavouriteIds());
    if (isFavourite) ids.add(exerciseId);
    else ids.delete(exerciseId);
    await Storage.setItemAsync(favouritesKey, JSON.stringify([...ids]));
  });
  pendingUpdate = next;
  return next;
}
