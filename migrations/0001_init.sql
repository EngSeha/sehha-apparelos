CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  brand_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
  is_platform_admin INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL, org_id TEXT NOT NULL, role TEXT NOT NULL,
  PRIMARY KEY(user_id,org_id)
);
CREATE TABLE IF NOT EXISTS styles (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
  garment_type TEXT NOT NULL DEFAULT 'CUSTOM', audience TEXT NOT NULL DEFAULT 'UNSPECIFIED',
  sizing_mode TEXT NOT NULL DEFAULT 'STANDARD', base_size TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
  hero_asset_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(org_id,code)
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, role TEXT NOT NULL, filename TEXT NOT NULL,
  stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, source_kind TEXT NOT NULL DEFAULT 'USER_UPLOAD',
  rights_status TEXT NOT NULL DEFAULT 'USER_ASSERTED', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dna_items (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, field_key TEXT NOT NULL, field_label TEXT NOT NULL,
  value_text TEXT, provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', confidence REAL,
  state TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(style_id,field_key)
);
CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
  value REAL, unit TEXT NOT NULL DEFAULT 'cm', method TEXT,
  tolerance_plus REAL, tolerance_minus REAL, provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
  state TEXT NOT NULL DEFAULT 'DRAFT', sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS bom_items (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, code TEXT NOT NULL, category TEXT NOT NULL,
  name TEXT NOT NULL, specification TEXT, qty REAL, unit TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(style_id,code)
);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, seq INTEGER NOT NULL, name TEXT NOT NULL,
  description TEXT, machine TEXT, stitch TEXT, qc_point TEXT,
  provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED', state TEXT NOT NULL DEFAULT 'DRAFT',
  UNIQUE(style_id,seq)
);
CREATE TABLE IF NOT EXISTS style_versions (
  id TEXT PRIMARY KEY, style_id TEXT NOT NULL, version_no INTEGER NOT NULL, label TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(style_id,version_no)
);
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, style_id TEXT, asset_id TEXT,
  provider TEXT NOT NULL, model TEXT, status TEXT NOT NULL, request_kind TEXT NOT NULL,
  output_json TEXT, error_text TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, org_id TEXT NOT NULL, user_id TEXT,
  entity_type TEXT NOT NULL, entity_id TEXT, action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entitlements (
  org_id TEXT NOT NULL, feature_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  limit_value INTEGER, source TEXT NOT NULL DEFAULT 'SEHHA-DEV', PRIMARY KEY(org_id,feature_key)
);
CREATE INDEX IF NOT EXISTS idx_styles_org ON styles(org_id,updated_at);
CREATE INDEX IF NOT EXISTS idx_assets_style ON assets(style_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id,id DESC);
INSERT OR REPLACE INTO app_meta(key,value) VALUES('schema_version','3');
