export const trainingIndexMigrationSql = `
CREATE TABLE IF NOT EXISTS training_day_confirmations (
  local_date TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('rest','complete')),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_session_loads (
  timeline_entry_id INTEGER PRIMARY KEY REFERENCES timeline_entries(id) ON DELETE CASCADE,
  minutes REAL NOT NULL CHECK (minutes > 0 AND minutes <= 10080),
  session_rpe REAL NOT NULL CHECK (session_rpe BETWEEN 0 AND 10)
);
CREATE TABLE IF NOT EXISTS recovery_sleep_targets (
  effective_date TEXT PRIMARY KEY,
  hours REAL CHECK (hours > 0 AND hours <= 24)
);
CREATE TABLE IF NOT EXISTS training_output_tests (
  observed_at INTEGER NOT NULL,
  comparison_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('higher','elapsed-time')),
  output REAL NOT NULL CHECK (output >= 0),
  PRIMARY KEY (observed_at, comparison_key, direction)
);
`;
