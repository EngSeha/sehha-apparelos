# D1 and browser results (ROUND30)

## Engines — reported separately, never merged into one claim
| Engine | What it is | Result |
|---|---|---|
| node:sqlite via the D1 adapter | SQLite in Node; `batch()` = BEGIN/COMMIT/ROLLBACK as D1 documents | `npm test` 27 suites / 705 (incl. ROUND30 81) |
| workerd local D1 | `wrangler d1 migrations apply --local` + `getPlatformProxy` (real workerd D1 engine, local) | `npm run test:workerd-d1`: ROUND29 17/17 + ROUND30 16/16 (≈ 2 min 54 s) |
| Remote Cloudflare D1 / Worker | — | **BLOCKED_ENV**: no approved non-production remote D1; nothing remote was created, migrated or deployed |

workerd ROUND30 checks:
- **W1:** schema 23 after migration.
- **W2:** full lifecycle with replays — 3 events, 3 receipts, 3 audit rows; package ETag = SHA-256; lot opened only after ACK with provenance; immutability triggers fire.
- **W3:** 20-way barrier races for prepare and for dispatch — one winner each, no 500.
- **W4:** failure injection at 5 statements — full rollback, sanitized 500.
- **W5:** membership removed inside the commit window — 403, nothing written.
- **W6:** wrangler upgrade 22→23 over legacy rows; schema-23 Worker on a schema-22 D1 → 503; re-running migrations is a no-op.

## Browser (Chromium via Playwright) against local `wrangler dev` (workerd + local D1)
Script: `browser_handoff_check.mjs`; log: `raw/browser_handoff_check.log`; results: `raw/browser_results.json`; screenshots in `raw/`. **11/11 PASS**:
1. empty state ("لا توجد حزم تسليم لهذا الإصدار بعد")
2. double-click on «تجهيز حزمة تسليم» → exactly one request and one package
3. every command carries an Idempotency-Key
4. stale screen: withdrawing a package already dispatched elsewhere → Arabic 409 «حالة الحزمة لا تسمح بهذا الإجراء»
5. after the 409 the panel reloads the persisted HANDED_OFF state
6. the acknowledge control is shown to the dispatcher
7. self-acknowledgement → Arabic 403, no receipt implied
8. «عرض» opens the frozen Arabic RTL package carrying its SHA-256
9. page is RTL
10. a second owner acknowledges; the success message appears only with the persisted ACK
11. the panel states that receipt is not QC signoff or lot approval

Limits:
- **Not a deployed preview.** Users, engineering facts and the hero asset were seeded with `wrangler d1 execute --local` (fixture only).
- **Who acknowledged in the browser:** a second WORKSPACE_OWNER. The FACTORY_SUPERVISOR guided surface has no acknowledge task yet (R30-D12), so a supervisor's ACK is proven through the API and on workerd (R30-T01, R30-W2), not in the browser.
- **Loading state:** shown by disabling the buttons and changing the label while a request is in flight. Not separately timed.
- **PDF:** not produced (`BLOCKED_NO_PDF_ENGINE`). The immutable JSON and HTML package are the verifiable outputs.
