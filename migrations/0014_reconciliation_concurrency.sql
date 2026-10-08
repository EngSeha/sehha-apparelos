-- Preview 17: production reconciliation + optimistic lot versioning
ALTER TABLE production_lots ADD COLUMN row_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE production_lots ADD COLUMN reconciliation_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE production_lots ADD COLUMN actual_output_qty INTEGER;
CREATE TABLE IF NOT EXISTS production_material_usage (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, material_key TEXT NOT NULL, source_ref TEXT, description TEXT NOT NULL, unit TEXT NOT NULL,
  planned_gross_qty REAL, actual_qty REAL, scrap_qty REAL NOT NULL DEFAULT 0, note TEXT, created_by TEXT NOT NULL, updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(lot_id,material_key)
);
CREATE INDEX IF NOT EXISTS idx_prod_material_usage_lot ON production_material_usage(lot_id,material_key);
INSERT INTO app_meta(key,value) VALUES('schema_version','16') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
