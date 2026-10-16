# Source and PR chain — ROUND30 (Claude Code Cloud, 2026-10-16)

| Item | Verified value (live, before editing) |
|---|---|
| Repository | `EngSeha/sehha-apparelos` (remote URL carries no credentials) |
| `main` | `b166acc` (Preview 03) — untouched |
| PR #1 | `codex/apparelos-preview21-integration` @ `9bcd13d`, draft, open |
| PR #2 | head `claude/lucid-brahmagupta-qneojw` @ `c779d48`, base PR #1 branch, draft, open, no reviews |
| PR #3 | head `claude/round29-atomic-release` @ `4e15623`, base `claude/lucid-brahmagupta-qneojw` @ `c779d48`, draft, open, mergeable_state=clean, no reviews / review threads |
| PR #3 CI on `4e15623` | GitHub Actions run 38839414093 = **success** (Node 24: check, 26 suites / 623, workerd D1 17/17) |
| Independent review of PR #2 / #3 | **none exists** (GitHub reviews and review threads are empty) |
| Drift vs. the ROUND30 brief | none — `9bcd13d` / `c779d48` / `4e15623`, migration `0020`, schema 22 all match |
| ROUND30 branch | `claude/round30-factory-handoff`, created from `4e15623`; Draft PR targets `claude/round29-atomic-release` (PR #3) |

Ancestry: `main` ← #1 (`9bcd13d`) ← #2 (`c779d48`) ← #3 (`4e15623`) ← ROUND30. Nothing was rebased, merged, force-pushed or deployed.

## Baseline reproduced on `4e15623` before any edit (logs in `raw/`)
- `npm ci` 0 vulnerabilities · `npm run check` exit 0
- `npm test` = `ALL_TESTS_PASS suites=26 assertions=623` on Node 22.22.0 **and** Node 24.22.0
- `node tests/round29_workerd_d1.mjs` = 17/17 PASS (workerd local D1)
- `npm audit --audit-level=high` = 0
