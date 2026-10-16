-- ROUND30 additive migration: persisted, frozen Factory Handoff (PREPARED -> HANDED_OFF -> ACKNOWLEDGED, or
-- PREPARED -> WITHDRAWN) built on the existing computed handoff summary. No existing table is dropped or rewritten.
CREATE TABLE IF NOT EXISTS factory_handoffs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  release_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PREPARED','HANDED_OFF','ACKNOWLEDGED','WITHDRAWN')),
  version INTEGER NOT NULL DEFAULT 1,
  package_json TEXT NOT NULL,
  package_sha256 TEXT NOT NULL,
  release_snapshot_sha256 TEXT NOT NULL,
  release_manifest_sha256 TEXT,
  signoffs_sha256 TEXT NOT NULL,
  prepared_by TEXT NOT NULL,
  prepared_at TEXT NOT NULL,
  dispatched_by TEXT,
  dispatched_at TEXT,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  ack_note TEXT,
  withdrawn_by TEXT,
  withdrawn_at TEXT,
  withdraw_reason TEXT,
  last_command_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(status<>'WITHDRAWN' OR (withdraw_reason IS NOT NULL AND length(trim(withdraw_reason))>=5 AND withdrawn_by IS NOT NULL)),
  CHECK(status NOT IN ('HANDED_OFF','ACKNOWLEDGED') OR dispatched_by IS NOT NULL),
  CHECK(status<>'ACKNOWLEDGED' OR (acknowledged_by IS NOT NULL AND acknowledged_by<>dispatched_by))
);
-- At most one live (non-withdrawn) handoff per technical release.
CREATE UNIQUE INDEX IF NOT EXISTS uq_factory_handoffs_live_release ON factory_handoffs(release_id) WHERE status<>'WITHDRAWN';
CREATE INDEX IF NOT EXISTS idx_factory_handoffs_style ON factory_handoffs(style_id,release_no,status);

CREATE TABLE IF NOT EXISTS factory_handoff_events (
  id TEXT PRIMARY KEY,
  handoff_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action IN ('PREPARE','DISPATCH','ACKNOWLEDGE','WITHDRAW')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT,
  package_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_factory_handoff_events_handoff ON factory_handoff_events(handoff_id,created_at);

CREATE TABLE IF NOT EXISTS handoff_receipts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT,
  request_sha256 TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(org_id,actor_user_id,operation,idempotency_key)
);

-- Provenance for lots opened from an acknowledged handoff. Existing lots keep NULL (flagged for review, never deleted).
ALTER TABLE production_lots ADD COLUMN handoff_id TEXT;

-- State machine and immutability enforced by the database, independent of application code.
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_insert_prepared
BEFORE INSERT ON factory_handoffs
WHEN NEW.status<>'PREPARED' OR NEW.version<>1
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_INSERT_MUST_BE_PREPARED');
END;
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_package_immutable
BEFORE UPDATE ON factory_handoffs
WHEN NEW.id IS NOT OLD.id OR NEW.org_id IS NOT OLD.org_id OR NEW.style_id IS NOT OLD.style_id OR NEW.release_id IS NOT OLD.release_id
  OR NEW.release_no IS NOT OLD.release_no OR NEW.package_json IS NOT OLD.package_json OR NEW.package_sha256 IS NOT OLD.package_sha256
  OR NEW.release_snapshot_sha256 IS NOT OLD.release_snapshot_sha256 OR NEW.release_manifest_sha256 IS NOT OLD.release_manifest_sha256
  OR NEW.signoffs_sha256 IS NOT OLD.signoffs_sha256 OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_at IS NOT OLD.prepared_at
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_PACKAGE_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_transition
BEFORE UPDATE ON factory_handoffs
WHEN NEW.version<>OLD.version+1 OR NOT (
  (OLD.status='PREPARED' AND NEW.status IN ('HANDED_OFF','WITHDRAWN')) OR (OLD.status='HANDED_OFF' AND NEW.status='ACKNOWLEDGED'))
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_TRANSITION_INVALID');
END;
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_no_delete
BEFORE DELETE ON factory_handoffs
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_factory_handoff_events_immutable
BEFORE UPDATE ON factory_handoff_events
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_factory_handoff_events_no_delete
BEFORE DELETE ON factory_handoff_events
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_HISTORY_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_handoff_receipts_immutable
BEFORE UPDATE ON handoff_receipts
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_RECEIPT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_handoff_receipts_no_delete
BEFORE DELETE ON handoff_receipts
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_RECEIPT_IMMUTABLE');
END;
-- Signoffs frozen into a live handoff package cannot be added, changed or removed afterwards.
CREATE TRIGGER IF NOT EXISTS trg_release_signoffs_frozen_insert
BEFORE INSERT ON release_signoffs
WHEN EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.style_id=NEW.style_id AND h.release_no=NEW.release_no AND h.status<>'WITHDRAWN')
BEGIN
  SELECT RAISE(ABORT,'SIGNOFFS_FROZEN_BY_HANDOFF');
END;
CREATE TRIGGER IF NOT EXISTS trg_release_signoffs_frozen_update
BEFORE UPDATE ON release_signoffs
WHEN EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.style_id=OLD.style_id AND h.release_no=OLD.release_no AND h.status<>'WITHDRAWN')
BEGIN
  SELECT RAISE(ABORT,'SIGNOFFS_FROZEN_BY_HANDOFF');
END;
CREATE TRIGGER IF NOT EXISTS trg_release_signoffs_frozen_delete
BEFORE DELETE ON release_signoffs
WHEN EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.style_id=OLD.style_id AND h.release_no=OLD.release_no AND h.status<>'WITHDRAWN')
BEGIN
  SELECT RAISE(ABORT,'SIGNOFFS_FROZEN_BY_HANDOFF');
END;

INSERT INTO app_meta(key,value) VALUES('schema_version','23') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
