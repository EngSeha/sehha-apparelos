# SEHHA ApparelOS — Cloudflare Architecture Preview 07

```text
Browser / PWA
   │
   ├── Static Assets
   └── /api/*
        ▼
Cloudflare Worker
   ├── Auth / Tenant / Entitlements / Audit
   ├── Style Digital Twin (working state)
   │    ├── Garment DNA
   │    ├── POM / BOM / Operations / Colorways
   │    ├── Size & Weight Bands + explicit grading rules
   │    ├── Pattern Pieces + Relationships + Validation
   │    ├── Image Regions / Annotations
   │    ├── Versions + Variants
   │    └── Technical Review Items
   ├── Release Workflow
   │    ├── SAMPLE / PRODUCTION Gate
   │    ├── Frozen source Version
   │    ├── Frozen Release Snapshot
   │    ├── SHA256 Export Manifest
   │    ├── Release-to-Release Semantic Diff
   │    ├── DESIGN / PATTERN / PRODUCTION / QC Sign-offs
   │    └── Factory Handoff Gate + Handoff SHA256
   ├── AI Gateway
   │    ├── Anthropic / OpenAI
   │    ├── Multi-image consensus/conflicts
   │    └── Visible-region suggestions -> AI_DRAFT
   ├── Output Studio / Template Registry
   │    ├── MOHSEN NEXZ-aligned bilingual 20P Tech Pack
   │    ├── 20-page completeness validator
   │    ├── Technical / Cutting / Factory / Management
   │    └── 2D Visual Simulation Board
   ├── D1 (schema 9)
   │    ├── core style / bilingual technical tables
   │    ├── size_bands / grading_rules
   │    ├── pattern_pieces / pattern_links
   │    ├── asset_annotations
   │    ├── style_versions / style_variants / style_releases
   │    ├── review_items / release_signoffs
   │    └── ai_runs / audit / entitlements
   └── R2 assets
```

## Integrity boundaries
- Production Release = frozen technical state; Factory Handoff = separate collaboration/approval gate.
- Review items never mutate POM/BOM/Pattern automatically.
- Sign-offs are role-scoped and audited.
- Template completeness measures presence of expected content only; it is not a fit/quality score.
- Release comparison is computed from frozen snapshots, not live working rows.
- Handoff SHA256 is evidence of payload consistency, not a digital signature/PKI certificate.

## Migration
`0006_factory_collaboration.sql` is additive and moves schema 7 -> 8. Existing releases remain immutable and are preserved.

## Deployment re-gate
Before production deployment, independently run Cloudflare D1/R2 through `wrangler dev`/Preview and one controlled provider call with deployment secrets. Local mocks remain executable verification, not a substitute for the final Cloudflare deployment gate.
