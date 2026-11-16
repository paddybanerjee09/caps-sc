export const skillMigrationSql = `
CREATE TABLE IF NOT EXISTS skill_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS skill_templates_active_title
ON skill_templates (archived_at, title, id);

CREATE TABLE IF NOT EXISTS skill_template_activities (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  activity_key TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  discipline TEXT NOT NULL CHECK (discipline IN ('general', 'muay_thai', 'boxing', 'bjj')),
  timing_mode TEXT NOT NULL CHECK (timing_mode IN ('duration', 'rounds')),
  duration_seconds INTEGER,
  rounds INTEGER,
  seconds_per_round INTEGER,
  rest_between_rounds_seconds INTEGER,
  rpe_band TEXT NOT NULL CHECK (rpe_band IN ('easy', 'moderate', 'hard')),
  session_mode TEXT,
  UNIQUE (template_id, position),
  CHECK (
    (
      timing_mode = 'duration'
      AND duration_seconds > 0
      AND rounds IS NULL
      AND seconds_per_round IS NULL
      AND rest_between_rounds_seconds IS NULL
    )
    OR (
      timing_mode = 'rounds'
      AND duration_seconds IS NULL
      AND rounds > 0
      AND seconds_per_round > 0
      AND rest_between_rounds_seconds >= 0
    )
  ),
  CHECK (session_mode IS NULL OR session_mode IN ('technical', 'medium', 'hard', 'flow')),
  FOREIGN KEY (template_id) REFERENCES skill_templates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skill_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  local_end_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  source_template_id TEXT,
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  focus TEXT NOT NULL CHECK (focus IN ('general', 'muay_thai', 'boxing', 'bjj', 'mixed')),
  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),
  weight_kg REAL NOT NULL CHECK (weight_kg > 0),
  weight_basis TEXT NOT NULL CHECK (weight_basis IN ('logged', 'reference')),
  estimator_version TEXT NOT NULL,
  timeline_entry_id INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  CHECK (started_at <= ended_at),
  FOREIGN KEY (timeline_entry_id) REFERENCES timeline_entries (id)
);

CREATE INDEX IF NOT EXISTS skill_sessions_local_end
ON skill_sessions (local_end_date, ended_at, id);

CREATE TABLE IF NOT EXISTS skill_session_activities (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  activity_key TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  discipline TEXT NOT NULL CHECK (discipline IN ('general', 'muay_thai', 'boxing', 'bjj')),
  timing_mode TEXT NOT NULL CHECK (timing_mode IN ('duration', 'rounds')),
  duration_seconds INTEGER,
  rounds INTEGER,
  seconds_per_round INTEGER,
  rest_between_rounds_seconds INTEGER,
  rpe_band TEXT NOT NULL CHECK (rpe_band IN ('easy', 'moderate', 'hard')),
  session_mode TEXT,
  work_seconds INTEGER NOT NULL CHECK (work_seconds >= 0),
  rest_seconds INTEGER NOT NULL CHECK (rest_seconds >= 0),
  base_met REAL NOT NULL CHECK (base_met > 0),
  rpe_multiplier REAL NOT NULL CHECK (rpe_multiplier > 0),
  energy_kcal REAL NOT NULL CHECK (energy_kcal >= 0),
  UNIQUE (session_id, position),
  CHECK (
    (
      timing_mode = 'duration'
      AND duration_seconds > 0
      AND rounds IS NULL
      AND seconds_per_round IS NULL
      AND rest_between_rounds_seconds IS NULL
    )
    OR (
      timing_mode = 'rounds'
      AND duration_seconds IS NULL
      AND rounds > 0
      AND seconds_per_round > 0
      AND rest_between_rounds_seconds >= 0
    )
  ),
  CHECK (session_mode IS NULL OR session_mode IN ('technical', 'medium', 'hard', 'flow')),
  FOREIGN KEY (session_id) REFERENCES skill_sessions (id) ON DELETE CASCADE
);
`;
