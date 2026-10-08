CREATE TABLE IF NOT EXISTS human_qc_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  assignee_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(lot_id,assignee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_human_qc_assignee ON human_qc_tasks(assignee_user_id,org_id,status);
CREATE TABLE IF NOT EXISTS human_qc_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  check_id TEXT NOT NULL,
  defect_id TEXT,
  evidence_asset_id TEXT,
  answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id,request_key)
);
CREATE TABLE IF NOT EXISTS human_defect_evidence (
  defect_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(defect_id,asset_id)
);
CREATE TABLE IF NOT EXISTS human_qc_photos (
  asset_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
INSERT INTO app_meta(key,value) VALUES('schema_version','20') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
