-- Elite Resort Care – Incident Tracking
-- Statuses: open | closed only
-- Properties: Koala Cove, Muir Hill, Surfers Riverside

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS developments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  development_id INTEGER NOT NULL REFERENCES developments(id),
  unit TEXT,
  reporter_name TEXT NOT NULL,
  reporter_contact TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed')),
  last_reminder_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_reference ON incidents(reference);
CREATE INDEX IF NOT EXISTS idx_incidents_development ON incidents(development_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_incident ON updates(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_photos_incident ON photos(incident_id);

INSERT OR IGNORE INTO developments (name, code, address) VALUES
  ('Koala Cove', 'KC', 'Gold Coast QLD'),
  ('Muir Hill', 'MH', 'Gold Coast QLD'),
  ('Surfers Riverside', 'SR', 'Gold Coast QLD');

INSERT OR IGNORE INTO staff (username, password_hash, display_name) VALUES
  ('admin', 'goldcoast2026', 'Elite Resort Care');
