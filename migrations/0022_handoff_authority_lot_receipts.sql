-- ROUND30 P1 corrective, additive migration (schema 23 -> 24). No table is dropped, no existing row is rewritten.
-- P1-A: signer authority evidence is frozen into every new Factory Handoff and re-proved by the database inside the
--       same transaction that writes the package. Handoffs written before this migration carry NULL evidence
--       (their authority was never proved at commit) and are fail-closed for dispatch, acknowledge and lot opening.
-- P1-B: opening a Production Lot commits an immutable receipt atomically with the lot and its audit row, so a lost
--       response can be replayed instead of failing.
ALTER TABLE factory_handoffs ADD COLUMN signer_authority_sha256 TEXT;

-- Signoff eligibility mirrors src/authority.js SIGNOFF_ELIGIBILITY (owners sign any domain; DESIGN_PATTERN_MASTER signs
-- DESIGN/PATTERN; FACTORY_SUPERVISOR signs PRODUCTION; QC_MANAGER signs QC; a member whose role equals the domain signs
-- it). The four required signers must be active, eligible members of the handoff's own tenant at the moment of insert,
-- the release requester never signs, and Engineering, PRODUCTION and QC are three different people.
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_signer_authority
BEFORE INSERT ON factory_handoffs
WHEN NEW.status='PREPARED' AND NEW.version=1
BEGIN
  SELECT CASE
    WHEN NEW.signer_authority_sha256 IS NULL OR length(NEW.signer_authority_sha256)<>64
      THEN RAISE(ABORT,'HANDOFF_SIGNER_AUTHORITY_REQUIRED')
    WHEN (SELECT COUNT(*) FROM release_signoffs s JOIN users u ON u.id=s.user_id
          WHERE s.style_id=NEW.style_id AND s.release_no=NEW.release_no AND s.decision='APPROVED'
            AND s.role_key IN ('DESIGN','PATTERN','PRODUCTION','QC') AND u.active=1
            AND (u.is_platform_admin=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.org_id=NEW.org_id AND (
                  UPPER(m.role) IN ('PLATFORM_ADMIN','PLATFORM_OWNER','WORKSPACE_OWNER') OR UPPER(m.role)=s.role_key
                  OR (s.role_key IN ('DESIGN','PATTERN') AND UPPER(m.role)='DESIGN_PATTERN_MASTER')
                  OR (s.role_key='PRODUCTION' AND UPPER(m.role)='FACTORY_SUPERVISOR')
                  OR (s.role_key='QC' AND UPPER(m.role)='QC_MANAGER')))))<>4
      THEN RAISE(ABORT,'HANDOFF_SIGNER_INELIGIBLE')
    WHEN EXISTS(SELECT 1 FROM release_signoffs s JOIN style_releases r ON r.id=NEW.release_id
          WHERE s.style_id=NEW.style_id AND s.release_no=NEW.release_no AND s.decision='APPROVED' AND s.user_id=r.created_by)
      OR (SELECT user_id FROM release_signoffs WHERE style_id=NEW.style_id AND release_no=NEW.release_no AND role_key='PRODUCTION')
       = (SELECT user_id FROM release_signoffs WHERE style_id=NEW.style_id AND release_no=NEW.release_no AND role_key='QC')
      OR EXISTS(SELECT 1 FROM release_signoffs e JOIN release_signoffs o ON o.style_id=e.style_id AND o.release_no=e.release_no AND o.user_id=e.user_id
          WHERE e.style_id=NEW.style_id AND e.release_no=NEW.release_no AND e.role_key IN ('DESIGN','PATTERN') AND o.role_key IN ('PRODUCTION','QC'))
      THEN RAISE(ABORT,'HANDOFF_SIGNER_NOT_INDEPENDENT')
  END;
END;
-- The frozen authority evidence is part of the package and never changes after insert.
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_authority_immutable
BEFORE UPDATE ON factory_handoffs
WHEN NEW.signer_authority_sha256 IS NOT OLD.signer_authority_sha256
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_PACKAGE_IMMUTABLE');
END;
-- A handoff without proved signer authority (written before schema 24) may only be withdrawn.
CREATE TRIGGER IF NOT EXISTS trg_factory_handoffs_authority_required
BEFORE UPDATE ON factory_handoffs
WHEN NEW.status IN ('HANDED_OFF','ACKNOWLEDGED') AND NEW.signer_authority_sha256 IS NULL
BEGIN
  SELECT RAISE(ABORT,'HANDOFF_AUTHORITY_UNVERIFIED');
END;
-- A lot opened from a handoff must reference an ACKNOWLEDGED handoff of the same style/release with proved authority.
-- Lots written before schema 23 keep handoff_id NULL and are untouched.
CREATE TRIGGER IF NOT EXISTS trg_production_lots_handoff_eligible
BEFORE INSERT ON production_lots
WHEN NEW.handoff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM factory_handoffs h WHERE h.id=NEW.handoff_id AND h.style_id=NEW.style_id
  AND h.release_no=NEW.release_no AND h.status='ACKNOWLEDGED' AND h.signer_authority_sha256 IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT,'LOT_HANDOFF_NOT_ELIGIBLE');
END;

-- Durable, immutable lot-opening receipt. Scope: tenant + actor + operation + Idempotency-Key (NULL keys never collide).
CREATE TABLE IF NOT EXISTS lot_receipts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation='LOT_CREATE'),
  style_id TEXT NOT NULL,
  handoff_id TEXT NOT NULL,
  lot_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT,
  request_sha256 TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(org_id,actor_user_id,operation,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_lot_receipts_style ON lot_receipts(style_id,created_at);
CREATE TRIGGER IF NOT EXISTS trg_lot_receipts_immutable
BEFORE UPDATE ON lot_receipts
BEGIN
  SELECT RAISE(ABORT,'LOT_RECEIPT_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_lot_receipts_no_delete
BEFORE DELETE ON lot_receipts
BEGIN
  SELECT RAISE(ABORT,'LOT_RECEIPT_IMMUTABLE');
END;

INSERT INTO app_meta(key,value) VALUES('schema_version','24') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
