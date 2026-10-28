-- WARNING: Clears existing incident data and rebuilds tables for Open/Closed model
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS updates;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS developments;
DROP TABLE IF EXISTS staff;

CREATE TABLE developments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  development_id INTEGER NOT NULL REFERENCES developments(id),
  unit TEXT,
  reporter_name TEXT NOT NULL,
  reporter_contact TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  last_reminder_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'staff',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_incidents_reference ON incidents(reference);
CREATE INDEX idx_incidents_status ON incidents(status);

INSERT INTO developments (name, code, address) VALUES
  ('Koala Cove', 'KC', 'Gold Coast QLD'),
  ('Muir Hill', 'MH', 'Gold Coast QLD'),
  ('Surfers Riverside', 'SR', 'Gold Coast QLD');

INSERT INTO staff (username, password_hash, display_name) VALUES
  ('admin', 'goldcoast2026', 'Elite Resort Care');
