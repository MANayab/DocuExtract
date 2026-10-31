# Changelog

All notable changes to this project are documented here.

## [1.4.0] — In preparation

### Added

- English, German and Hindi OCR language choices from one typed central configuration, independent of invoice locale.
- Same-origin OCR model size reporting and shipped MIT / Apache-2.0 license notices.
- Page-level OCR for mixed text/scanned PDFs, merging text and OCR pages in document order.
- A Cancel OCR action, between-page cancellation, worker termination, retry states and per-page progress.
- Separate invoice-locale and scanned-PDF-language controls with responsive keyboard-accessible layout.

### Fixed

- Forward the selected OCR language from the batch processor to Tesseract.
- Release canvases and PDF resources on page errors and cancellation.
- Defer OCR manifest/model requests until OCR is explicitly requested; text-only PDFs do not fetch OCR assets.
- Permit retry after a failed manifest or language-model load without silently changing languages.

### QA notes

- Mixed text/scanned-page OCR, cancellation, model-failure recovery and per-page cleanup remain pending until implemented and verified. This version is not released.

## [1.3.1] — 2026-10-12

### Fixed

- Production version source synchronized to 1.3.1.

## [1.3.0] — Prepared release

### Fixed

- **JSON export version metadata.** Exported JSON now uses the version from the site's single version source instead of a stale hard-coded `1.1.0` value. A regression test verifies that JSON metadata matches the application version.

### QA notes

- OCR rotation/deskew and invoice-boundary edge cases remain limitations or unverified behaviors; this release does not claim to fix them. See [the v1.3.0 QA audit](docs/audit/v1.3.0-audit.md).

## [1.2.0] — Release candidate

### Added

- **Locale-aware reprocessing.** Choose India (en-IN), United States (en-US), United Kingdom (en-GB), or Germany (de-DE) in the review screen and reprocess the source PDF using that locale's date and number conventions.
- **Strict date parsing.** Supports ISO and English month-name dates, validates real calendar dates, flags ambiguous numeric dates, and preserves the en-IN default when no locale is selected.
- **Strict number parsing.** Handles locale-specific grouping and decimal separators, accounting negatives, currency markers, percentages, and real zero; ambiguous separators and malformed input are flagged for review rather than silently guessed.
- **Regression coverage.** Adds locale parser coverage and retains the production-hardening regression tests for split-invoice reprocessing, invalid numeric validation and export review notes.

### Changed

- Locale selection is connected to the extraction pipeline and can reprocess an invoice from its original PDF. Manual edits remain protected from reprocessing.
- The release includes the merged CI and validation hardening from PR #2; workflow permissions remain read-only.

## [1.1.0] — 2026-10-10

### Added

- **Batch dashboard.** Drop up to 50 PDFs (anywhere on the page); a queue processes them one at a time with live per-file progress, KPI cards (invoices, total value, need review, average confidence), a results table with Validated / Review / Failed / Scanned statuses, and possible-duplicate detection.
- **Combined exports.** One Excel workbook with one row per invoice (plus Line Items, Parties, Taxes, Validation, Extraction Metadata for all invoices), a Status and Review Notes column, CSV for invoices or line items (UTF-8 BOM for Excel), and JSON with validation status.
- **Multiple invoices per PDF.** A PDF is split where the invoice number changes; multi-page invoices stay together.
- **Labels above values.** Invoice number and dates are read when printed below their labels, using cell positions.
- **Per-line GST columns.** Header-driven mapping of HSN, taxable value, tax rate (CGST % + SGST % summed) and tax amount; validators accept tax-inclusive line totals.
- **Optional local OCR** for scanned PDFs (Tesseract in a Web Worker, WASM core and English data served from this site, no CDN). OCR values are marked `ocr`, capped at 75% confidence, and always need review. Build-time asset script and `docs/OCR.md`.
- **Search and AI discoverability.** Meta tags, canonical, Open Graph / Twitter cards, JSON-LD (`WebSite`, `WebApplication`, `FAQPage`), pre-rendered HTML, `sitemap.xml`, `robots.txt`, `llms.txt`, web manifest and icons; Search Console guide in `docs/SEO.md`.
- New responsive design system and review screen with confidence bands and neutral styling for optional fields that are absent.
- `samples/` with fictional invoices, an extraction-failure issue template and new tests (batch store, export model, review policy, SEO, parser).

### Changed

- The Excel exporter and review table now cover all invoices and tax columns; the CSV is no longer line items only.
- Review status reflects real risks (failed checks, missing number or total, low confidence, OCR). Guessed currency, seller and ambiguous dates are flagged on the field instead.
- Marketing copy never claims OCR unless the build bundles it.

### Known limitations

- OCR is English only, 20 pages max, and slower and less accurate than text PDFs.
- Multi-invoice splitting needs a changing invoice number; header-less or wrapped-header tables may need manual correction.

## [1.0.0] — 2026-10-09

### Added

- Browser-only PDF invoice extraction workflow.
- Editable review screen with confidence indicators.
- Arithmetic validation with tolerance of 0.02.
- XLSX, CSV and JSON export.
- GitHub Actions CI and Pages deployment configuration.
- Formula-injection sanitization and CSP.
- Column-aware line-item detection aligned to the table header; CGST/SGST/IGST summing; separate seller and buyer GSTIN.
- Ambiguous numeric dates are read as DD/MM/YYYY and flagged for review.

### Known limitations

- OCR is not implemented in v1.0.0; scanned and image-only PDFs cannot be extracted.
- Layouts with a label above its value are not read; one invoice per PDF.
