// Metadata columns are reserved for a licensed provider plan. Current writes use
// only the selected exercise name and empty arrays; media URLs have no storage column.
const exerciseColumns = `
  position INTEGER NOT NULL CHECK (typeof(position) = 'integer' AND position BETWEEN 0 AND 99),
  exercise_external_id TEXT NOT NULL CHECK (length(trim(exercise_external_id)) > 0),
  exercise_name TEXT NOT NULL CHECK (length(trim(exercise_name)) BETWEEN 1 AND 120),
  body_parts_json TEXT NOT NULL DEFAULT '[]',
  target_muscles_json TEXT NOT NULL DEFAULT '[]',
  secondary_muscles_json TEXT NOT NULL DEFAULT '[]',
  equipments_json TEXT NOT NULL DEFAULT '[]',
  movement_profile TEXT NOT NULL CHECK (movement_profile IN ('explosive', 'non_explosive', 'unknown')),
  movement_profile_source TEXT NOT NULL CHECK (movement_profile_source IN ('curated-id', 'name-rule', 'unknown')),
  external_load_kg REAL NOT NULL CHECK (external_load_kg BETWEEN 0 AND 2000),
  sets INTEGER NOT NULL CHECK (typeof(sets) = 'integer' AND sets BETWEEN 1 AND 50),
  reps INTEGER NOT NULL CHECK (typeof(reps) = 'integer' AND reps BETWEEN 1 AND 500),
  rpe REAL NOT NULL CHECK (rpe BETWEEN 1 AND 10),
  percent_1rm REAL CHECK (percent_1rm > 0 AND percent_1rm <= 100),
  intensity_source TEXT NOT NULL CHECK (intensity_source IN ('entered', 'estimated', 'unavailable')),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000)
`;

export const strengthMigrationSql = `
  CREATE TABLE strength_session_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (title = trim(title) AND length(title) BETWEEN 1 AND 80),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE strength_template_exercises (
    template_id INTEGER NOT NULL REFERENCES strength_session_templates(id) ON DELETE CASCADE,
    ${exerciseColumns},
    PRIMARY KEY (template_id, position)
  );
  CREATE TABLE strength_logs (
    timeline_entry_id INTEGER PRIMARY KEY NOT NULL REFERENCES timeline_entries(id) ON DELETE CASCADE,
    source_template_id INTEGER REFERENCES strength_session_templates(id) ON DELETE SET NULL
  );
  CREATE TABLE strength_log_exercises (
    timeline_entry_id INTEGER NOT NULL REFERENCES strength_logs(timeline_entry_id) ON DELETE CASCADE,
    ${exerciseColumns},
    PRIMARY KEY (timeline_entry_id, position)
  );
  CREATE TABLE strength_adaptation_scores (
    timeline_entry_id INTEGER PRIMARY KEY NOT NULL REFERENCES strength_logs(timeline_entry_id) ON DELETE CASCADE,
    hypertrophy_score REAL NOT NULL CHECK (hypertrophy_score BETWEEN 0 AND 100),
    power_score REAL NOT NULL CHECK (power_score BETWEEN 0 AND 100),
    endurance_score REAL NOT NULL CHECK (endurance_score BETWEEN 0 AND 100),
    primary_adaptation TEXT NOT NULL CHECK (primary_adaptation IN ('hypertrophy', 'power', 'endurance')),
    evidence_level TEXT NOT NULL CHECK (evidence_level IN ('full', 'limited')),
    scoring_model_version TEXT NOT NULL CHECK (length(trim(scoring_model_version)) BETWEEN 1 AND 50)
  );
  CREATE TABLE strength_exercise_adaptation_scores (
    timeline_entry_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    hard_sets REAL NOT NULL CHECK (hard_sets >= 0),
    total_repetitions INTEGER NOT NULL CHECK (total_repetitions > 0),
    volume_load_kg REAL NOT NULL CHECK (volume_load_kg >= 0),
    percent_1rm_used REAL CHECK (percent_1rm_used > 0 AND percent_1rm_used <= 100),
    hypertrophy_contribution REAL NOT NULL CHECK (hypertrophy_contribution BETWEEN 0 AND 100),
    power_contribution REAL NOT NULL CHECK (power_contribution BETWEEN 0 AND 100),
    endurance_contribution REAL NOT NULL CHECK (endurance_contribution BETWEEN 0 AND 100),
    evidence_level TEXT NOT NULL CHECK (evidence_level IN ('full', 'limited')),
    scoring_model_version TEXT NOT NULL CHECK (length(trim(scoring_model_version)) BETWEEN 1 AND 50),
    PRIMARY KEY (timeline_entry_id, position),
    FOREIGN KEY (timeline_entry_id, position) REFERENCES strength_log_exercises(timeline_entry_id, position) ON DELETE CASCADE
  );
  CREATE INDEX strength_templates_recency ON strength_session_templates(updated_at DESC, id DESC);
  CREATE INDEX strength_logs_source_template ON strength_logs(source_template_id);
  CREATE INDEX strength_adaptation_lookup ON strength_adaptation_scores(primary_adaptation, timeline_entry_id);
  PRAGMA user_version = 10;
`;
