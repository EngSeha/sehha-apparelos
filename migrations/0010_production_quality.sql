CREATE TABLE IF NOT EXISTS production_lots (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, release_no INTEGER NOT NULL, lot_code TEXT NOT NULL,
  planned_qty INTEGER, status TEXT NOT NULL DEFAULT 'OPEN', note TEXT,
  created_by TEXT NOT NULL, released_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, released_at TEXT,
  UNIQUE(style_id,lot_code)
);
CREATE TABLE IF NOT EXISTS quality_checks (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, check_type TEXT NOT NULL, reference_code TEXT,
  sample_size INTEGER, defect_count INTEGER, status TEXT NOT NULL DEFAULT 'OPEN', note TEXT,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS production_defects (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, code TEXT NOT NULL, title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MAJOR', qty INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'OPEN',
  root_cause TEXT, corrective_action TEXT, note TEXT, created_by TEXT NOT NULL, resolved_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_production_lots_style ON production_lots(style_id,release_no,status);
CREATE INDEX IF NOT EXISTS idx_quality_checks_lot ON quality_checks(lot_id,status);
CREATE INDEX IF NOT EXISTS idx_production_defects_lot ON production_defects(lot_id,severity,status);
INSERT INTO app_meta(key,value) VALUES('schema_version','12') ON CONFLICT(key) DO UPDATE SET value='12';
