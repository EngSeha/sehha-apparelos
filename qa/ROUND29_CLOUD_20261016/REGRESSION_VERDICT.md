# Regression verdict — ROUND29

## Commands actually run (logs in `raw/`)
| Command | Node | Before (c779d48) | After (ROUND29) |
|---|---|---|---|
| `npm ci` | 22.22.0 | 0 vulnerabilities | — |
| `npm run check` | 22.22.0 | exit 0 | exit 0 (now also checks `src/production_release.js`) |
| `npm test` | 22.22.0 | 25 suites / 556 assertions PASS (10.7 s) | **26 suites / 623 assertions PASS** |
| `node tests/run_all.mjs` | 24.22.0 (nodejs.org tarball, SHA256 verified) | 25 / 556 PASS (9.0 s) | **26 / 623 PASS** |
| `npm audit --audit-level=high` | — | 0 | 0 |
| `git diff --check` | — | — | clean |
| `npm run test:workerd-d1` (workerd local D1 via wrangler) | 22.22.0 | n/a | **17 / 17 PASS** (~85 s) |
| `qa/ROUND29_CLOUD_20261016/browser_release_check.mjs` (Chromium vs local `wrangler dev`) | 22.22.0 | n/a | **7 / 7 PASS** |

## De-duplicated count
- Aggregate runner: 623 unique PASS assertions = 539 inherited (unchanged count; 19 files changed only their migration list / schema literal "21"→"22", 4 files moved the engineering fixture before version creation) + 17 ROUND28 (re-based onto frozen versions; same intents) + 67 ROUND29.
- Outside the runner: 17 workerd D1 + 7 browser = 24 additional, not double-counted.
- **PASS 647 · FAIL 0** (final code). History: the first push (068c257) failed GitHub CI at R29-W5 — a real idempotency race defect (R29-F13), fixed and re-proven; see DEFECT_LEDGER.md.

## Separately reported environment gates
| Gate | Verdict | Note |
|---|---|---|
| Remote Cloudflare D1 / Worker | **BLOCKED_ENV** | no approved non-production remote D1; nothing remote created or migrated |
| GitHub Actions on PR #3 | **FAIL → PASS** | run 38838696311 on `068c257` failed at R29-W5 (real defect R29-F13); run 38839253855 on the fix `5a51d4a` = success (Node 24: check, 26/623, workerd D1 17/17) |
| Browser | **PASS (local)** | local workerd + local D1 only; not a deployed preview |
| HOLD / maintenance races | **BLOCKED_NO_HOLD_MODEL** | product has no such state |
| Per-session revocation | **BLOCKED_NO_SESSION_STORE** | stateless HMAC sessions |

## Focal verdict
All mandatory focal invariants were proven locally on two engines (node:sqlite through the D1 adapter, and workerd D1):
- one authoritative transition
- release, receipt, status and audit are atomic
- legitimate retries are idempotent
- the same key with a different payload is 409
- under a barrier race, exactly one request commits
- an expected race never returns 500
- negative authorization and failure injection behave as specified
- frozen-version readiness holds

→ **FOCUSED_PASS** for ROUND29 scope. Production pilot remains **BLOCKED** (remote D1/Worker, deployed browser, Handoff→Lot authority chain).
