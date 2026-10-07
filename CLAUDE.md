# SEHHA ApparelOS — Claude Project Instructions

## Ownership
- Product owner: SEHHA IT.
- MOHSEN Fashion Designer is the first professional tenant/workspace, not the software owner.
- Architecture remains multi-tenant and licensing-ready.

## Product principle
SEHHA ApparelOS is an Apparel Product Intelligence Platform. A Style is a Digital Twin, not a PDF. Structured style data is authoritative; outputs are renderers.

## AI/data integrity
- Never invent exact measurements, GSM, fiber composition, shrinkage, zipper length, seam allowance, grading, marker consumption or fabric behavior from a photograph.
- AI claims: OBSERVED / INFERRED / UNKNOWN; applied data remains AI_DRAFT until human approval.
- Never overwrite LOCKED or APPROVED values.
- API keys remain server-side.

## Preview 07 collaboration + release rules
- A Production Release is not automatically a Factory Handoff. Handoff needs role sign-offs + no open MAJOR/CRITICAL reviews + required template completeness.
- Review items are evidence/workflow objects; they never mutate measurements, BOM, pattern or operations automatically.
- Required sign-off roles for Production handoff are DESIGN / PATTERN / PRODUCTION / QC. Enforce membership-role permissions.
- Release-to-release technical changes in DNA/POM/BOM/Pattern/Operations must surface as REVIEW_REQUIRED; never hide them behind a generic version label.
- Template completeness is a presence/structure score only, never a quality, fit or manufacturability score.
- Handoff hashes are consistency evidence, not digital signatures or certificates.
- `SAMPLE` and `PRODUCTION` releases are different gates.
- A Production Release must be sourced from a frozen Style Version.
- Production gate must fail closed on unresolved POM, DNA TBC/UNKNOWN, BOM TBC/UNKNOWN, Pattern errors/warnings, or unapproved Operations.
- `style_releases.snapshot_json` is immutable release evidence; never silently rebuild an old release from current working data.
- Frozen release output must render from the stored release snapshot.
- Manifest hashes are evidence aids, not digital signatures or PKI certificates.
- Garment DNA can be edited by humans, but replacing LOCKED/APPROVED DNA requires explicit `force`.
- `COLOR_ONLY` variants preserve technical/POM locks but reopen BOM as DRAFT.
- `DEVELOPMENT` variants downgrade inherited technical data to DRAFT/INHERITED.
- Marker Study and Production Marker are separate semantic roles.

## Preview 05 rules retained
- Grading is explicit-rule only: base POM + user-entered delta. Missing rule = TBC. No interpolation or auto-grading.
- Weight bands are classification bands, not inferred body/garment measurements.
- Pattern Intelligence stores architecture + relationships + structural validation; it is not CAD geometry.
- Asset annotations are normalized image regions for review; they are not pattern geometry or measurements.
- AI segmentation can propose regions only from visible evidence and stores them as AI_INFERRED / AI_DRAFT.
- `visual_simulation` is a 2D technical review board; never describe it as true drape, fit-pressure or 3D physical simulation.
- `mohsen_techpack` remains the NEXZ-aligned 20-page A4 landscape bilingual master.


## Preview 11–13 sample/cost/production rules
- Sample Round must reference a frozen Style Version; never compare fit against mutable working POM.
- Fit tolerance is explicit only. Missing tolerance means `NO_TOLERANCE`, never an assumed ± value.
- Editing actual sample measurements after approval must revoke sample approval.
- Production Release may combine immutable product spec from the source Version with current approved Sample/Cost evidence, then freeze both in the Release Snapshot.
- Costing never invents consumption, unit price, labor, overhead, waste or currency conversions. Missing input keeps the cost sheet incomplete.
- Any edit to an APPROVED cost sheet reopens it to DRAFT/review.
- Production Lots can only start from a Production Release.
- Lot release is fail-closed until QC evidence exists, all QC checks PASS, and all MAJOR/CRITICAL defects are RESOLVED.
- Defect resolution requires explicit corrective action; root cause/CAPA are human-entered evidence, never AI-generated facts by default.





## Preview 20 report rules
- Production Lot report is a renderer of stored lot/release/planning/execution/QC/reconciliation evidence; it must never mutate source data.
- The report must expose that material cost analytics exclude actual labor/overhead.
- Include the frozen planning basis SHA256 so reviewers can correlate the report with the lot basis.

## Preview 19 material cost analytics rules
- Material cost analytics must use the Production Lot frozen planning basis only; never reprice a historical lot from a later Cost Sheet.
- Actual Material Cost is material-only. Do not label it total production cost or margin because actual labor/overhead are not captured yet.
- Unit costs are explicit approved Cost Sheet facts. Missing unit cost means cost analytics unavailable, never assumed.

## Preview 18 factory authorization rules
- Workspace membership alone is not permission to mutate factory execution. Enforce action-level roles server-side.
- DESIGN/PATTERN roles cannot create production lots, enter QC, or release lots.
- FACTORY_SUPERVISOR/PRODUCTION owns lot creation/planning/execution/material usage and final release, but cannot author QC evidence.
- QC_MANAGER/QC owns QC evidence and defect/CAPA actions, but cannot perform final lot release.
- Owners/platform admins can perform all factory actions for administration/recovery.

## Preview 17 reconciliation/concurrency rules
- Production Lot writes from the UI carry `expectedVersion`; stale versions fail with 409 instead of overwriting newer data.
- Reconciliation is opt-in for backward compatibility. Once started, it is fail-closed until actual output and actual usage for every calculable planned material are recorded.
- Actual usage, scrap and good output are human-entered production facts; never infer them from planned consumption.
- Material variance is calculated against the lot's frozen planning basis, never against a later Cost Sheet.
- Released lots remain immutable for reconciliation as well as planning/execution/QC.

## Preview 14–16 production planning/execution rules
- Production quantity is not a single opaque number when the frozen release contains sizes/colorways: explicit Colorway × Size allocation is required before release.
- Material requirements are calculated only from explicit approved per-unit consumption and waste; no default consumption is allowed.
- Production Lot freezes its approved costing/consumption basis with SHA256. Later costing changes never rewrite historical lot planning.
- Rebase of an OPEN lot planning basis is explicit, audited, and forbidden after Lot Release.
- Operation execution tracking is synced from the frozen Production Release; never rebuild an active lot from mutable working operations.
- When operation tracking is activated, every tracked operation must reach DONE before Lot Release. HOLD is a human decision; other execution statuses are derived from entered progress.
- Released lots are immutable for planning, execution, QC and defect mutation.

## Stack
- Cloudflare Worker
- D1 schema 17
- R2
- Static Assets/PWA
- AI Gateway adapters (Anthropic/OpenAI)
- shared future SEHHA Licensing Core boundary

## Outputs
All generated from the same Style Digital Twin or from a frozen Release Snapshot:
- MOHSEN 20P Tech Pack
- Technical A4
- Pattern/Cutting
- Factory Supervisor
- 2D Visual Simulation Board
- Management Book
- Poster/Social profiles

## Development discipline
- Additive migrations only; no destructive schema shortcuts.
- Never commit `.dev.vars`, provider secrets, or user data exports.
- Run `npm run check` plus the relevant compatibility suites through `npm run test:batch21` after changes; for release checkpoints run the full Batch 04→20 regression.
- Preserve tenant isolation, audit, versions, releases, provenance and frozen snapshot integrity.
- Never mark a release gate PASS without executable evidence.

## Preview 08 dynamic garment template rules

- `mohsen_nexz_20p` is a garment-agnostic 20-page master renderer.
- Never hard-code one garment's measurement codes, pattern codes or closure into shared pages.
- Garment profiles change presentation/checklist semantics only; they do not generate production measurements.
- Special Detail content must come from actual DNA/BOM/operations/assets.
- A jacket may render Morfok only when its structured data supports it; pants/dresses/etc. must not inherit that detail.
- Cut-card pages are driven by registered pattern pieces in sort order.

## Preview 09 blueprint/intake rules

- Garment blueprints are suggestion/checklist structures, never production facts.
- Blueprint application must be explicit, missing-only and idempotent.
- Suggested POM has no numeric values; suggested pattern has no quantity/grain/geometry; suggested BOM has no spec/qty.
- Template suggestions use `TEMPLATE_SUGGESTION` + `TBC` and must block Production until human resolution.
- Intake readiness measures presence of structure/evidence only and must never be presented as fit/quality/production approval.

## Preview 10 Technical Requirements Matrix rules

- Blueprint is suggestion; Requirements Matrix is the explicit human applicability/closure decision layer.
- Applicability values: `REQUIRED`, `OPTIONAL`, `NOT_APPLICABLE`. Closure states: `OPEN`, `SATISFIED`, `WAIVED`.
- Only `REQUIRED + OPEN` may add a Requirements blocker to Production Release. Optional open items are warnings/context, not blockers.
- `NOT_APPLICABLE` and `WAIVED` require an explicit note and must be audited. Never silently convert a blueprint suggestion to N/A or waived.
- Sync from Blueprint must preserve previous human applicability/status decisions on conflict.
- Core requirements may be auto-satisfied by structural evidence (reference/POM/pattern/BOM/operations), but this never bypasses the existing approval/TBC gates for the underlying values.
- Requirements are part of Style snapshots, Versions, Frozen Releases, semantic diff and manifest hashing.
- Legacy Styles without a Requirements Matrix remain backwards compatible until the matrix is explicitly synchronized/created.
- Development variants inherit requirement semantics but reopen applicable requirement decisions for review; N/A decisions remain explicit.


## Preview 21 — Full Actual Cost integrity
- Material actuals, labor minutes/rates, overhead, and good output are human-entered production facts. Never infer them from planned data.
- Full Actual Cost is opt-in. If it is active, Production Lot Release fails closed until material reconciliation, labor for every synced operation, and actual overhead are complete.
- Planned comparison uses only the frozen approved Cost Sheet basis captured for the lot.
- No currency conversion, default labor rate, default minutes, default overhead, or assumed staffing is permitted.
- Released lots remain immutable for labor/overhead reconciliation.
