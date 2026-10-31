-- Migration: roles, assignment, expanded statuses
PRAGMA foreign_keys = OFF;

ALTER TABLE incidents ADD COLUMN assigned_to TEXT;
ALTER TABLE staff ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE staff ADD COLUMN email TEXT;

UPDATE staff SET role = 'admin', email = 'helpdesk@requirebuilding.com.au' WHERE username = 'admin';

INSERT OR IGNORE INTO staff (username, password_hash, display_name, role, email) VALUES
  ('captain', 'RBS@captain1', 'Captain', 'contractor', NULL),
  ('cameron', 'RBS@cameron1', 'Cameron', 'contractor', NULL),
  ('stevew', 'RBS@steve1', 'Steve W', 'contractor', NULL);

PRAGMA foreign_keys = ON;
