-- Reset passwords and ensure core accounts exist
-- Run AFTER migrate-roles.sql (or after columns role/email exist)

INSERT OR IGNORE INTO staff (username, password_hash, display_name) VALUES
  ('admin', 'RBS@rbs1', 'RBS Helpdesk');

UPDATE staff SET password_hash = 'RBS@rbs1', display_name = COALESCE(NULLIF(display_name, ''), 'RBS Helpdesk')
WHERE username = 'admin';

INSERT OR IGNORE INTO staff (username, password_hash, display_name) VALUES
  ('stevew', 'RBS@steve1', 'Steve W');

UPDATE staff SET password_hash = 'RBS@steve1', display_name = 'Steve W'
WHERE username = 'stevew';

INSERT OR IGNORE INTO staff (username, password_hash, display_name) VALUES
  ('captain', 'RBS@captain1', 'Captain'),
  ('cameron', 'RBS@cameron1', 'Cameron');

UPDATE staff SET password_hash = 'RBS@captain1', display_name = 'Captain' WHERE username = 'captain';
UPDATE staff SET password_hash = 'RBS@cameron1', display_name = 'Cameron' WHERE username = 'cameron';
