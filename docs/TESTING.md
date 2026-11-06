# Testing

DocuExtract uses formatting checks, TypeScript, ESLint, Vitest, a synthetic extraction benchmark, Playwright browser tests and separate OCR-size/dependency-audit workflows.

## Local verification

Run the repository's actual scripts:

```bash
npm ci
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npm run benchmark
npx playwright install chromium
npm run test:e2e
```

`npm test` runs the `pretest` asset preparation hooks. `npm run build` runs `prebuild` and `postbuild`, including local OCR/PDF.js asset preparation and PDF standard-font verification.

## Extraction-quality gate

- English text extraction critical fields: at least 95%.
- Indian GST extraction: at least 90%.
- Multi-invoice splitting: at least 90%.
- XLSX, invoice CSV, line-items CSV and JSON verification: 100%.

The benchmark tracks invoice number, date, seller, subtotal, tax, grand total, currency and line items. The report includes fixture-level expected/actual values and export checks. A green build does not replace the benchmark.

The 2026-11-06 main-baseline benchmark processed 8 synthetic invoices: 8/8 zero-error (100%), 0 requiring correction; text-English 100% (40/40), Indian GST 100% (8/8), multi-invoice 100% (16/16), split fixtures 7/7, and 32/32 export checks. These are synthetic regression results, not real-world accuracy claims.

## Playwright

Playwright runs Chromium against the production build served under `/DocuExtract/`. The reporter writes an HTML report to `playwright-report/` and raw results to `test-results/`; CI uploads both even after a failed test run. A missing report is a workflow warning, not silently treated as evidence.

The main baseline run recorded 12 passing Chromium tests. This did not cover every requested offline lifecycle scenario. In particular, full offline extraction plus parsed XLSX/CSV/JSON downloads, controlled two-build update acceptance/deferral/failure recovery, multi-tab safety, and quota-failure recovery remain unverified.

## Offline PWA test requirements

Use clean browser contexts against a production build served under `/DocuExtract/`. Verify the active controlling service worker, exact versioned shell cache, all precached hashed chunks and PDF.js standard fonts. For OCR, assert the actual traineddata URL is served from the per-language Cache Storage entry; HTTP cache alone is not sufficient evidence.

A passing mocked update-button test is not two-build update lifecycle verification. A controlled old/new build setup is required for acceptance, deferral, failed install and active-tab behavior.

## Privacy test requirements

Use distinctive synthetic invoice markers. Inspect Cache Storage response bodies, localStorage, sessionStorage, IndexedDB, URL/query parameters and request bodies after upload, extraction, correction, seller-profile save/import/delete, export and reload. Cache key names alone do not prove invoice content is absent.

## Human QA

Human QA is separate from automated coverage. Real scans, multilingual OCR, seller-profile behavior, downloaded files, supported device/browser combinations, keyboard navigation and screen-reader behavior remain pending until recorded in the QA report.

Pending or cancelled workflows are not passes. CI evidence must be checked against the exact PR head SHA.
