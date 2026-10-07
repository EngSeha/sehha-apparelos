CREATE TABLE IF NOT EXISTS cost_sheets (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, version_no INTEGER, name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP', status TEXT NOT NULL DEFAULT 'DRAFT',
  labor_cost REAL, overhead_pct REAL, waste_pct REAL, note TEXT,
  created_by TEXT NOT NULL, approved_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT
);
CREATE TABLE IF NOT EXISTS cost_lines (
  id TEXT PRIMARY KEY, cost_sheet_id TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'MANUAL', source_ref TEXT,
  description TEXT NOT NULL, qty REAL, unit TEXT, unit_cost REAL, waste_pct REAL, line_total REAL, note TEXT,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cost_sheets_style ON cost_sheets(style_id,version_no,status);
CREATE INDEX IF NOT EXISTS idx_cost_lines_sheet ON cost_lines(cost_sheet_id);
INSERT INTO app_meta(key,value) VALUES('schema_version','11') ON CONFLICT(key) DO UPDATE SET value='11';
