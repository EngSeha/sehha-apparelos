# UI / browser acceptance — **25 / 25 PASS** (local `wrangler dev`, Chromium via Playwright)

Script: `w01_browser_and_pdf.mjs`. Server: local `wrangler dev` (workerd, local D1 migrated 0001→0023, local R2). Synthetic images only. Results: `raw/w01_browser_pdf_results.json`; screenshots in `screens/`.

| # | Check | Result |
|---|---|---|
| D1 | Vision state shown as `BLOCKED_LIVE_VISION`, never as live | PASS |
| D2 | Uploaded picture listed with its role (role selector: reference / front / back / side / detail) | PASS |
| D3 | Same picture uploaded again is refused (server 409 `DUPLICATE_IMAGE` in the server log); still one asset | PASS |
| D4 | Suggestion labelled MOCK (text only) | PASS |
| D5 | Questions show the start→end landmark definition | PASS |
| D6 | Tolerance saved only where typed (CHEST ±1; others NO_TOLERANCE) | PASS |
| D7 | Description editor saves AR+EN as OWNER_ASSERTION | PASS |
| D8 | Pattern panel: `BLOCKED_PATTERN_INPUTS`, back-view and seam-allowance gaps in Arabic | PASS |
| D9 | 100 mm seam allowance rejected by the server (400), not stored | PASS |
| D10 | Preview: back UNOBSERVABLE / REQUIRES_REVIEW, owner description, sign-off table | PASS |
| D11 | PDF download here: 503 `PDF_ENGINE_UNAVAILABLE` (local Chrome cannot start as root); no HTML as PDF | PASS |
| D12 | No JavaScript errors (desktop) | PASS |
| M1 | Mobile 390×844, khimar 0004: weight band + opening length asked; no S/M/L | PASS |
| M2 | No horizontal overflow at 390 px | PASS |
| M3 | No JavaScript errors (mobile) | PASS |
| P1–P5 ×2 | Independent A4 PDF of the frozen preview (see `TECHPACK_PDF_ACCEPTANCE.md`) | PASS |

Also fixed: the shared `api()` helper dropped the server `code`, so the PR #6 "data changed elsewhere" (`STALE_VERSION`) message never showed; it now does.

Not covered here: approval through the UI with a real frozen PDF (needs the BROWSER path, BLOCKED_ENV in this container) and live-vision UI states with a real model (BLOCKED_LIVE_VISION).
