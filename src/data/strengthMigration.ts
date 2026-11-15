export const strengthMigrationSql = `
CREATE TABLE IF NOT EXISTS strength_exercises (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('free_exercise_db', 'custom')),
  source_revision TEXT,
  upstream_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  equipment TEXT NOT NULL CHECK (length(trim(equipment)) BETWEEN 1 AND 40),
  muscle_groups_json TEXT NOT NULL,
  aliases_json TEXT NOT NULL,
  suggests_explosive INTEGER NOT NULL CHECK (suggests_explosive IN (0, 1)),
  default_load_mode TEXT NOT NULL CHECK (
    default_load_mode IN ('external', 'bodyweight', 'assisted')
  ),
  default_unilateral INTEGER NOT NULL CHECK (default_unilateral IN (0, 1)),
  created_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS strength_exercises_upstream
ON strength_exercises (source, upstream_id)
WHERE upstream_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS strength_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);

CREATE INDEX IF NOT EXISTS strength_templates_active_title
ON strength_templates (archived_at, title, id);

CREATE TABLE IF NOT EXISTS strength_template_exercises (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  exercise_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  equipment TEXT NOT NULL,
  muscle_groups_json TEXT NOT NULL,
  load_mode TEXT NOT NULL CHECK (load_mode IN ('external', 'bodyweight', 'assisted')),
  unilateral INTEGER NOT NULL CHECK (unilateral IN (0, 1)),
  explosive_intent INTEGER NOT NULL CHECK (explosive_intent IN (0, 1)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  UNIQUE (template_id, position),
  FOREIGN KEY (template_id) REFERENCES strength_templates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strength_template_sets (
  id TEXT PRIMARY KEY,
  template_exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  load_kg REAL CHECK (load_kg IS NULL OR load_kg >= 0),
  assistance_kg REAL CHECK (assistance_kg IS NULL OR assistance_kg > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  UNIQUE (template_exercise_id, position),
  FOREIGN KEY (template_exercise_id)
    REFERENCES strength_template_exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strength_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  local_end_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  source_template_id TEXT,
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
  emphasis_json TEXT NOT NULL,
  emphasis_version TEXT NOT NULL,
  timeline_entry_id INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  CHECK (started_at <= ended_at),
  FOREIGN KEY (timeline_entry_id) REFERENCES timeline_entries (id)
);

CREATE INDEX IF NOT EXISTS strength_sessions_local_end
ON strength_sessions (local_end_date, ended_at, id);

CREATE TABLE IF NOT EXISTS strength_session_exercises (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  exercise_id TEXT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  equipment TEXT NOT NULL,
  muscle_groups_json TEXT NOT NULL,
  load_mode TEXT NOT NULL CHECK (load_mode IN ('external', 'bodyweight', 'assisted')),
  unilateral INTEGER NOT NULL CHECK (unilateral IN (0, 1)),
  explosive_intent INTEGER NOT NULL CHECK (explosive_intent IN (0, 1)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  UNIQUE (session_id, position),
  FOREIGN KEY (session_id) REFERENCES strength_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strength_session_sets (
  id TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  load_kg REAL CHECK (load_kg IS NULL OR load_kg >= 0),
  assistance_kg REAL CHECK (assistance_kg IS NULL OR assistance_kg > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  rpe REAL CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  rest_seconds INTEGER CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  skipped INTEGER NOT NULL CHECK (skipped IN (0, 1)),
  warmup INTEGER NOT NULL CHECK (warmup IN (0, 1)),
  UNIQUE (session_exercise_id, position),
  FOREIGN KEY (session_exercise_id)
    REFERENCES strength_session_exercises (id) ON DELETE CASCADE
);
`;
