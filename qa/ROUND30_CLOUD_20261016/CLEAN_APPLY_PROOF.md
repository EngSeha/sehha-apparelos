# Clean-apply proof (ROUND30)

1. `git diff --binary 4e15623 <ROUND30 code commit>` → focused patch (code, migration, tests, UI, QA logs).
2. `git worktree add --detach <scratch>/cleanapply 4e15623` (pristine PR #3 head).
3. `git apply --index --whitespace=error` → **APPLY_OK**. The first attempt was rejected because two raw npm logs ended with a blank line; those were trimmed and the unpushed commit amended before the proof run.
4. Canonical content: `git write-tree` in the clean checkout = `ce9c18315de58a9794f4e57b96e15f6d180df9dd` = tree of the ROUND30 code commit on the branch → **identical**.
5. Fresh install in the clean checkout: `npm ci` (0 vulnerabilities), `npm run check` OK, `npm test` = `ALL_TESTS_PASS suites=27 assertions=705` on Node 22.22.0 and on Node 24.22.0.
6. Patch SHA-256 (code commit `cc2fa11`): `4bc17d0bc929c8e5e500da0a824bd1a961260b6bddf9d9b1861be258f770185f`.
7. The worktree was removed afterwards. PR #2 and PR #3 branches were not modified.
