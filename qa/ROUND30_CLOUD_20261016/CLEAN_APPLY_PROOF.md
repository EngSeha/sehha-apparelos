# Clean-apply proof (ROUND30)

1. `git diff --binary 4e15623 <ROUND30 code commit>` → focused patch (code, migration, tests, UI, QA logs).
2. `git worktree add --detach <scratch>/cleanapply 4e15623` (pristine PR #3 head).
3. `git apply --index --whitespace=error` → **APPLY_OK**. The first attempt was rejected because two raw npm logs ended with a blank line; those were trimmed and the unpushed commit amended before the proof run.
4. Canonical content: `git write-tree` in the clean checkout = `ce9c18315de58a9794f4e57b96e15f6d180df9dd` = tree of the ROUND30 code commit on the branch → **identical**.
5. Fresh install in the clean checkout: `npm ci` (0 vulnerabilities), `npm run check` OK, `npm test` = `ALL_TESTS_PASS suites=27 assertions=705` on Node 22.22.0 and on Node 24.22.0.
6. Patch SHA-256 (code commit `cc2fa11`): `4bc17d0bc929c8e5e500da0a824bd1a961260b6bddf9d9b1861be258f770185f`.
7. The worktree was removed afterwards. PR #2 and PR #3 branches were not modified.

## Closure re-check (proven source `4e15623` → closure code commit `859fad5`)
| Scope | Method | Result |
|---|---|---|
| **Code + evidence** (full delta, including `qa/ROUND30_*` as of `859fad5`) | `git apply --index --whitespace=error` on a pristine `4e15623` worktree, then `git write-tree` | tree `2e01eb273d0e13b88cf655d36edb1cff119f5c59` = branch tree of `859fad5` → **identical** |
| **Code only** (every path outside `qa/`) | separate pristine worktree, apply the delta excluding `qa/`, compare `mode blob path` listings | **157 paths identical**, listing SHA-256 `4d6a5224b05a594802779ef5f48d8b09b46ee8b05b828f3c3083904dc453d34d` |
| Code-only checkout runs on its own | fresh `npm ci` (0 vulnerabilities), `npm run check`, `npm test` on Node 22.22.0 and 24.22.0; that checkout contains **no** ROUND30 evidence folder | **28 suites / 836** on both |

Patch SHA-256:
- full: `4295a199c755b4789b6894d314b9544c8604923a2f35f02d4604182b7a0fe4f9`
- code-only: `1daf7e860dce09242cd66da67ff176b47daa135bde2fc0fa9eb9b8d09b1c963a`

**What the proof covers:** the tree-identity proof covers code **and** evidence up to `859fad5`. The code-only proof covers everything outside `qa/` and shows that the tests do not depend on evidence files. The later evidence-only commits are not part of the tree proof; their integrity is covered by `SHA256SUMS.txt`, regenerated and verified after the last edit. Both worktrees were removed afterwards.
