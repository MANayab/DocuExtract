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

The v1.6.1 candidate dependency audit [run #42374742371](https://github.com/MANayab/DocuExtract/actions/runs/42374742371) generated a full report artifact and found 14 vulnerabilities (2 critical, 2 high, 10 moderate). The audit workflow's successful conclusion means the report was uploaded; `npm audit` itself exited 1. See [SECURITY.md](../SECURITY.md). This candidate is not a dependency-remediation release.

- Candidate state: PR #23 is open as a draft; no merge, tag, GitHub Release or deployment has been performed.

## v1.6.1 release-candidate QA

Automated coverage added in `e2e/pwa-ui.spec.ts` checks upload visibility at 1366×768 and 390×844; page overflow and container bounds at 1366×768, 1920×1080 and 390×844 in light and dark color schemes; keyboard access to Reading options; independent invoice-locale and OCR-language controls; and PWA banner semantics, theme contrast change, text separation, container bounds and keyboard dismissal.

These are Chromium checks against the production build. They do not verify 1920×1080, every screen/dialog, all contrast ratios, screen-reader behavior, real device installation, actual offline use on a phone, or the visual quality of every dashboard/review/export state.

## Remaining maintainer QA

- Check light and dark appearance at 1366×768, 1920×1080 and 390×844, including header, hero, upload, review, results, exports, FAQ and footer.
- Install the PWA on desktop and phone; verify scope `/DocuExtract/`, first-online caching, offline reload and update prompt acceptance/deferral.
- Run real English, German and Hindi scanned invoices; verify extracted values manually.
- Test real seller invoices and consent-based template workflows.
- Open downloaded XLSX, invoice CSV, line-items CSV and JSON in their target applications.
- Inspect browser network and storage in the maintainer's own environment if independent privacy confirmation is required.

No human QA is claimed by this release candidate.
