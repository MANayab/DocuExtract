# QA status

## Audited main baseline

- Main SHA: `02173d97d6ab8caa6c02ebe550aaf0eb9fc5fb02`
- Version: `1.6.0`
- CI run: [#42280991709](https://github.com/MANayab/DocuExtract/actions/runs/42280991709)
- Playwright: 12 tests passed in Chromium.
- Vitest: 27 test files, 134 tests passed.
- Formatting, typecheck, ESLint, production build and offline benchmark passed.
- OCR asset-size audit passed on the v1.6.0 metadata PR head.
- Dependency audit completed but reported 14 findings (2 critical, 2 high, 10 moderate); see [issue #14](https://github.com/MANayab/DocuExtract/issues/14).

## Synthetic benchmark results (2026-11-06)

- Invoices processed: 8.
- Zero-error invoices: 8/8 (100%).
- Invoices requiring correction: 0/8 in this fixture set.
- English text critical fields: 40/40 (100%).
- Indian GST critical fields: 8/8 (100%).
- Multi-invoice group: 16/16 (100%); split fixtures 7/7.
- XLSX, invoice CSV, line-items CSV and JSON checks: 32/32 (100%).

These results come from repository-owned synthetic fixtures only. They are not a claim of accuracy on real supplier invoices. Missing currency markers still produce a low-confidence INR fallback with an explicit review warning. HSN/SAC is not represented in the current line-item schema.

## Manual testing reported previously

The maintainer has reported opening and processing demo/synthetic files, checking the dashboard and review interface, and completing a text-only PDF smoke test. These observations are not independent evidence of real-world extraction accuracy.

## Pending human QA

- English, Hindi and German OCR on representative real-world scans (using consented/redacted test data).
- Seller-profile behavior; profiles currently match seller names only and do not alter parsing.
- Open downloaded XLSX, invoice CSV, line-items CSV and JSON files in their target applications.
- Offline first-run, extraction and all export formats on supported desktop/mobile browsers.
- Two-build service-worker update acceptance, deferral, failed-update recovery and multi-tab safety.
- Privacy boundary inspection across storage, network requests and browser reload.
- Keyboard-only and screen-reader review of upload, review, export, error and update workflows.
