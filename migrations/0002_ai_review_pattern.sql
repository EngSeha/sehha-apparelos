CREATE TABLE IF NOT EXISTS pattern_pieces (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  qty REAL,
  note TEXT,
  provenance TEXT NOT NULL DEFAULT 'AI_INFERRED',
  state TEXT NOT NULL DEFAULT 'AI_DRAFT',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(style_id,code)
);
CREATE INDEX IF NOT EXISTS idx_pattern_pieces_style ON pattern_pieces(style_id,sort_order,code);
INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version','4');
