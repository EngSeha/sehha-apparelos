# Source custody — ROUND29 (Claude Code Cloud, 2026-10-16)

| Item | Verified value | How verified |
|---|---|---|
| Repository | `EngSeha/sehha-apparelos` (remote URL carries no credentials) | `git remote -v` |
| Modern product base | `codex/apparelos-preview21-integration` @ `9bcd13d6` (PR #1, draft, open) | `git ls-remote`, GitHub API |
| PR #2 (ROUND28) | head `claude/lucid-brahmagupta-qneojw` @ `c779d485`, base `codex/apparelos-preview21-integration` @ `9bcd13d6`, draft, open, not merged, mergeable_state=clean, 16 files / +115 −9 | GitHub `pull_request_read` |
| PR #2 CI | GitHub Actions run 38834352823 (`CI`, Node 24, `npm ci && npm run check && npm test`) = **success** on `c779d48` | GitHub `actions_list` |
| Drift vs. ROUND28 report | **None.** Head SHA, base, file count and CI result match the report. | — |
| ROUND29 branch | `claude/round29-atomic-release`, created from `c779d48` (stacked on PR #2) | `git checkout -b … c779d48` |
| `main` | `b166acc` (Preview 03), untouched | `git ls-remote` |
| Pre-existing local changes | none (`git status --porcelain` empty before work) | — |
| Instruction files | `CLAUDE.md` (re-read this session); no `AGENTS.md` exists | `ls` |
| Toolchain | Node v22.22.0 (container) and Node v24.22.0 (official tarball, SHA256 verified against nodejs.org SHASUMS256); npm 10.9.4; wrangler/miniflare/workerd from `package-lock.json` | `node -v`, `sha256sum -c` |

## Baseline reproduced before any edit (on `c779d48`)
- `npm ci` → 0 vulnerabilities. `npm run check` → exit 0.
- `npm test` → `ALL_TESTS_PASS suites=25 assertions=556` on Node 22.22.0 (10.7 s) **and** Node 24.22.0 (9.0 s).
- `npm audit --audit-level=high` → 0 vulnerabilities.
- Raw logs: `raw/baseline_*.log`.
