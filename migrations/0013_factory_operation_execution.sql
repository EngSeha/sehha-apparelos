-- Preview 16: lot operation execution progress
CREATE TABLE IF NOT EXISTS production_operation_progress (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, operation_seq INTEGER NOT NULL, operation_name TEXT NOT NULL,
  machine TEXT, stitch TEXT, planned_qty INTEGER, completed_qty INTEGER NOT NULL DEFAULT 0, rejected_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED', note TEXT, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(lot_id,operation_seq)
);
CREATE INDEX IF NOT EXISTS idx_prod_op_progress_lot ON production_operation_progress(lot_id,operation_seq);
INSERT INTO app_meta(key,value) VALUES('schema_version','15') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
