# Testing

Unit tests cover cell sanitization, date/currency/number normalization and arithmetic validation. Integration tests cover parser behavior and the upload UI. `e2e/smoke.spec.ts` runs against the production build in a real browser: it checks the shell, uploads a synthetic PDF through to the review screen, and checks that a corrupt PDF produces a visible error.

Run:

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium   # once
npm run test:e2e
npm run build
```

The requested synthetic PDF fixture strategy uses `pdf-lib` in development/test tooling rather than committing binary PDFs. Fixture coverage should include basic, GST, multi-page, discount, missing-field, malformed and empty PDFs as the fixture suite is expanded.

Regression coverage: `parser.test.ts` builds positioned spans (as pdf.js returns them) so that label/value parsing is tested on real line structure, including side-by-side header fields, label/value columns, CGST/SGST, per-party GSTIN, descriptions containing digits, and ambiguous dates.

## Suites (1.1.0)

| File | Covers |
| --- | --- |
| `unit/textLines.test.ts` | Row and cell building, page separation. |
| `integration/parser.test.ts` | Labels, label-above, GST columns, tax-inclusive totals, multi-invoice splitting, OCR marking. |
| `unit/batchStore.test.ts` | Queue order, failures, scanned parking and OCR retry, multi-invoice expansion, removal during processing. |
| `unit/exportModel.test.ts` | Sheet model, status and notes, tax grouping, formula sanitization in every sheet, CSV quoting and BOM, JSON. |
| `unit/summary.test.ts` | KPIs and duplicate detection. |
| `unit/analysis.test.ts` | Review policy. |
| `unit/seo.test.ts` | Title and description limits, canonical URLs, JSON-LD mirrors the FAQ, honest OCR claims, `llms.txt`. |
| `e2e/smoke.spec.ts` | Real browser: upload, batch dashboard, review, error handling. |

Manual check with the files in `samples/`: drop all of them at once, confirm six invoices, one scanned row and the combined Excel opens with six sheets.
