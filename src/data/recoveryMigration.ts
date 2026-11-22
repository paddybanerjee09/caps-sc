export const recoveryMigrationSql = `
CREATE TABLE IF NOT EXISTS recovery_owner (
  id TEXT PRIMARY KEY CHECK (id = 'device-local')
);
INSERT OR IGNORE INTO recovery_owner (id) VALUES ('device-local');

CREATE TABLE IF NOT EXISTS daily_questionnaires (
  owner_id TEXT NOT NULL REFERENCES recovery_owner(id),
  local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not_started','in_progress','completed')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  completed_at TEXT,
  response_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, local_date)
);
CREATE TABLE IF NOT EXISTS questionnaire_revisions (
  owner_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  response_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, local_date, revision),
  FOREIGN KEY (owner_id,local_date) REFERENCES daily_questionnaires(owner_id,local_date) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS health_measurements (
  owner_id TEXT NOT NULL REFERENCES recovery_owner(id),
  platform TEXT NOT NULL CHECK (platform IN ('healthkit','health_connect')),
  external_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  local_date TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  measurement_json TEXT NOT NULL,
  PRIMARY KEY (owner_id, platform, external_id, metric)
);
CREATE INDEX IF NOT EXISTS health_measurements_owner_date ON health_measurements(owner_id,local_date,measured_at);
CREATE TABLE IF NOT EXISTS recovery_snapshots (
  owner_id TEXT NOT NULL REFERENCES recovery_owner(id),
  local_date TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  PRIMARY KEY (owner_id,local_date)
);
CREATE TABLE IF NOT EXISTS metric_baselines (
  owner_id TEXT NOT NULL REFERENCES recovery_owner(id),
  local_date TEXT NOT NULL,
  comparable_key TEXT NOT NULL,
  baseline_json TEXT NOT NULL,
  PRIMARY KEY (owner_id,local_date,comparable_key)
);
CREATE TABLE IF NOT EXISTS health_connections (
  owner_id TEXT NOT NULL REFERENCES recovery_owner(id),
  platform TEXT NOT NULL CHECK (platform IN ('healthkit','health_connect')),
  state_json TEXT NOT NULL,
  PRIMARY KEY (owner_id,platform)
);
CREATE TABLE IF NOT EXISTS recovery_preferences (
  owner_id TEXT PRIMARY KEY REFERENCES recovery_owner(id),
  preferred_sources_json TEXT NOT NULL DEFAULT '{}'
);
`;
