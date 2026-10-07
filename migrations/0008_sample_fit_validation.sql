CREATE TABLE IF NOT EXISTS sample_rounds (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, version_no INTEGER NOT NULL, round_no INTEGER NOT NULL,
  sample_type TEXT NOT NULL DEFAULT 'FIT', status TEXT NOT NULL DEFAULT 'DRAFT', note TEXT,
  spec_snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL, approved_by TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, approved_at TEXT,
  UNIQUE(style_id,round_no)
);
CREATE TABLE IF NOT EXISTS sample_measurements (
  id TEXT PRIMARY KEY, sample_id TEXT NOT NULL, measurement_code TEXT NOT NULL,
  spec_value REAL, actual_value REAL, tolerance_plus REAL, tolerance_minus REAL, delta REAL,
  result TEXT NOT NULL DEFAULT 'PENDING', note TEXT, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(sample_id,measurement_code)
);
CREATE INDEX IF NOT EXISTS idx_sample_rounds_style ON sample_rounds(style_id,version_no,round_no);
CREATE INDEX IF NOT EXISTS idx_sample_measurements_sample ON sample_measurements(sample_id,measurement_code);
INSERT INTO app_meta(key,value) VALUES('schema_version','10') ON CONFLICT(key) DO UPDATE SET value='10';
