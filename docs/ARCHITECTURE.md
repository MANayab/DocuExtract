# Architecture

The application is a static Vite bundle. React owns the UI. PDF parsing is done by pdf.js, which runs in its own dedicated Web Worker (bundled locally, no CDN), so the UI thread stays responsive.

## Pipeline

`file selection -> validation -> BatchStore queue (one file at a time) -> pdf.js text spans -> visual rows and cells -> [OCR when requested] -> split invoices -> header fields (same line or label above) -> line items (header-aligned columns, tax roles) -> locale-aware normalization -> Zod and arithmetic validation -> review status -> dashboard / review -> export`

## Locale handling

`config/locales.ts` defines supported locale codes, date order, decimal separator, grouping separator and grouping pattern. The selected locale is passed into header and line-item numeric parsing and invoice date normalization. Locale does not determine currency. An unrecognized currency marker produces a low-confidence INR fallback with an explicit review warning; it is not invoice evidence. Reprocessing and all four export formats are implemented, but remain subject to the synthetic benchmark and human review limitations in `docs/COMMERCIAL_READINESS.md`.

## Offline PWA

The production build emits a versioned precache manifest from content-hashed Vite assets and generated PDF.js standard-font files. The build ID combines the package version, asset filenames and service-worker source fingerprint. The service worker uses separate versioned shell and per-language OCR caches. OCR model requests are cached only after the user selects or uses that language online.

Previous shell caches are retained during update activation so already-open tabs can still request their old hashed chunks. The worker searches across shell caches for those immutable assets. This is a safety-first retention strategy; old caches can accumulate until browser site data is cleared. The app reports Offline ready only when the active controller and current build's shell cache are both present.

Invoice PDFs, extracted data, corrections and exports are not intended to enter Cache Storage or persistent browser storage. See `PRIVACY.md` for the boundary and its remaining verification gaps.

## Seller matching profiles

Profiles are saved locally only after explicit consent and match on seller name keys. Tax IDs and numeric/contact identifiers are excluded from the stored schema. The current parser does not consume custom field/table reading rules; the UI reports a seller-name match only and does not claim that extraction behavior changed.

## Modules

| Area | Path | Notes |
|---|---|---|
| Layout | `features/pdf/textLines.ts` | Spans to rows and cells; column gap = two spaces; page-aware. |
| Extraction | `features/extraction/*` | Header fields, table roles, multi-invoice splitting and OCR marking. |
| OCR | `features/ocr/ocrEngine.ts`, `scripts/prepare-ocr-assets.mjs` | Local Tesseract worker, local WebAssembly and language models. |
| Pipeline | `features/pipeline/processPdf.ts` | One PDF in, N invoices out (or "needs OCR"). |
| Batch | `features/batch/batchStore.ts`, `summary.ts` | Framework-free in-memory store and queue. |
| Review policy | `features/validation/analysis.ts` | Validation plus reasons that make an invoice "Review". |
| Export | `features/export/workbookModel.ts` plus XLSX/CSV/JSON exporters | One sanitized sheet model feeds every format. |
| Content and SEO | `content/site.ts`, `content/seo.ts`, `vite.config.ts` | Visible copy, JSON-LD and pre-rendered HTML. |

ExcelJS, Tesseract and the pdf.js text extractor are loaded on demand. There is no application backend or persistent invoice store. The Vite base remains `/DocuExtract/` for GitHub Pages.
