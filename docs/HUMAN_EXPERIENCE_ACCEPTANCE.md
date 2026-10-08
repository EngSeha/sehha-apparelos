# Human Experience acceptance — 2026-10-08

## Current decision

**Partial acceptance for a local guided demo; production pilot remains blocked.** This layer shares ApparelOS's existing users, styles, production lots, operation progress, quality checks, defects, assets, and frozen approved cost basis. It does not create a second release path. Role is checked on the server; the stored view preference cannot grant permissions.

## Persona matrix

| Persona | Primary tasks | Max complexity | Tested | Result |
| --- | --- | --- | --- | --- |
| Basic Operator (sewing) | Open assigned operation, record good/rejected quantity, request correction | One task screen; quantity and save | Local browser recorded 50 of 100; server tests cover assignment, authorization, idempotency, version conflict, correction | **Pass for quantity entry**; no start/pause control yet |
| Cutting Worker | See assigned operation and record quantity | One task screen | Local demo account seeded; shared operator route tested | **Partial**; marker, fabric, ply count, and cut confirmation are not in the guided screen |
| QC Inspector | Open assigned queue, answer three questions per piece, classify defect and severity, attach photo | One inspection screen | Local browser saved a critical sewing defect with photo; server tests cover evidence, assignment, idempotency | **Pass for guided piece inspection**; full inspection taxonomy pending |
| Store Clerk | Receive, issue, and return material for an assigned lot | One movement screen | Local browser received 25.5 m and issued 10 m; server tests cover stock bounds, return bounds, unit precision, idempotency | **Pass for lot allocation movements**; warehouse-wide inventory and roll tracking pending |
| Supervisor | See exceptions first, assign production/QC/store tasks, open a lot for investigation | Home plus technical detail | Local browser reviewed a critical defect, clicked through to the exact production lot, and returned to guided home; server tests cover correction-request surfacing and role restriction | **Partial**; line capacity, delays, missing evidence, and correction-resolution action pending |
| Designer | Use existing professional style/engineering screens | Existing professional navigation | Role mapping and professional route regression tests; no new design UX acceptance session | **Partial**; professional depth preserved but no persona usability validation |
| Pattern Master | Use existing professional pattern/engineering screens | Existing professional navigation | Local demo account seeded; role mapping tested; no new guided pattern session | **Partial**; no pattern-specific human workflow |
| Admin | Use existing expert screens and audits | Existing expert navigation | Existing authorization regression tests; no new admin UX acceptance session | **Partial**; full endpoint permission audit pending |

## Tested daily paths

1. Operator: sign in → assigned task → enter `50` → save. The task shows `50 / 100` and a remaining quantity. A repeated request key cannot add the same quantity twice. A non-assignee cannot submit. Historical edits require a correction request.
2. QC: sign in → assigned QC task → answer measurement, sewing, and visible-defect questions → classify a critical sewing defect → attach a photo → save. The record uses the canonical quality-check and defect tables; critical evidence is required.
3. Store: sign in → assigned receipt → enter `٢٥٫٥` m → save → assigned issue → enter `10` m → save. The lot balance became 15.5 m, and net issued became 10 m. The unit comes from the approved frozen material basis. No negative stock or excess return is permitted. The movement ledger uses integer milliunits and an atomic version update.
4. Supervisor: sign in → exception-first home → see task assignment controls and read-only task detail. Held operations and unresolved critical defects carry a human title, reason, owner, and route into the production lot. The browser opened the demo critical defect's exact lot and showed its CAPA item, then returned to the guided home.
5. Search: on the assigned-task home, partial lot text returns matching cards, and nonmatching text hides them. Search also indexes style code, model name, customer, operation, material, and source reference **where those fields exist**. Scanner keyboards can enter those values in the search field. Assigned task URLs support `task`, `qcTask`, and `storeTask` deep links; camera QR decoding and printed code issuance remain pending.
6. Preference: compact/comfortable density persists per user. Last workspace and permitted supervisor simple/professional view persist. Arabic is the implemented human UI language. An `en` preference can be stored, but translated guided screens are not implemented yet.

The local integration runner returned `ALL_TESTS_PASS suites=24 assertions=539` after migrations 0017–0019 and the human routes. `node --check` passed for new worker and UI modules. Existing Preview 04–21 and upgrade suites remain included.

## Local demo setup

1. Apply migrations 0017, 0018, and 0019 to **local** D1: `node_modules/.bin/wrangler.cmd d1 migrations apply DB --local`.
2. Set a temporary `SEHHA_HUMAN_DEMO_PASSWORD` in the local shell and run `node scripts/seed_human_demo_local.mjs`. The script refuses to run without that variable and uses Wrangler `--local` only.
3. Run `node_modules/.bin/wrangler.cmd dev --local` and sign in with `cutting@human-demo.local`, `sewing@human-demo.local`, `qc@human-demo.local`, `store@human-demo.local`, `supervisor@human-demo.local`, or `pattern@human-demo.local` and the temporary password.

The seed contains synthetic `LOCAL-DEMO` production records, including a synthetic release and approved cost basis, for UI verification. They are not approved production facts. Do not run this seed against remote or production D1.

## Remaining acceptance gaps

- Guided cutting, packing, bundle/fabric-roll/sample workflows; start/pause/finish control; line and delay intelligence.
- Camera QR/barcode scanning, code generation, thumbnail/operation imagery, and full low-literacy visual QA.
- Guided multi-step material consumption/waste flow and warehouse-wide stock accounting. Current store balance is **per lot and material**.
- Full user-facing blocker mapping across engineering screens, customer-ready English localization, and resolution of surfaced correction requests with an audited decision.
- Remote preview and production security review. The Cloudflare account's R2 provisioning is still blocked externally; no remote deployment or migration was performed for this work.

The production pilot gate remains **blocked** until these workflow, authorization, and remote-environment gaps are resolved and retested with actual factory users.
