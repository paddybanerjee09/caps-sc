import type { SQLiteDatabase } from "expo-sqlite";

export type DistanceUnit = "metric" | "imperial";

type AthletePreferencesRow = {
  distance_unit: DistanceUnit;
};

export async function getDistanceUnit(
  db: SQLiteDatabase,
): Promise<DistanceUnit> {
  const row = await db.getFirstAsync<AthletePreferencesRow>(`
    SELECT distance_unit
    FROM athlete_preferences
    WHERE id = 1
  `);

  return row?.distance_unit === "imperial" ? "imperial" : "metric";
}

export async function saveDistanceUnit(
  db: SQLiteDatabase,
  distanceUnit: DistanceUnit,
) {
  await db.runAsync(
    `
      INSERT INTO athlete_preferences (id, distance_unit)
      VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET
        distance_unit = excluded.distance_unit
    `,
    distanceUnit,
  );
}
