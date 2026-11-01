-- Contractor profiles for RBS Helpdesk
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT NOT NULL,
  trading_name TEXT,
  abn TEXT,
  address TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  licence_type TEXT,
  licence_number TEXT,
  licence_expiry TEXT,
  insurance_provider TEXT,
  insurance_policy TEXT,
  insurance_expiry TEXT,
  bank_account_name TEXT,
  bank_bsb TEXT,
  bank_account_number TEXT,
  notes TEXT,
  staff_username TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contractor_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  file_name TEXT,
  data_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contractors_active ON contractors(active);
CREATE INDEX IF NOT EXISTS idx_contractors_name ON contractors(business_name);
CREATE INDEX IF NOT EXISTS idx_contractor_docs ON contractor_documents(contractor_id);

PRAGMA foreign_keys = ON;
