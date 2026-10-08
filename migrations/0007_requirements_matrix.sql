CREATE TABLE IF NOT EXISTS style_requirements (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  req_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'TECHNICAL',
  label TEXT NOT NULL,
  label_en TEXT,
  applicability TEXT NOT NULL DEFAULT 'OPTIONAL',
  status TEXT NOT NULL DEFAULT 'OPEN',
  linked_ref TEXT,
  source TEXT NOT NULL DEFAULT 'USER',
  note TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(style_id, req_key)
);
CREATE INDEX IF NOT EXISTS idx_style_requirements_style ON style_requirements(style_id,applicability,status,req_key);
INSERT INTO app_meta(key,value) VALUES('schema_version','9')
ON CONFLICT(key) DO UPDATE SET value='9';
