# Product completion baseline — 2026-10-07

This record captures the checkout before the product completion directive. The working tree and index were clean.

| Item | Baseline |
| --- | --- |
| Current branch | `codex/apparelos-preview21-integration`, tracking `origin/codex/apparelos-preview21-integration` |
| HEAD | `651ed25b22f295655ddb69682298a2837c808189` |
| `main` | `b166acc98e12da1e8f562b6e0417de304a4c90fb` |
| Product | Preview 21 (`0.21.0-cloudflare`) |
| Expected schema | 17, via `0001_init.sql` through `0015_full_actual_cost.sql` |
| Changed files already committed versus `main` | 112; Preview 21 source, migrations, tests, CI, asset security, UI fixes, integration/reference documentation |
| Tests | 20 test script suites, 438 assertions; `npm run check`, local D1 migration, Workerd/D1/R2 smoke, and Wrangler dry run passed |
| Current blockers | `BLOCKED_EXTERNAL_R2_ACCOUNT_ENABLEMENT`; `EXCEL_REFERENCE_NOT_PROVIDED`; product domains such as first-class fabric/marker/pattern geometry/routing remain incomplete |
| Cloudflare | CLI authenticated; remote D1 list empty; R2 bucket list rejected with account code 10042 (R2 enablement required). No remote preview deployed. |
| Git delivery | Integration branch pushed. Pull request to `main` pending at baseline. No merge performed. |

The two NEXZ PDF tech packs are available as references. They do not establish the missing Shahd Excel workbook or unknown production facts. Preview 21 has already been applied; it must not be reapplied.
