# Clean apply proof — from the sealed `5f928e2`

| Scope | Method | Result |
|---|---|---|
| Code + tests + scripts (full commit `2740a9d`) | fresh clone, `git checkout --detach 5f928e2`, `git apply --index` of `git diff --binary 5f928e2 2740a9d` | tree `a422f6315a9552c9ee8fd7ba770856e0788f8555` == branch tree of `2740a9d` |
| Code only (everything outside `qa/`) | separate fresh clone, patch with `':(exclude)qa'` | all 160 paths outside `qa/` identical in mode, blob and path. Listing hash (`mode blob path`, sha256) `480bcc04dcea249edc9c7b38ef93fe29fbb6122bc4bf7fbad6bb56978f7b4121` |
| Code-only clone runs on its own | fresh `npm ci`, then `npm test` | 29 suites / 925 on Node 22.22.0 and Node 24.22.0 (raw/clean_apply_code_test_node22.log, raw/clean_apply_code_test_node24.log). The clone holds no ROUND30_P1 evidence, so code and tests do not depend on `qa/`. |
| Upstream evidence untouched | `git diff 5f928e2 HEAD -- qa/ROUND28_CLOUD_20261016 qa/ROUND29_CLOUD_20261016 qa/ROUND30_CLOUD_20261016` | 0 lines. `qa/ROUND30_CLOUD_20261016/SHA256SUMS.txt` and `qa/ROUND29_CLOUD_20261016/SHA256SUMS.txt` verify OK. |
| This evidence folder | `SHA256SUMS.txt` | covers every file in this folder except itself; verified after the last edit |

The evidence commit that adds this folder comes after `2740a9d` and is outside the code proof. Its integrity is shown by `SHA256SUMS.txt`.
