# Integration baseline — 2026-10-07

Recorded before applying Preview 21 source changes.

| Item | Evidence |
|---|---|
| Remote `main` | `b166acc98e12da1e8f562b6e0417de304a4c90fb` |
| Other remote branch | `codex/cloud-ai-github-hardening` at `43ea10e81e356fc15e6d991cd429858d85feebfe`, ancestor of `main` |
| Integration branch | `codex/apparelos-preview21-integration`, created from `main` |
| Starting Git status | clean (`## main...origin/main`) |
| Package version | `0.3.0` |
| Worker version | `0.3.0-cloudflare` |
| Worker expected schema | `4` |
| Migration files | `0002_ai_review_pattern.sql` only; base schema is embedded in `src/worker.js` |
| Tests | No `tests/` directory or test script. `node --check` passed for Worker and app. System `npm` unavailable. |
| Preview 21 ZIP SHA256 | `65FEC11E0D4FFEC6F0E7A48FBBED577E86F6CAFC4B614EEC362822A200F2D3BF` |
| Preview 03→21 source patch SHA256 | `BCCB29BB8950933A8EF5FFEA1D8673BF55E787B3F722C6D74F631E06464FA1EF` |

Critical source SHA256 at baseline:

| File | SHA256 |
|---|---|
| `src/worker.js` | `6A864921053C5CC109B37F32BD008D1EE59F6054F93B0CA263AFFFB76B0234CB` |
| `public/app.js` | `E9BEF740C058BCEF278E92196A5FC67AE03E197A3528179FF3FC6C973B0C42FA` |
| `public/styles.css` | `49A16A7083EA6645CE2BF24252473EDA6B2D86B77DD7A6FEFDA9044D40032B1D` |
| `package.json` | `7B5DF59E2D1076620F8D01A517DC45B7E7679DCA298279BAC20574DCA8E3F510` |
| `wrangler.jsonc` | `CE44CA68EA4BD756D2051872C4D4DBE7E46D59FB3997719E896E9757D33D1BB6` |
| `migrations/0002_ai_review_pattern.sql` | `3F54E82FB023E172E1F704CB941AF688E6AA5303B313A162540256E26C41BA06` |

No Shahd workbook was present in either remote branch, the local project tree, the supplied Preview 21 archive, task attachments, Downloads filename search, or connected Drive searches for `Shahd` and `شهد`. This is a reference blocker, not evidence of workbook contents.
