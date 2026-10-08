# BATCH 06 — Acceptance Results

**Date:** 2026-10-04
**Target:** Developer Preview 06 / schema 7

## Executable results

| Gate | Result |
|---|---|
| `npm run check` | PASS |
| Batch 04 regression | PASS |
| Batch 05 regression | PASS |
| Batch 06 integration | PASS |
| schema 6 -> 7 upgrade | PASS |
| Preview 03 schema 4 -> Preview 06 schema 7 cumulative upgrade | PASS |
| historical schema 5 -> 6 upgrade | PASS |
| Preview 06 health reports schema 7/version 0.6 | PASS |
| tenant isolation on Release Center | PASS |
| frozen Sample Release immutability | PASS |
| Production blocked while TBC remains | PASS |
| LOCKED DNA refuses overwrite without force | PASS |
| human closure of DNA/BOM/Pattern | PASS |
| Pattern Validation reaches clean READY | PASS |
| frozen Version V2 created | PASS |
| Production Gate becomes READY | PASS |
| Production Release created from V2 | PASS |
| frozen Production Release renders exactly 20 pages | PASS |
| Revision Compare | PASS |
| Color-only Variant semantics | PASS |
| Development Variant semantics | PASS |
| audit evidence | PASS |
| source secret scan | PASS — no `.dev.vars`, no high-risk secret pattern |

## PDF visual proof

Generated a frozen **Production Release** Tech Pack and verified it with the PDF render workflow:
- Pages: 20
- Page size: A4 Landscape (`841.89 x 595.276 pt`)
- Arabic: visually connected/readable in inspected renders
- Pages inspected at full render: 7 Measurement Map, 14 Morfok, 20 Final Approval
- Montage inspected for all 20 pages
- No observed clipping/overlap on inspected proof

WeasyPrint reports unsupported screen-only CSS declarations (`vh`, grayscale filter, screen media rule); they do not change the verified 20-page print layout.

## Production release proof sequence

1. Initial Production Gate is BLOCKED by unresolved DNA/BOM/Pattern facts.
2. Human editor closes test-fixture facts explicitly.
3. Pattern metadata becomes APPROVED and a valid relationship is registered.
4. Pattern Validation becomes READY with zero errors/warnings.
5. Version V2 is frozen.
6. Production Gate becomes READY with zero blockers.
7. Production Release R2 is created from V2 in integration test.
8. Frozen R2 Tech Pack renders exactly 20 pages.

The visual fixture independently creates an approved Production Release R1 in a fresh in-memory environment and exports its 20-page frozen output.

## Deployment gates not claimed

Direct Preview 03 -> Preview 06 migration proof preserves legacy Style, LOCKED POM, Pattern row and Version while adding all schema 5/6/7 tables.

The following remain external deployment re-gates, not local PASS claims:
- live Cloudflare `wrangler dev`/Preview D1/R2 behavior;
- remote production migration;
- one real Anthropic/OpenAI request with deployment secrets;
- actual GitHub push/PR/merge.

## Verdict

**READY FOR INDEPENDENT RE-GATE**
