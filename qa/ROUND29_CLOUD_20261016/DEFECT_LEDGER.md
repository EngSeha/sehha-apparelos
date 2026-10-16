# Defect ledger — ROUND29

| ID | Sev | Defect | File | Status | Evidence / reason |
|---|---|---|---|---|---|
| R28-D2 | P0 | Release INSERT, Style UPDATE and audit were 3 separate writes | `src/worker.js` (old inline handler) → `src/production_release.js` | **FIXED** | one D1 batch; failure injection at each statement leaves 0 partial rows (R29-T07, R29-W6) |
| R28-D3 | P1 | `MAX(release_no)+1` race surfaced as HTTP 500 (UNIQUE) | same | **FIXED** | guard `MAX(release_no)=n-1` in-transaction + UNIQUE backstop → 409 RELEASE_CONFLICT; 0×500 in 25/20-way races (R29-T06, R29-W4/W8) |
| R28-D4 | P1 | Readiness read live mutable engineering tables (TOCTOU) | `src/engineering.js`, `src/worker.js` (versions) | **FIXED** | engineering frozen into Style Version; readiness evaluated only from it (R29-T02, ROUND28 #12) |
| R29-F1 | P1 | No idempotency for release creation | `src/production_release.js`, `migrations/0020` | **FIXED** | `Idempotency-Key` + immutable `release_receipts` (R29-T04/T05/T06) |
| R29-F2 | P1 | Frozen Style Version snapshot could be UPDATEd | `migrations/0020` | **FIXED** | `trg_style_versions_snapshot_immutable` (R29-T11) |
| R29-F3 | P1 | Contract release rows / receipts could be UPDATEd or DELETEd at DB level | `migrations/0020` | **FIXED** | 4 triggers (R29-T11, R29-W3) |
| R28-D6 | P1 | Legacy PRODUCTION releases carry no readiness evidence | `src/production_release.js:releaseEvidenceStatus`, `public/app.js` | **PARTIAL** | labelled `LEGACY_UNVERIFIED` on list/manifest/handoff/UI, never mutated; downstream Handoff/Lot **not** blocked — owner decision pending (see FROZEN_READINESS_CONTRACT.md) |
| R29-F4 | P1 | `requireAuth` does not check `users.active`; `requireOrg` trusts the cookie's `platformAdmin` claim | `src/worker.js:286-287` | **FIXED for the release command only; OPEN elsewhere** | release re-reads actor from DB (R29-T09). Other mutating routes still accept a deactivated user's unexpired cookie — fixing globally changes every route; proposed for next batch |
| R29-F5 | P1 | No tenant archive / maintenance / incident HOLD state exists | schema | **BLOCKED_NO_HOLD_MODEL** | cannot be guarded without a product decision on the model |
| R29-F6 | P1 | No server-side session store → a single cookie cannot be revoked | `src/worker.js` (HMAC sessions) | **BLOCKED_NO_SESSION_STORE** | deactivation/membership removal are enforced at commit instead |
| R29-F7 | P1 | Any workspace member (any role) may create a PRODUCTION release | `src/production_release.js` (unchanged semantics) | **OPEN_DECISION** | not defined in CLAUDE.md; kept as-is to avoid breaking flows; handoff still needs 4 role signoffs |
| R29-F8 | P2 | Global error handler returns raw `e.message` on 500 (may expose SQL text) | `src/worker.js:935` | **FIXED for release; OPEN elsewhere** | release returns `RELEASE_COMMIT_FAILED` + correlationId |
| R29-F9 | P2 | Version creation uses `MAX(version_no)+1` → concurrent create gives 500 | `src/worker.js` versions POST | **OPEN** | same pattern as R28-D3; out of this slice |
| R29-F10 | P2 | SAMPLE release from the *working* snapshot (no source version) is not drift-guarded for working-table edits | `src/production_release.js` | **OPEN (pre-existing behaviour kept)** | SAMPLE semantics intentionally unchanged |
| R29-F11 | P2 | In `LICENSE_MODE=remote` the entitlement is checked over HTTP before commit, not inside the transaction | `src/production_release.js` | **RESIDUAL** | cannot be in a D1 transaction; documented |
| R28-D5 | P2 | Engineering vs legacy BOM/operations reconciliation not checked by the gate | `src/engineering.js` | **OPEN** | unchanged |
| R29-F12 | P3 | Sample/cost fingerprints use counts + max(updated_at) (ms); an edit that keeps counts and lands in the same millisecond is invisible | `src/production_release.js` | **RESIDUAL** | a per-style revision counter would close it |
