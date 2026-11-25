import type { SQLiteDatabase } from "expo-sqlite";

const previousColumns = "position, activity_key, name, discipline, timing_mode, duration_seconds, rounds, seconds_per_round, rest_between_rounds_seconds, rpe_band, session_mode";
const performedColumns = ", work_seconds, rest_seconds, base_met, rpe_multiplier, energy_kcal";

function migrateActivities(parent: "template" | "session") {
  const table = "skill_" + parent + "_activities";
  const temporary = table + "_v11";
  const performed = parent === "session" ? `
    work_seconds INTEGER NOT NULL CHECK (work_seconds >= 0),
    rest_seconds INTEGER NOT NULL CHECK (rest_seconds >= 0),
    base_met REAL NOT NULL CHECK (base_met > 0),
    rpe_multiplier REAL NOT NULL CHECK (rpe_multiplier > 0),
    energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),` : "";
  const copied = "id, " + parent + "_id, " + previousColumns + (parent === "session" ? performedColumns : "");
  return `
CREATE TABLE ${temporary} (
  id TEXT PRIMARY KEY,
  ${parent}_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  activity_key TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  discipline TEXT NOT NULL CHECK (discipline IN ('general', 'muay_thai', 'boxing', 'bjj')),
  timing_mode TEXT NOT NULL CHECK (timing_mode IN ('duration', 'rounds', 'reps')),
  duration_seconds INTEGER,
  rounds INTEGER,
  seconds_per_round INTEGER,
  rest_between_rounds_seconds INTEGER,
  rpe_band TEXT NOT NULL CHECK (rpe_band IN ('easy', 'moderate', 'hard')),
  session_mode TEXT CHECK (session_mode IS NULL OR session_mode IN ('technical', 'medium', 'hard', 'flow')),
  sets INTEGER,
  reps INTEGER,
  rpe INTEGER CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  rest_between_sets_seconds INTEGER,
  ${performed}
  UNIQUE (${parent}_id, position),
  CHECK (
    (timing_mode = 'duration' AND duration_seconds IS NOT NULL AND duration_seconds > 0
      AND rounds IS NULL AND seconds_per_round IS NULL AND rest_between_rounds_seconds IS NULL
      AND sets IS NULL AND reps IS NULL AND rest_between_sets_seconds IS NULL)
    OR (timing_mode = 'rounds' AND duration_seconds IS NULL
      AND rounds IS NOT NULL AND seconds_per_round IS NOT NULL AND rest_between_rounds_seconds IS NOT NULL
      AND rounds > 0 AND seconds_per_round > 0 AND rest_between_rounds_seconds >= 0
      AND sets IS NULL AND reps IS NULL AND rest_between_sets_seconds IS NULL)
    OR (timing_mode = 'reps' AND duration_seconds IS NULL
      AND rounds IS NULL AND seconds_per_round IS NULL AND rest_between_rounds_seconds IS NULL
      AND sets IS NOT NULL AND reps IS NOT NULL AND sets BETWEEN 1 AND 20 AND reps BETWEEN 1 AND 100
      AND (rest_between_sets_seconds IS NULL OR rest_between_sets_seconds BETWEEN 0 AND 600))
  ),
  FOREIGN KEY (${parent}_id) REFERENCES skill_${parent}s (id) ON DELETE CASCADE
);
INSERT INTO ${temporary} (${copied}) SELECT ${copied} FROM ${table};
DROP TABLE ${table};
ALTER TABLE ${temporary} RENAME TO ${table};
`;
}

/** Child rows retain their identities and all stored estimates; parent tables are untouched. */
export async function applySkillRepsMigration(db: SQLiteDatabase) {
  const upgrades: string[] = [];
  for (const parent of ["template", "session"] as const) {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(skill_" + parent + "_activities)");
    if (!columns.some((column) => column.name === "sets")) upgrades.push(migrateActivities(parent));
  }
  if (upgrades.length === 0) return;
  await db.withTransactionAsync(async () => { await db.execAsync(upgrades.join("\n")); });
}
