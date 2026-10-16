-- ROUND29 additive migration: atomic, idempotent Production Release with frozen readiness evidence.
-- Existing (legacy) release rows are untouched: their new columns stay NULL and they are reported as LEGACY_UNVERIFIED.
ALTER TABLE style_releases ADD COLUMN evidence_contract TEXT;
ALTER TABLE style_releases ADD COLUMN candidate_sha256 TEXT;

-- One authoritative PRODUCTION release per frozen Style Version for rows written under the new contract.
-- Legacy rows (evidence_contract IS NULL) are excluded so upgrading a database with historical duplicates cannot fail.
CREATE UNIQUE INDEX IF NOT EXISTS uq_style_releases_production_candidate
  ON style_releases(style_id,source_version_no)
  WHERE release_type='PRODUCTION' AND evidence_contract IS NOT NULL;

-- Immutable success representation of a release command. Every release written under the new contract has exactly one.
-- idempotency_key is NULL when the client did not send an Idempotency-Key (NULLs never collide in SQLite UNIQUE).
CREATE TABLE IF NOT EXISTS release_receipts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  style_id TEXT NOT NULL,
  idempotency_key TEXT,
  request_sha256 TEXT NOT NULL,
  release_id TEXT NOT NULL UNIQUE,
  release_no INTEGER NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(org_id,actor_user_id,operation,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_release_receipts_style ON release_receipts(style_id,release_no);

-- Release evidence written under the new contract is immutable at the database level.
CREATE TRIGGER IF NOT EXISTS trg_style_releases_contract_immutable
BEFORE UPDATE ON style_releases
WHEN OLD.evidence_contract IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'RELEASE_EVIDENCE_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_style_releases_contract_no_delete
BEFORE DELETE ON style_releases
WHEN OLD.evidence_contract IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'RELEASE_EVIDENCE_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_release_receipts_immutable
BEFORE UPDATE ON release_receipts
BEGIN
  SELECT RAISE(ABORT,'RELEASE_RECEIPT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_release_receipts_no_delete
BEFORE DELETE ON release_receipts
BEGIN
  SELECT RAISE(ABORT,'RELEASE_RECEIPT_IMMUTABLE');
END;
-- Frozen Style Versions are release candidates; their snapshot must never be rewritten.
CREATE TRIGGER IF NOT EXISTS trg_style_versions_snapshot_immutable
BEFORE UPDATE OF snapshot_json ON style_versions
BEGIN
  SELECT RAISE(ABORT,'STYLE_VERSION_IMMUTABLE');
END;

INSERT INTO app_meta(key,value) VALUES('schema_version','22') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
