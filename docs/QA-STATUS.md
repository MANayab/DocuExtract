# QA status

## Audited main baseline

- Main SHA after PR #20: `cd3973fb6227bc79c6b321e6161da4989867e7d2`
- Version: `1.6.0`
- Main CI run: [#42369924839](https://github.com/MANayab/DocuExtract/actions/runs/42369924839); verify and Playwright jobs both succeeded on this SHA.
- Main Pages deployment: [#42369924820](https://github.com/MANayab/DocuExtract/actions/runs/42369924820) succeeded.
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


## Release provenance and dependency status

The published v1.6.0 release title is **DocuExtract v1.6.0 — Offline PWA and On-Demand OCR Caching** and is intentionally unchanged. The existing `v1.6.0` tag is lightweight and points to `1f1ec88dc997519e67b71784166c487f784859c1`, the PR #18 merge commit. PR #20 was later merged into main at `cd3973fb6227bc79c6b321e6161da4989867e7d2`. This historical tag/release provenance is accepted and must not be rewritten or recreated.

The v1.6.1 candidate dependency audit [run #42378063709](https://github.com/MANayab/DocuExtract/actions/runs/42378063709) generated a full report artifact and found 14 vulnerabilities (2 critical, 2 high, 10 moderate). The audit workflow's successful conclusion means the report was uploaded; `npm audit` itself exited 1. See [SECURITY.md](../SECURITY.md). This candidate is not a dependency-remediation release.

- Candidate state: PR #23 remains open and unmerged; no v1.6.1 tag, GitHub Release or deployment has been created. The v1.6.0 tag and release remain unchanged.

## v1.6.1 exact-head verification (2026-11-07)

- Candidate branch: `fix/v1.6.1-pwa-polish`.
- Verified head: `f24826d8452656917e2f77dc3f49532ca082704d`; base main: `cd3973fb6227bc79c6b321e6161da4989867e7d2`.
- [CI #42378063770](https://github.com/MANayab/DocuExtract/actions/runs/42378063770): verify and Playwright jobs passed on the PR merge ref containing this head.
- Verify job: `npm ci`, formatting, typecheck, lint, 27 Vitest files / 139 tests, production build and offline extraction benchmark all passed.
- [Playwright: 26/26 passed](https://github.com/MANayab/DocuExtract/actions/runs/42378063770). Coverage includes OCR online and after offline reload for all three bundled languages, upload-first responsive layout, PWA state semantics, cached/uncached model behavior, update deferral/acceptance/recovery, exports, privacy and same-origin requests.
- [OCR asset-size audit #42378063708](https://github.com/MANayab/DocuExtract/actions/runs/42378063708) passed. The feature build is 3,996 bytes larger than main. Worker, both WASM cores and all three language models were inventoried.
- [Dependency audit #42378063709](https://github.com/MANayab/DocuExtract/actions/runs/42378063709) uploaded the full report; it remains non-clean at 14 findings (2 critical, 2 high, 10 moderate). The workflow succeeded in generating evidence, not in making `npm audit` clean.
- The first E2E attempt found that the OCR test did not reopen the deliberately collapsed Reading options disclosure after an offline reload. The test was corrected in `f24826d`; no OCR or application behavior was weakened. The final exact-head Playwright run passed.
- Actual browser OCR tests load the local Tesseract worker, WASM core and language model. English uses the repository's scanned-PDF fixture; German and Hindi use raster-PDF fixtures generated for the browser test. These results verify the test fixtures, not broad accuracy on real supplier invoices.
- The temporary formatter workflow with repository write permissions was removed in commit `25c39cb81ffebb2d56f6266e309b089b4b90ab26`.

## v1.6.1 release-candidate QA

Automated coverage added in `e2e/pwa-ui.spec.ts` checks upload visibility at 1366×768 and 390×844; page overflow and container bounds at 1366×768, 1920×1080 and 390×844 in light and dark color schemes; keyboard access to Reading options; independent invoice-locale and OCR-language controls; and PWA banner semantics, light/dark styling, online/offline transitions, text separation, container bounds and keyboard dismissal. Existing locale, OCR and PWA acceptance tests were updated to operate the collapsed Reading options disclosure and assert the v1.6.1 build metadata.

These are Chromium checks against the production build. They do not verify 1920×1080, every screen/dialog, all contrast ratios, screen-reader behavior, real device installation, actual offline use on a phone, or the visual quality of every dashboard/review/export state.

## Remaining maintainer QA

- Check light and dark appearance at 1366×768, 1920×1080 and 390×844, including header, hero, upload, review, results, exports, FAQ and footer.
- Install the PWA on desktop and phone; verify scope `/DocuExtract/`, first-online caching, offline reload and update prompt acceptance/deferral.
- Run real English, German and Hindi scanned invoices; verify extracted values manually.
- Test real seller invoices and consent-based template workflows.
- Open downloaded XLSX, invoice CSV, line-items CSV and JSON in their target applications.
- Inspect browser network and storage in the maintainer's own environment if independent privacy confirmation is required.

No human QA is claimed by this release candidate.
