# Regression and CI (ROUND30)

| Command | Node | Baseline `4e15623` | ROUND30 |
|---|---|---|---|
| `npm ci` | 22.22.0 | 0 vulnerabilities | 0 vulnerabilities (also in clean-apply checkout) |
| `npm run check` | 22.22.0 | exit 0 | exit 0 (now includes `authority.js`, `factory_handoff.js`) |
| `npm test` | 22.22.0 | 26 suites / 623 | **27 suites / 705** |
| `node tests/run_all.mjs` | 24.22.0 | 26 / 623 | **27 / 705** |
| `npm run test:workerd-d1` | 22.22.0 | R29 17/17 | **R29 17/17 + R30 16/16** |
| browser check (local `wrangler dev`) | 22.22.0 | — | **11/11** |
| `npm audit --audit-level=high` | — | 0 | 0 |
| `git diff --check 4e15623 HEAD` | — | — | clean |

## De-duplicated count (final code)
- **Aggregate runner (705):** 539 inherited + 1 new batch07 assertion (requester self-signoff refused) + 17 ROUND28 + 67 ROUND29 + 81 ROUND30.
- **Inherited tests changed, none weakened:**
  - Lot suites (batch13–21, human_*) now walk their directly inserted releases through the real handoff state machine (`admitReleasesForLotFixtures`).
  - batch07 signs with three independent users.
  - R29-T09 expects the earlier and stricter refusal, 401 `ACCOUNT_DISABLED`.
  - R29-T15 checks schema 22 on migrations up to 0020.
  - 19 files received the 0021 migration entry and schema literal 23.
- **Outside the runner:** 33 workerd D1 (17 + 16) + 11 browser = 44 more.
- **PASS 749 · FAIL 0** (local).

## Environment gates (reported separately)
| Gate | Verdict |
|---|---|
| Remote Cloudflare D1 / Worker | **BLOCKED_ENV** |
| HOLD model | **BLOCKED_NO_HOLD_MODEL** |
| Per-cookie session revocation | **BLOCKED_NO_SESSION_STORE** |
| PDF output | **BLOCKED_NO_PDF_ENGINE** |
| GitHub Actions (Node 24) on the ROUND30 PR head | GITHUB_CI_PENDING |
