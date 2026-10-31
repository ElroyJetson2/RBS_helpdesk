-- RBS Helpdesk – Incident Tracking
-- Statuses: open | assigned | in_progress | customer_sign_off | closed
-- Roles: admin | viewer | contractor

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS developments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  address TEXT,
  place_id TEXT,
  formatted_address TEXT,
  lat REAL,
  lng REAL,
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
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to TEXT,
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
  role TEXT NOT NULL DEFAULT 'admin',
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_reference ON incidents(reference);
CREATE INDEX IF NOT EXISTS idx_incidents_development ON incidents(development_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_incident ON updates(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_photos_incident ON photos(incident_id);

INSERT OR IGNORE INTO staff (username, password_hash, display_name, role, email) VALUES
  ('admin', 'RBS@rbs1', 'RBS Helpdesk', 'admin', 'helpdesk@requirebuilding.com.au');

INSERT OR IGNORE INTO staff (username, password_hash, display_name, role, email) VALUES
  ('captain', 'RBS@captain1', 'Captain', 'contractor', NULL),
  ('cameron', 'RBS@cameron1', 'Cameron', 'contractor', NULL),
  ('stevew', 'RBS@steve1', 'Steve W', 'contractor', NULL);
