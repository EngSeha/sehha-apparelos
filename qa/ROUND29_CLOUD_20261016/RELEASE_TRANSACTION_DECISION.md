# Release transaction decision (ROUND29)

## Single authoritative flow
`POST /api/styles/:id/releases` → `createRelease()` in `src/production_release.js` (the old inline handler in `src/worker.js` was removed; the route now delegates). One command for SAMPLE and PRODUCTION.

```
 request ──► auth (cookie) ─► style lookup ─► requireOrg + requireFeature(RELEASES)
         ──► actorAccess(DB: users.active, is_platform_admin, membership)   [session claims are not authority]
         ──► Idempotency-Key (optional, 8–128 [A-Za-z0-9._:-]) + requestSha256(op, style, type, version, template, note)
         ──► receipt lookup (org, actor, op, key) ── hit ─► same sha → replay stored 201 / different sha → 409
         ──► fingerprints READ FIRST: REL_MAX, VER_MAX, SAMPLE_STAMP, COST_STAMP
         ──► evaluate: frozen version + current sample/cost evidence → releaseGate → (PRODUCTION) frozenEngineeringReadiness
         ──► build gate/manifest/snapshot/receipt/audit payloads (all hashes computed here)
         ──► D1 batch (one transaction):
               S1 INSERT style_releases … SELECT … WHERE <every guard>      (0 rows if any guard fails — no error by itself)
               S2 INSERT release_receipts … release_id = (SELECT id FROM style_releases WHERE id=?)  NOT NULL ⇒ aborts batch
               S3 UPDATE styles SET status …
               S4 INSERT audit_log … entity_id = (SELECT id …)
         ──► success: 201 body == receipt.response_json
         ──► failure: (a) receipt for same key exists → replay/409; (b) guard abort → re-diagnose → 403/409 code;
                      (c) UNIQUE → 409 RELEASE_CONFLICT; (d) anything else → 500 RELEASE_COMMIT_FAILED + correlationId
```

## D1 guarantee relied on — and verified
Cloudflare documents `D1Database.batch()` as a transaction: statements run sequentially and a failing statement rolls back the whole batch. Verified **locally on workerd D1** (`getPlatformProxy`, not remote):
- a NOT NULL failure in statement 3 rolled back statement 1's insert;
- a UNIQUE failure in a later statement rolled back an earlier insert;
- a guarded `INSERT … SELECT … WHERE 0` returns `changes 0` **without error** — so a zero-row guard can NOT be trusted alone. The design therefore forces failure with the NOT NULL receipt reference (S2). No conditional UPDATE is assumed to abort.

## Guards re-asserted inside S1 (evaluated by the database at commit)
| Guard | SQL condition | Failure result |
|---|---|---|
| Style still belongs to the tenant | `styles.id=? AND org_id=?` | 409 STALE_CANDIDATE |
| Actor active and still authorized | `users.active=1 AND (is_platform_admin=1 OR membership(org))` | 403 FORBIDDEN_ACTOR |
| Feature licensed (local mode) | `entitlements RELEASES enabled=1` (skipped when `LICENSE_MODE=remote`; remote is checked over HTTP before commit only) | 403 FEATURE_NOT_LICENSED |
| No competing release | `MAX(release_no)=releaseNo-1` (release_no computed from the fingerprint, never retried) | 409 RELEASE_CONFLICT |
| No new Style Version | `MAX(version_no)=fp` | 409 STALE_CANDIDATE |
| Sample evidence unchanged | count / max(updated_at) / approved-count of `sample_rounds` | 409 STALE_CANDIDATE |
| Cost evidence unchanged | same over `cost_sheets` + `cost_lines` | 409 STALE_CANDIDATE |
| One PRODUCTION per version | `NOT EXISTS PRODUCTION release for (style, version)` + partial UNIQUE index for contract rows | 409 PRODUCTION_ALREADY_RELEASED |
| Candidate unchanged | `style_versions` row exists with same `length(snapshot_json)`; snapshot UPDATE is blocked by trigger | 409 STALE_CANDIDATE |

## Stable external error contract
| HTTP | code | When |
|---|---|---|
| 201 | — | committed (or idempotent replay, header `Idempotency-Replayed: true`) |
| 400 | IDEMPOTENCY_KEY_INVALID / (message) | malformed key, bad releaseType/sourceVersionNo |
| 403 | FORBIDDEN_ACTOR / FEATURE_NOT_LICENSED / (Forbidden workspace) | tenant, actor or licence failure, including drift during commit |
| 404 | — | style or source version missing |
| 409 | RELEASE_GATE_BLOCKED, VERSION_REQUIRED, ENGINEERING_READINESS_BLOCKED, ENGINEERING_NOT_CAPTURED_IN_VERSION, PRODUCTION_ALREADY_RELEASED, RELEASE_CONFLICT, STALE_CANDIDATE, IDEMPOTENCY_KEY_REUSED | expected business conflicts — never 500 |
| 500 | RELEASE_COMMIT_FAILED + `correlationId` | genuinely unexpected DB failure; body carries no SQL text (server log carries the detail) |

## Side effects outside D1
None. The release command writes no R2 object and calls no external service, so no compensation contract is needed. (Remote licensing in `LICENSE_MODE=remote` is a read, checked before commit; it cannot be part of the DB transaction — documented residual.)

## Not available in this product → reported, not invented
- **Per-session revocation**: sessions are stateless HMAC cookies with `exp`; there is no session store. Deactivation (`users.active=0`) and membership removal are enforced at commit; revoking one specific cookie is not possible → `BLOCKED_NO_SESSION_STORE`.
- **Tenant archive / maintenance / incident HOLD**: no such state exists in schema 21/22 → `BLOCKED_NO_HOLD_MODEL`. The guard list above is where such a predicate would be added.
