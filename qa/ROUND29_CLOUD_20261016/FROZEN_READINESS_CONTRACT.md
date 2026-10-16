# Frozen readiness contract (ROUND29)

## Source of truth for PRODUCTION readiness
1. `POST /api/styles/:id/versions` now captures the engineering records (identity, fabrics, trims, pattern pieces, markers, routing) into `style_versions.snapshot_json.engineering` with `contract = ENGINEERING_IN_VERSION/R29` (`src/engineering.js: engineeringVersionCapture`).
2. A PRODUCTION release evaluates readiness **only** from that frozen version (`frozenEngineeringReadiness`) plus the sample evidence for the same version that the release freezes with it. Live engineering tables are never read for the decision (test R29-T02, ROUND28 suite "live approval after versioning does not unblock the frozen candidate").
3. A version created before ROUND29 has no `engineering` → `409 ENGINEERING_NOT_CAPTURED_IN_VERSION` (fail closed; create a new version).
4. `style_versions.snapshot_json` is now immutable (`trg_style_versions_snapshot_immutable`), so the candidate cannot change after evaluation. Drift in evidence that may legally change (samples, cost) is caught by commit-time fingerprints.

## What is frozen in the release (gate_json.engineering = snapshot_json.engineeringReadiness)
| Field | Meaning |
|---|---|
| `status` / `decision` | `ELIGIBLE_FOR_MANUAL_RELEASE_REVIEW` (only value that can be committed) |
| `blockers`, `percent` | readiness reason codes (empty on commit) |
| `rulesVersion` | `engineering-readiness/r29-2026-10-16` |
| `basis` | `FROZEN_STYLE_VERSION` |
| `captureContract` | `ENGINEERING_IN_VERSION/R29` |
| `sourceVersionNo` | exact candidate version |
| `candidateSha256` | SHA-256 of the stored `style_versions.snapshot_json` text (also in column `style_releases.candidate_sha256`) |
| `evidenceSha256` | SHA-256 of stable-canonical {samples, costSheets} frozen with the release |
| `decisionSha256` | SHA-256 of {rulesVersion, blockers, status, candidateSha256, evidenceSha256} |
| `evaluatedAt` | evaluation time |
| `humanApproval` | `{state:'NOT_GRANTED_BY_THIS_GATE', requiredSignoffsForHandoff:[DESIGN,PATTERN,PRODUCTION,QC]}` |
Also `gate_json.authority = {releasedBy, actorRole (from DB), contract:'FROZEN_READINESS/R29', autoSignoffs:0}` and column `evidence_contract='FROZEN_READINESS/R29'`.

Reproducibility (test R29-T11): `sha256(JSON.stringify(stable(JSON.parse(snapshot_json)))) == manifest.snapshotSha256`; `sha256(style_versions.snapshot_json) == candidate_sha256`; both survive backup/restore into a fresh schema-22 DB; a tamper that bypasses the triggers is detected by hash mismatch. Hashes are consistency evidence, not signatures.

## Eligibility ≠ approval
Committing a PRODUCTION release creates **zero** signoffs; factory handoff still needs DESIGN/PATTERN/PRODUCTION/QC signoffs from members whose DB role allows each (`canSignRole`), and identity/role fields in the request JSON are ignored (R29-T03).

## Legacy releases
| `evidenceStatus` | Rule | Display (Arabic UI) |
|---|---|---|
| `FROZEN_VERIFIED` | `evidence_contract='FROZEN_READINESS/R29'` | أدلة مجمّدة ✓ |
| `LIVE_UNVERSIONED_R28` | PRODUCTION row whose snapshot says `basis:'LIVE_ENGINEERING_RECORDS'` (only possible from the unmerged PR #2 code) | ROUND28 — غير مرتبط بنسخة |
| `LEGACY_UNVERIFIED` | any other PRODUCTION row | قديم — الأدلة غير ملتقطة |
| `NOT_APPLICABLE` | SAMPLE | — |
- Exposed on `GET /releases`, `GET /releases/:n/manifest`, `GET /releases/:n/handoff`. Computed on read; legacy rows, snapshots and gate_json are never modified (R29-T12, byte-compare). Legacy rows keep `evidence_contract IS NULL` and are excluded from the immutability triggers and the partial unique index, so upgrades over historical duplicates cannot fail.
- A legacy PRODUCTION release for a version **blocks** a new PRODUCTION release of the same version (409 PRODUCTION_ALREADY_RELEASED).
- **Downstream policy (decision recorded, not enforced this round):** Factory Handoff and Production Lot creation for `LEGACY_UNVERIFIED` releases are **not** blocked in ROUND29, because existing pilot data and 9 regression suites depend on legacy PRODUCTION rows and the owner has not chosen between "fail closed" and "re-release from a new version". The status is visible on handoff/manifest/list so humans can decide. Proposed next step in `ROUND29_NEXT_BATCH.md`.
