# Failure injection and concurrency evidence — ROUND30 P1 corrective

Engines: **node:sqlite** (real SQLite through the D1 adapter; `batch()` = BEGIN/COMMIT/ROLLBACK) and **workerd local D1** (wrangler `getPlatformProxy`). Remote Cloudflare D1: **not tested (BLOCKED_ENV)**.

## Technique
- **Commit window**: a hook wrapped around `env.DB.batch` runs a competing write after every JavaScript read of the request and immediately before the batch. This is exactly where the reported TOCTOU lives. The same hook is used on both engines.
- **Barrier**: N requests are held at `batch()` until all N have arrived, then released together.
- **Failure injection**: a real SQLite trigger `RAISE(ABORT,'INJECTED_FAILURE')` on one mandatory write at a time, dropped after the attempt.
- **Byte-identical check**: every row of handoffs, events, handoff receipts, handoff audits, lots, lot receipts and lot CREATE audits for the style is compared before and after (`same(before,after)`).

## P1-A — authority in the commit window (zero writes on every rejection)
| Rows | What changes in the window | Result |
|---|---|---|
| P1A-01 | QC signer role QC_MANAGER→OPERATOR, still active (the independent reproduction) | 409 SIGNOFF_SIGNER_INVALID (QC); rows identical; retry with the same key after restore → 201 once |
| P1A-02 ×16 | each domain (DESIGN, PATTERN, PRODUCTION, QC) × {role→OPERATOR, membership removed, user disabled, membership moved to another tenant} | 409 for that domain; rows identical |
| P1A-03 | signer moved to a different **eligible** role | 409 (frozen role must equal the committed role); a fresh attempt freezes the new role |
| P1A-04/05 | QC signoff re-signed by another eligible user / PRODUCTION flipped to REJECTED | 409; rows identical |
| P1A-06 ×4 | preparer demoted / disabled / removed / switched to another permitted role | 403 ROLE_NOT_PERMITTED / 403 FORBIDDEN_ACTOR ×2 / 409 AUTHORITY_CHANGED; rows identical |
| P1A-07/08 | style transferred to another tenant / newer PRODUCTION release committed | 4xx / 409 RELEASE_SUPERSEDED; rows identical |
| P1A-10 | role change committed **after** the batch | 201; dispatch 200; ack 200; package bytes and hashes unchanged (no retroactive rewrite) |
| P1A-11 | 8 concurrent PREPAREs at the barrier with QC revoked just before the first batch | 8 × 409, 0 × 201, no 500, rows identical |
| P1A-16 ×3 | dispatch / acknowledge / withdraw actor demoted in the window | 403; rows identical |
| P1-W02..W04 | the same rows on workerd D1 | identical outcomes |

## P1-B — lot opening
| Rows | Scenario | Result |
|---|---|---|
| P1B-01/02 | 201 → response lost → identical retry; retry again after the lot changed (row_version 2) | 201 replay of the original (row_version 1); 1 lot / 1 receipt / 1 CREATE audit |
| P1B-07 / P1-W07 | 12 concurrent identical requests, one key | all 201 (1 live + 11 replays), one lot id, 1/1/1 |
| P1B-08 / P1-W07 | 12 concurrent same-body requests, 12 keys | one 201, eleven 409 LOT_CODE_EXISTS, no 500, 1/1/1 |
| P1B-10 ×3 / P1-W08 ×3 | abort at the production_lots / lot_receipts / audit_log INSERT | sanitized 500 LOT_COMMIT_FAILED + correlationId, no SQL text; rows identical; retry with the same key → 201 once; then replay |
| P1B-11a..j | PREPARED / HANDED_OFF / WITHDRAWN handoff, legacy release, tampered package bytes, actor demoted or switched in the window, wrong handoffId, plannedQty 0, malformed key | 409 / 409 / 409 / 409 / 409 HANDOFF_PACKAGE_DRIFT / 403 / 409 AUTHORITY_CHANGED / 409 HANDOFF_MISMATCH / 400 / 400; no writes |
| P1B-15 | DB-wide after every race, retry and injection | every API lot has exactly 1 receipt and 1 CREATE audit; 0 orphan receipts |

## Mutation proof (the tests detect the defect class)
| Mutation | Raw log | First failing row |
|---|---|---|
| SQL signer guard removed from the PREPARE INSERT | raw/mutation_no_sql_signer_guard.log | P1A-01 |
| 0022 insert trigger removed | raw/mutation_no_db_trigger.log | P1A-13a |
| Lot receipt lookup disabled | raw/mutation_no_lot_replay.log | P1B-01 |

The sources were restored byte-for-byte after each mutation (sha256 checked); the committed tree carries no mutation.
