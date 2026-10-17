# Migration 0022 — fresh install, upgrade, restore

`migrations/0022_handoff_authority_lot_receipts.sql` moves the schema from 23 to 24. It is additive only: one `ALTER TABLE ADD COLUMN`, one new table, one index, six triggers and the `schema_version` row. No table is dropped and no existing row is rewritten.

| Object | Purpose |
|---|---|
| `factory_handoffs.signer_authority_sha256` | Frozen hash of the signer authority (per domain: user, signoff time, committed role). NULL on rows written at schema 23. |
| `trg_factory_handoffs_signer_authority` | BEFORE INSERT. Requires the evidence hash and four APPROVED signers that are active, eligible members of the same tenant. The requester never signs, and DESIGN/PATTERN, PRODUCTION and QC are three different people. |
| `trg_factory_handoffs_authority_immutable` | The evidence hash never changes after insert. |
| `trg_factory_handoffs_authority_required` | A handoff without evidence cannot become HANDED_OFF or ACKNOWLEDGED. WITHDRAWN is still allowed. |
| `trg_production_lots_handoff_eligible` | A lot that references a handoff needs an ACKNOWLEDGED, evidence-carrying handoff of the same style and release. Lots with NULL `handoff_id` are untouched. |
| `lot_receipts` + 2 triggers | Immutable lot-opening receipt. UNIQUE(org, actor, operation, key) and UNIQUE(lot_id). |

## Results
| Check | Engine | Result | Source |
|---|---|---|---|
| Fresh install 0001..0022 | node:sqlite | schema 24; table, column and 6 triggers present | P1M-01 |
| Upgrade 21→22→23→24 over historical rows: two PRODUCTION releases, an OPEN and a RELEASED lot, a schema-23 handoff and its event | node:sqlite | every pre-existing column identical; new column NULL | P1M-02 |
| DDL after upgrade vs fresh install | node:sqlite | identical | P1M-03 |
| `integrity_check` / `foreign_key_check` | node:sqlite | ok / none | P1M-04 |
| Raw re-apply of 0022 outside the `d1_migrations` bookkeeping | node:sqlite | fails at its ALTER (duplicate column); data intact | P1M-05 |
| Schema-23 handoff after upgrade | node:sqlite + workerd D1 | dispatch raises HANDOFF_AUTHORITY_UNVERIFIED; withdraw allowed | P1M-06, P1-W09 |
| Schema-24 Worker against a schema-23 DB (Worker deployed first) | node:sqlite | 503 fail-closed, message names 23 and 24 | P1M-07 |
| Schema-24 Worker on the upgraded historical DB | node:sqlite | health 200, schema 24 | P1M-08 |
| `wrangler d1 migrations apply --local` 0001..0021, then 0022 over the written handoff | workerd D1 | apply 0; schema 24; row identical; DDL equals a fresh install; re-apply is a no-op | P1-W09 |
| `wrangler` applies 0020+0021+0022 in one run over schema-21 data | workerd D1 | schema 24; historical rows identical | R30C-W4 |
| Backup (`VACUUM INTO`) and restore, then replay of the same key on the restored DB | node:sqlite | receipt, lot→handoff link and replay preserved; integrity ok | P1B-14 |

D1 refuses `PRAGMA integrity_check` (SQLITE_AUTH), so integrity is proven on node:sqlite. Backup and restore are proven with SQLite `VACUUM INTO`. Cloudflare D1 Time Travel or export was **not** exercised (BLOCKED_ENV).

## Deployment order (documented only; nothing was deployed)
1. Back up / bookmark D1 (Time Travel).
2. `wrangler d1 migrations apply DB --remote`, which applies 0022 → schema 24.
3. Deploy the schema-24 Worker.

If the order is reversed, the new Worker answers 503 until the migration is applied (P1M-07). An old schema-23 Worker on a schema-24 DB also refuses to run, because it requires an exact schema version. Rolling back to the old Worker therefore needs a D1 restore.

## Behaviour change to note (R30-P1-F)
Handoffs written at schema 23 have no proved signer authority. They can only be withdrawn. A schema-23 ACKNOWLEDGED handoff cannot seed new lots, and it cannot be withdrawn (that is the state machine), so its release needs a new version and a new release. This is intentional fail-closed behaviour. The PR stack is unmerged, so no production rows are affected.
