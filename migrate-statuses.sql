-- Rebuild incidents table: allow full status list + assigned_to
-- PRESERVES all existing jobs

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS incidents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  development_id INTEGER NOT NULL,
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

INSERT INTO incidents_new (
  id, reference, development_id, unit, reporter_name, reporter_contact,
  description, status, assigned_to, last_reminder_at, created_at, updated_at
)
SELECT
  id, reference, development_id, unit, reporter_name, reporter_contact,
  description, status,
  NULL,
  last_reminder_at, created_at, updated_at
FROM incidents;

DROP TABLE incidents;
ALTER TABLE incidents_new RENAME TO incidents;

CREATE INDEX IF NOT EXISTS idx_incidents_reference ON incidents(reference);
CREATE INDEX IF NOT EXISTS idx_incidents_development ON incidents(development_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);

PRAGMA foreign_keys = ON;
