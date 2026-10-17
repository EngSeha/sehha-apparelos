-- AI-first garment intake + Tech Pack PDF documents (additive; schema 21 -> 22 on the modern baseline 9bcd13d).
-- Integration note: the factory-security stack (PRs #2..#5) adds 0020..0022 and moves the schema to 24. The file is
-- numbered 0023 so it sorts after that stack; when both lines are integrated, only this file's schema_version value
-- and the Worker's SCHEMA_VERSION constant change (to 25). No existing table is dropped or rewritten.

-- One adaptive intake per Style: AI hypothesis (mock or live), owner corrections, answers and measurement basis.
CREATE TABLE IF NOT EXISTS garment_intakes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL UNIQUE,
  category TEXT,
  category_source TEXT CHECK(category_source IS NULL OR category_source IN ('AI_HYPOTHESIS','OWNER_CONFIRMED','OWNER_SELECTED')),
  classification_json TEXT NOT NULL DEFAULT '{}',
  vision_mode TEXT CHECK(vision_mode IS NULL OR vision_mode IN ('MOCK','LIVE')),
  vision_run_id TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  row_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tech Pack document revisions. A DRAFT is a frozen snapshot that can be previewed/exported with a DRAFT label.
-- APPROVED freezes the exact PDF bytes (R2 key + SHA-256); re-export serves the same bytes.
CREATE TABLE IF NOT EXISTS techpack_documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  revision_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','APPROVED')),
  snapshot_json TEXT NOT NULL,
  snapshot_sha256 TEXT NOT NULL,
  html_sha256 TEXT,
  gate_json TEXT NOT NULL DEFAULT '{}',
  pdf_r2_key TEXT,
  pdf_sha256 TEXT,
  pdf_bytes INTEGER,
  page_count INTEGER,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  UNIQUE(style_id,revision_no),
  CHECK(status<>'APPROVED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND pdf_sha256 IS NOT NULL AND pdf_r2_key IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_techpack_documents_style ON techpack_documents(style_id,revision_no DESC);

-- The frozen snapshot of any revision never changes.
CREATE TRIGGER IF NOT EXISTS trg_techpack_documents_snapshot_immutable
BEFORE UPDATE ON techpack_documents
WHEN NEW.snapshot_json IS NOT OLD.snapshot_json OR NEW.snapshot_sha256 IS NOT OLD.snapshot_sha256 OR NEW.style_id IS NOT OLD.style_id
  OR NEW.org_id IS NOT OLD.org_id OR NEW.revision_no IS NOT OLD.revision_no OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT,'TECHPACK_SNAPSHOT_IMMUTABLE');
END;
-- An APPROVED revision (and its frozen PDF) is never modified or deleted.
CREATE TRIGGER IF NOT EXISTS trg_techpack_documents_approved_immutable
BEFORE UPDATE ON techpack_documents
WHEN OLD.status='APPROVED'
BEGIN
  SELECT RAISE(ABORT,'TECHPACK_APPROVED_IMMUTABLE');
END;
CREATE TRIGGER IF NOT EXISTS trg_techpack_documents_approved_no_delete
BEFORE DELETE ON techpack_documents
WHEN OLD.status='APPROVED'
BEGIN
  SELECT RAISE(ABORT,'TECHPACK_APPROVED_IMMUTABLE');
END;

INSERT INTO app_meta(key,value) VALUES('schema_version','22') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
