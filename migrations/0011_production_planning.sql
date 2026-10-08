-- Preview 14: production size/color allocation planning
CREATE TABLE IF NOT EXISTS production_lot_breakdown (
  id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, colorway_code TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  size_code TEXT NOT NULL DEFAULT 'UNSPECIFIED', qty INTEGER NOT NULL, note TEXT,
  created_by TEXT NOT NULL, updated_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(lot_id,colorway_code,size_code)
);
CREATE INDEX IF NOT EXISTS idx_lot_breakdown_lot ON production_lot_breakdown(lot_id,colorway_code,size_code);
INSERT INTO app_meta(key,value) VALUES('schema_version','13') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
