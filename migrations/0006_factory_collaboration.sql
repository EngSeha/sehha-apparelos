CREATE TABLE IF NOT EXISTS review_items (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  release_no INTEGER,
  category TEXT NOT NULL DEFAULT 'TECHNICAL',
  severity TEXT NOT NULL DEFAULT 'MAJOR',
  title TEXT NOT NULL,
  description TEXT,
  field_ref TEXT,
  page_no INTEGER,
  assigned_role TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  source TEXT NOT NULL DEFAULT 'USER',
  resolution TEXT,
  created_by TEXT NOT NULL,
  resolved_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS release_signoffs (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  release_no INTEGER NOT NULL,
  role_key TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(style_id, release_no, role_key)
);

CREATE INDEX IF NOT EXISTS idx_review_items_style ON review_items(style_id,status,severity,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_items_release ON review_items(style_id,release_no,status);
CREATE INDEX IF NOT EXISTS idx_release_signoffs_release ON release_signoffs(style_id,release_no,role_key);

INSERT INTO app_meta(key,value) VALUES('schema_version','8')
ON CONFLICT(key) DO UPDATE SET value='8';
