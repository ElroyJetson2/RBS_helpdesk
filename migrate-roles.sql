-- Migration: roles, assignment, expanded statuses
-- Safe-ish: if a column already exists, that line will error – skip and continue with the rest

PRAGMA foreign_keys = OFF;

-- Add assigned_to if missing (ignore error if already exists)
-- ALTER TABLE incidents ADD COLUMN assigned_to TEXT;

-- Add role/email if missing (ignore error if already exists)
-- ALTER TABLE staff ADD COLUMN role TEXT DEFAULT 'admin';
-- ALTER TABLE staff ADD COLUMN email TEXT;

-- Prefer running the individual commands below via wrangler --command if ALTER fails mid-file

UPDATE staff SET role = 'admin', email = 'helpdesk@requirebuilding.com.au' WHERE username = 'admin';
UPDATE staff SET role = 'admin' WHERE username = 'stevew';
UPDATE staff SET role = 'contractor' WHERE username IN ('captain', 'cameron');

INSERT OR IGNORE INTO staff (username, password_hash, display_name, role, email) VALUES
  ('admin', 'RBS@rbs1', 'RBS Helpdesk', 'admin', 'helpdesk@requirebuilding.com.au');

INSERT OR IGNORE INTO staff (username, password_hash, display_name, role, email) VALUES
  ('captain', 'RBS@captain1', 'Captain', 'contractor', NULL),
  ('cameron', 'RBS@cameron1', 'Cameron', 'contractor', NULL),
  ('stevew', 'RBS@steve1', 'Steve W', 'admin', NULL);

UPDATE staff SET password_hash = 'RBS@rbs1' WHERE username = 'admin';
UPDATE staff SET password_hash = 'RBS@steve1', role = 'admin', display_name = 'Steve W' WHERE username = 'stevew';
UPDATE staff SET password_hash = 'RBS@captain1', role = 'contractor' WHERE username = 'captain';
UPDATE staff SET password_hash = 'RBS@cameron1', role = 'contractor' WHERE username = 'cameron';

PRAGMA foreign_keys = ON;
