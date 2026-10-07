# Shahd workbook reference and mapping status

`BLOCKED_REFERENCE_SHAHD_EXCEL` — the original Excel workbook has not been supplied or found. No workbook fingerprint, sheet names, formulas, dropdowns, units, or cell mapping can be asserted.

## Discovery performed on 2026-10-07

- Inspected every fetched Git branch and filenames across Git history.
- Searched the project workspace, task attachments, Documents and Downloads for `.xlsx`, `.xls`, `.csv`, `Shahd`, and `شهد`.
- Inspected the filenames inside 38 local ZIP archives, including Preview 21 and earlier ApparelOS deliveries.
- Searched connected Google Drive for `Shahd`, `شهد`, `ApparelOS`, and `NEXZ`; no results were returned.
- Found two NEXZ PDF references created by Shahd. They are **PDF examples, not the missing workbook**.

## Verified secondary references

| Source | SHA256 | Verified structure |
|---|---|---|
| `Jacket tech pack NEXZ.pdf` | `EE0034C685D2D7076063954ADDFD445A7A9D6E691580E303751EB54B95EE6E6E` | 9 pages: cover; technical front/back; colored illustration; color collection; design details; size measurement table; material specifications; two operation bulletin pages. |
| `Pants tech pack NEXZ.pdf` | `91ADA12DB1FBA85DA98714A95BC3DDD5AC72EB978B947A1C0E63B665E7C465BD` | 9 pages with the same broad sequence; pants-specific construction and measurements. |

These are source-specific examples. Jacket closures, pocket construction, and jacket POM must not be seeded into pants or other garment families.

## Mapping that can be established from the PDFs

| PDF concept | Canonical ApparelOS model |
|---|---|
| Style identity and garment type | `styles`, frozen style/version identity |
| Technical views and colored illustration | `assets` with explicit view/role |
| Color collection | `colorways` |
| Design and construction details | `dna_items`, `style_requirements` |
| Measurement table by size | `measurements`, `size_bands`, approved `grading_rules` where actual rules are supplied |
| Fabrics, threads, and trims | `bom_items`; a controlled fabric library still requires a separate implementation |
| Operation bulletin, machine, stitch | `operations`, frozen release operations, lot operation progress |

The PDFs do not establish the Shahd workbook's sheets, cells, formulas, validations, links, or round-trip semantics. A source-specific Excel adapter and acceptance fixture remain blocked until the workbook is provided.
