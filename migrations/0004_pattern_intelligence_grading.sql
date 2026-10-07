-- BATCH 05: grading/weight bands, pattern intelligence, image annotations. Additive only.
CREATE TABLE IF NOT EXISTS size_bands (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  band_mode TEXT NOT NULL DEFAULT 'STANDARD',
  min_value REAL,
  max_value REAL,
  unit TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(style_id,code)
);
CREATE INDEX IF NOT EXISTS idx_size_bands_style ON size_bands(style_id,sort_order,code);

CREATE TABLE IF NOT EXISTS grading_rules (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  measurement_code TEXT NOT NULL,
  target_size_code TEXT NOT NULL,
  delta_value REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'cm',
  rule_kind TEXT NOT NULL DEFAULT 'DELTA_FROM_BASE',
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(style_id,measurement_code,target_size_code)
);
CREATE INDEX IF NOT EXISTS idx_grading_rules_style ON grading_rules(style_id,measurement_code,target_size_code);

CREATE TABLE IF NOT EXISTS pattern_links (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  relation TEXT NOT NULL,
  label TEXT,
  label_en TEXT,
  note TEXT,
  note_en TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(style_id,from_code,to_code,relation)
);
CREATE INDEX IF NOT EXISTS idx_pattern_links_style ON pattern_links(style_id,from_code,to_code);

CREATE TABLE IF NOT EXISTS asset_annotations (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'REGION',
  label TEXT NOT NULL,
  label_en TEXT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  w REAL NOT NULL,
  h REAL NOT NULL,
  confidence REAL,
  note TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_annotations_style ON asset_annotations(style_id,asset_id,created_at);

INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version','6');
