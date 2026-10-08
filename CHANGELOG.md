# Changelog

All notable changes to this project are documented here.

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
