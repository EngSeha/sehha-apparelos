CREATE TABLE IF NOT EXISTS human_preferences (
  user_id TEXT PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'ar',
  density TEXT NOT NULL DEFAULT 'comfortable',
  last_workspace_id TEXT,
  preferred_view TEXT NOT NULL DEFAULT 'auto',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS human_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  operation_seq INTEGER NOT NULL,
  assignee_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(lot_id, operation_seq, assignee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_human_tasks_assignee ON human_tasks(assignee_user_id,org_id,status);
CREATE TABLE IF NOT EXISTS human_task_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  completed_delta INTEGER NOT NULL,
  rejected_delta INTEGER NOT NULL,
  before_completed INTEGER NOT NULL,
  after_completed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, request_key)
);
CREATE TABLE IF NOT EXISTS human_correction_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL
);
INSERT INTO app_meta(key,value) VALUES('schema_version','19') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
