-- Preview 21: explicit actual labor + overhead reconciliation
ALTER TABLE production_lots ADD COLUMN full_cost_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE production_lots ADD COLUMN actual_overhead_cost REAL;
CREATE TABLE IF NOT EXISTS production_labor_usage (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL,
  operation_seq INTEGER NOT NULL,
  operation_name TEXT NOT NULL,
  minutes REAL NOT NULL,
  hourly_rate REAL NOT NULL,
  labor_cost REAL NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(lot_id,operation_seq)
);
CREATE INDEX IF NOT EXISTS idx_prod_labor_usage_lot ON production_labor_usage(lot_id,operation_seq);
INSERT INTO app_meta(key,value) VALUES('schema_version','17') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
