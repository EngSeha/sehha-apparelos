# Migration check — `migrations/0020_release_atomicity.sql` (schema 21 → 22)

Additive only: 2 nullable columns on `style_releases` (`evidence_contract`, `candidate_sha256`), 1 partial UNIQUE index, 1 table (`release_receipts`), 1 index, 5 triggers, `schema_version=22`. No DROP, no data rewrite, no applied migration edited. Number chosen after verifying the modern branch ends at `0019_human_store.sql`.

| Check | Engine | Result | Test |
|---|---|---|---|
| Fresh install 0001→0020 | node:sqlite | schema 22; table + partial unique index + 5 triggers present | R29-T15#1 |
| Fresh install via `wrangler d1 migrations apply DB --local` | workerd D1 | all 20 ✅ | R29-W2 + manual run |
| Upgrade 21→22 over two historical PRODUCTION rows for the same (style, version) | node:sqlite | succeeds; legacy rows byte-identical; new columns NULL | R29-T15#2 |
| Same upgrade via wrangler (0001–0019 applied, rows inserted, then 0020) | workerd D1 | succeeds; rows identical; 7 objects present | R29-W1#1 |
| Re-run of wrangler migrations | workerd D1 | "No migrations to apply" (tracked in `d1_migrations`) | R29-W1#2 |
| Raw re-execution of 0020 SQL | node:sqlite | fails at first `ALTER TABLE` (duplicate column) with data and schema_version intact | R29-T15#3 |
| Legacy rows remain maintainable (triggers only bind contract rows) | node:sqlite | UPDATE of a legacy row allowed | R29-T15#3 |
| Triggers enforced on contract rows | node:sqlite + workerd D1 | UPDATE/DELETE of release, receipt, version snapshot aborted with `*_IMMUTABLE` | R29-T11#4, R29-W3#4 |
| Backup/restore of a contract release + receipt into a fresh schema-22 DB | node:sqlite | bytes and hash preserved | R29-T11#5 |

Operational notes
- `SCHEMA_VERSION` in `src/worker.js` is now `'22'`; a Worker deployed before `db:migrate:remote` returns 503 (existing behaviour of `ensureDatabaseReady`). **Apply the migration before deploying the Worker.** App version string stays `0.21.0-cloudflare`.
- Remote D1: **not executed** (no approved non-production remote database). Remote apply must be done by the owner with `npm run db:migrate:remote` after review; take a D1 Time Travel bookmark first.
- 19 test files were updated only to list `0020_…` in their migration arrays and to expect schema `22` (no assertion was removed or weakened).
