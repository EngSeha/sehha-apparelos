-- BATCH 06: release workflow, frozen factory packages and style variants. Additive only.
CREATE TABLE IF NOT EXISTS style_variants (
  id TEXT PRIMARY KEY,
  parent_style_id TEXT NOT NULL,
  child_style_id TEXT NOT NULL UNIQUE,
  variant_kind TEXT NOT NULL,
  label TEXT,
  inherit_mode TEXT NOT NULL DEFAULT 'DEVELOPMENT',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_style_variants_parent ON style_variants(parent_style_id,created_at);

CREATE TABLE IF NOT EXISTS style_releases (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  release_no INTEGER NOT NULL,
  release_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RELEASED',
  source_version_no INTEGER,
  template_key TEXT NOT NULL DEFAULT 'mohsen_nexz_20p',
  gate_json TEXT NOT NULL DEFAULT '{}',
  manifest_json TEXT NOT NULL DEFAULT '{}',
  snapshot_json TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(style_id,release_no)
);
CREATE INDEX IF NOT EXISTS idx_style_releases_style ON style_releases(style_id,release_no DESC);
INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version','7');
