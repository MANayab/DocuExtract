# Architecture

The application is a static Vite bundle. React owns the UI. PDF parsing is done by pdf.js, which runs its parser in its own dedicated Web Worker (bundled locally, no CDN), so the UI thread stays responsive.

## Pipeline

`file selection -> validation -> BatchStore queue (one file at a time) -> pdf.js text spans -> visual rows and cells -> [OCR when requested] -> split invoices -> header fields (same line or label above) -> line items (header-aligned columns, tax roles) -> locale-aware normalization (selected locale) -> Zod and arithmetic validation -> review status -> dashboard / review -> export`

## Locale handling

`config/locales.ts` defines supported locale codes, date order, decimal separator, grouping separator and grouping pattern. The selected locale is passed into header and line-item numeric parsing and invoice date normalization. Locale does not determine currency. Invalid or ambiguous values must be surfaced for human review; reprocessing and export integration remain incomplete until the locale parsing work is fully verified.

## Modules

| Area | Path | Notes |
| --- | --- | --- |
| Layout | `features/pdf/textLines.ts` | Spans to rows and cells; column gap = two spaces; page-aware. |
| Extraction | `features/extraction/*` | `fieldDetector` (labels, label-above), `tableDetector` (roles: qty, rate, amount, taxable, tax rate, tax amount), `splitInvoices`, `ocrMarking`. |
| OCR | `features/ocr/ocrEngine.ts`, `scripts/prepare-ocr-assets.mjs` | Pages rendered by pdf.js, words recognised by Tesseract in its own worker, converted back to spans. |
| Pipeline | `features/pipeline/processPdf.ts` | One PDF in, N invoices out (or "needs OCR"). |
| Batch | `features/batch/batchStore.ts`, `summary.ts` | Framework-free store (testable) read through `useSyncExternalStore`; KPIs and duplicate detection. |
| Review policy | `features/validation/analysis.ts` | Validation plus the reasons that make an invoice "Review"; memoised per invoice object. |
| Export | `features/export/workbookModel.ts` + `xlsxExporter`, `csvExporter`, `jsonExporter` | One sanitized sheet model feeds every format. |
| Content and SEO | `content/site.ts`, `content/seo.ts`, `vite.config.ts` plugin | One source for visible copy, JSON-LD and pre-rendered HTML. |

ExcelJS (about 0.9 MB), Tesseract and the pdf.js text extractor are loaded on demand. There is no application backend or persistent invoice store. `base: '/DocuExtract/'` makes the bundle compatible with a GitHub Pages project site.
