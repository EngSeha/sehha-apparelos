-- BATCH 04: bilingual technical data + colorways + richer pattern metadata. Additive only.
ALTER TABLE measurements ADD COLUMN name_en TEXT;
ALTER TABLE measurements ADD COLUMN method_en TEXT;
ALTER TABLE bom_items ADD COLUMN name_en TEXT;
ALTER TABLE bom_items ADD COLUMN specification_en TEXT;
ALTER TABLE operations ADD COLUMN name_en TEXT;
ALTER TABLE operations ADD COLUMN description_en TEXT;
ALTER TABLE operations ADD COLUMN qc_point_en TEXT;
ALTER TABLE pattern_pieces ADD COLUMN name_en TEXT;
ALTER TABLE pattern_pieces ADD COLUMN note_en TEXT;
ALTER TABLE pattern_pieces ADD COLUMN mirror INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pattern_pieces ADD COLUMN on_fold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pattern_pieces ADD COLUMN grainline TEXT;

CREATE TABLE IF NOT EXISTS colorways (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  main_color TEXT,
  accent_color TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(style_id,code)
);
CREATE INDEX IF NOT EXISTS idx_colorways_style ON colorways(style_id,sort_order,code);
INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version','5');
