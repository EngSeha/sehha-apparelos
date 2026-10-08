CREATE TABLE IF NOT EXISTS human_store_tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  material_key TEXT NOT NULL,
  source_ref TEXT,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  movement TEXT NOT NULL CHECK(movement IN ('RECEIVE','ISSUE','RETURN')),
  assignee_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(lot_id,material_key,movement,assignee_user_id)
);
CREATE INDEX IF NOT EXISTS idx_human_store_assignee ON human_store_tasks(assignee_user_id,org_id,status);
CREATE TABLE IF NOT EXISTS human_store_balances (
  lot_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  material_key TEXT NOT NULL,
  unit TEXT NOT NULL,
  on_hand_milli INTEGER NOT NULL DEFAULT 0 CHECK(on_hand_milli>=0),
  issued_net_milli INTEGER NOT NULL DEFAULT 0 CHECK(issued_net_milli>=0),
  version INTEGER NOT NULL DEFAULT 1,
  last_event_id TEXT,
  last_task_id TEXT,
  last_request_key TEXT,
  last_actor_id TEXT,
  last_movement TEXT,
  last_delta_milli INTEGER,
  last_at TEXT,
  PRIMARY KEY(lot_id,material_key)
);
CREATE TABLE IF NOT EXISTS human_store_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  lot_id TEXT NOT NULL,
  material_key TEXT NOT NULL,
  unit TEXT NOT NULL,
  movement TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL,
  before_on_hand_milli INTEGER NOT NULL,
  after_on_hand_milli INTEGER NOT NULL,
  before_issued_net_milli INTEGER NOT NULL,
  after_issued_net_milli INTEGER NOT NULL,
  request_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id,request_key)
);
CREATE TRIGGER IF NOT EXISTS trg_human_store_balance_event
AFTER UPDATE OF version ON human_store_balances
WHEN NEW.version>OLD.version
BEGIN
  INSERT INTO human_store_events(id,task_id,lot_id,material_key,unit,movement,quantity_milli,before_on_hand_milli,after_on_hand_milli,before_issued_net_milli,after_issued_net_milli,request_key,user_id,created_at)
  VALUES(NEW.last_event_id,NEW.last_task_id,NEW.lot_id,NEW.material_key,NEW.unit,NEW.last_movement,NEW.last_delta_milli,OLD.on_hand_milli,NEW.on_hand_milli,OLD.issued_net_milli,NEW.issued_net_milli,NEW.last_request_key,NEW.last_actor_id,NEW.last_at);
END;
INSERT INTO app_meta(key,value) VALUES('schema_version','21') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
