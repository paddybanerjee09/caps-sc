export const conditioningMigrationSql = `
CREATE TABLE IF NOT EXISTS conditioning_owner (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  id TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS conditioning_templates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  format TEXT NOT NULL CHECK (format IN ('time_interval', 'sprint', 'circuit')),
  config_json TEXT NOT NULL,
  config_version INTEGER NOT NULL CHECK (config_version > 0),
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY (owner_id) REFERENCES conditioning_owner (id)
);

CREATE INDEX IF NOT EXISTS conditioning_templates_owner_sort
ON conditioning_templates (owner_id, last_used_at, updated_at, id);

CREATE TABLE IF NOT EXISTS conditioning_template_stations (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  exercise_name TEXT NOT NULL CHECK (length(trim(exercise_name)) BETWEEN 1 AND 80),
  completion_type TEXT NOT NULL CHECK (
    completion_type IN ('time', 'repetitions', 'distance', 'machine_calories', 'manual')
  ),
  target_json TEXT NOT NULL,
  recovery_seconds INTEGER NOT NULL CHECK (recovery_seconds >= 0),
  target_rpe INTEGER CHECK (target_rpe IS NULL OR (target_rpe BETWEEN 1 AND 10)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  UNIQUE (template_id, position),
  FOREIGN KEY (template_id) REFERENCES conditioning_templates (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  template_id TEXT,
  started_from_plan INTEGER NOT NULL DEFAULT 0 CHECK (started_from_plan IN (0, 1)),
  timeline_entry_id INTEGER,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 80),
  format TEXT NOT NULL CHECK (format IN ('time_interval', 'sprint', 'circuit', 'free')),
  activity_type TEXT CHECK (activity_type IS NULL OR activity_type IN ('run', 'bike')),
  status TEXT NOT NULL CHECK (
    status IN (
      'planned',
      'in_progress',
      'finished_draft',
      'completed',
      'ended_early',
      'cancelled'
    )
  ),
  sync_status TEXT NOT NULL CHECK (
    sync_status IN ('local_only', 'pending', 'uploading', 'synced', 'failed')
  ),
  snapshot_json TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version > 0),
  scheduled_local_date TEXT CHECK (
    scheduled_local_date IS NULL
    OR scheduled_local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  scheduling_timezone TEXT,
  scheduled_local_start_time TEXT CHECK (
    scheduled_local_start_time IS NULL
    OR scheduled_local_start_time GLOB '[0-9][0-9]:[0-9][0-9]'
  ),
  performed_at INTEGER,
  finished_at INTEGER,
  performed_local_date TEXT,
  performed_timezone TEXT,
  active_seconds REAL CHECK (active_seconds IS NULL OR active_seconds >= 0),
  elapsed_seconds REAL CHECK (elapsed_seconds IS NULL OR elapsed_seconds >= 0),
  distance_meters REAL CHECK (distance_meters IS NULL OR distance_meters >= 0),
  elevation_gain_meters REAL,
  elevation_loss_meters REAL,
  target_rpe INTEGER CHECK (target_rpe IS NULL OR (target_rpe BETWEEN 1 AND 10)),
  session_rpe INTEGER CHECK (session_rpe IS NULL OR (session_rpe BETWEEN 1 AND 10)),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  source TEXT NOT NULL CHECK (source IN ('live', 'manual')),
  gps_processing_version TEXT,
  elevation_processing_version TEXT,
  emphasis_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES conditioning_owner (id),
  FOREIGN KEY (template_id) REFERENCES conditioning_templates (id) ON DELETE SET NULL,
  FOREIGN KEY (timeline_entry_id) REFERENCES timeline_entries (id) ON DELETE SET NULL,
  CHECK (format != 'free' OR activity_type IS NOT NULL),
  CHECK (performed_at IS NULL OR finished_at IS NULL OR finished_at >= performed_at)
);

CREATE INDEX IF NOT EXISTS conditioning_sessions_owner_scheduled
ON conditioning_sessions (owner_id, scheduled_local_date);

CREATE INDEX IF NOT EXISTS conditioning_sessions_owner_performed
ON conditioning_sessions (owner_id, performed_local_date);

CREATE INDEX IF NOT EXISTS conditioning_sessions_owner_status
ON conditioning_sessions (owner_id, status);

CREATE TABLE IF NOT EXISTS conditioning_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  break_reason TEXT,
  UNIQUE (session_id, sequence),
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_location_points (
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  segment_id TEXT,
  recorded_at INTEGER NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  horizontal_accuracy REAL,
  altitude REAL,
  altitude_accuracy REAL,
  acceptance TEXT NOT NULL CHECK (acceptance IN ('accepted', 'rejected')),
  rejection_reason TEXT,
  distance_delta_meters REAL NOT NULL DEFAULT 0 CHECK (distance_delta_meters >= 0),
  PRIMARY KEY (session_id, sequence),
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_occurrences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  station_id TEXT,
  round_index INTEGER,
  set_index INTEGER,
  phase_type TEXT NOT NULL,
  target_json TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  work_seconds REAL CHECK (work_seconds IS NULL OR work_seconds >= 0),
  completion_method TEXT,
  completion_status TEXT NOT NULL CHECK (
    completion_status IN ('pending', 'completed', 'partial')
  ),
  actual_json TEXT,
  UNIQUE (session_id, position),
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_splits (
  session_id TEXT NOT NULL,
  unit_system TEXT NOT NULL CHECK (unit_system IN ('kilometer', 'mile')),
  ordinal INTEGER NOT NULL CHECK (ordinal > 0),
  distance_meters REAL NOT NULL CHECK (distance_meters >= 0),
  active_seconds REAL NOT NULL CHECK (active_seconds >= 0),
  partial INTEGER NOT NULL CHECK (partial IN (0, 1)),
  complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
  PRIMARY KEY (session_id, unit_system, ordinal),
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_upload_jobs (
  session_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'uploading', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  acknowledged_point_sequence INTEGER NOT NULL DEFAULT 0
    CHECK (acknowledged_point_sequence >= 0),
  acknowledged_occurrence_count INTEGER NOT NULL DEFAULT 0
    CHECK (acknowledged_occurrence_count >= 0),
  acknowledged_split_count INTEGER NOT NULL DEFAULT 0
    CHECK (acknowledged_split_count >= 0),
  expected_point_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_point_count >= 0),
  expected_occurrence_count INTEGER NOT NULL DEFAULT 0
    CHECK (expected_occurrence_count >= 0),
  expected_split_count INTEGER NOT NULL DEFAULT 0 CHECK (expected_split_count >= 0),
  last_error TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conditioning_runner_state (
  session_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES conditioning_sessions (id) ON DELETE CASCADE
);
`;
