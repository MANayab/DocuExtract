# Pre-commercial technical readiness

**Assessment date:** 2026-11-07  
**Audited baseline:** `main` at `02173d97d6ab8caa6c02ebe550aaf0eb9fc5fb02`  
**Application version:** `1.6.0`  
**Published tag:** `v1.6.0`  
**Source licence:** MIT (verified in `LICENSE`)

This document separates evidence from incomplete work. It is not a commercial launch approval.

## Historical release metadata

The immutable `v1.6.0` tag points to the PR #18 merge commit `1f1ec88dc997519e67b71784166c487f784859c1`. At that tag, `package.json`, the lockfile root and the README version badge still identify `1.5.1`, while the changelog places v1.6.0 under Unreleased. PR #19 synchronized the current `main` metadata to `1.6.0`; the historical tag was not rewritten and must not be moved. The published release is [v1.6.0](https://github.com/MANayab/DocuExtract/releases/tag/v1.6.0).

## Baseline gap table

| Requirement | Current evidence | Gap | Severity | Planned fix |
|---|---|---|---|---|
| Version and release provenance | Main is v1.6.0; `v1.6.0` tag/release exist; PR #19 synchronized source metadata. | No source tag rewrite is permitted; verify new commits independently of the historical tag. | Non-blocking | Keep this baseline branch based on current main; do not move tags. |
| Offline shell and PDF resources | PR #20 now derives the worker ID from package version, hashed assets and worker source; it precaches fonts/OCR runtime and checks every required shell entry. | Exact-head CI and browser evidence is still pending; browser eviction while offline cannot be recovered until connectivity returns. | Blocking until verified | Run full PWA suite and inspect cache-integrity/recovery results. |
| Offline extraction and exports | PR #20 extends offline E2E to first extraction without prior online extraction and parses XLSX plus invoice CSV, line-items CSV and JSON downloads. | New exact-head tests have not yet passed; actual downloaded artifacts still need CI evidence. | Blocking until verified | Run the offline browser suite and inspect artifact contents. |
| Service-worker updates | PR #20 adds old/new/failed/retry production builds, active-tab build-ID reporting, safe inactive-cache cleanup, deferral and acceptance tests. | New lifecycle and cleanup tests are not yet green; suspended/legacy clients intentionally defer cleanup. | Blocking until verified | Run full update/recovery E2E and inspect old-tab lazy-asset behavior. |
| OCR offline preparation | PR #20 changes the availability probe to same-origin GET and adds real scanned-PDF online/offline/retry tests for eng/deu/hin model selections. | Recognition and parser field assertions are pending browser execution; the available scanned fixture is English-only, so native German/Hindi accuracy is not certified. | Blocking until verified | Inspect OCR diagnostics and add representative native-language scans before accuracy claims. |
| Privacy persistence | PR #20 adds synthetic-marker checks across binary/text cache bodies, storage, URLs and requests after correction/export/reload, plus seller-profile consent/save/import/delete/reload coverage. | Unit tests cover profile update; there is no user-facing edit control. Automated evidence and broader manual review are pending. | Blocking until verified | Run exact-head tests and review their diagnostics. |
| Seller profiles | Consent-gated local save/import/export; profiles match seller names only and do not change extraction. | Custom field/table reading rules are intentionally outside v1.6.1 and are not applied by the parser. | Non-blocking for the matching-only scope; do not market reading-rule behavior. | Deferred to [issue #25](https://github.com/MANayab/DocuExtract/issues/25); keep UI and claims matching-only until parser integration is verified. |
| Extraction quality | Eight synthetic invoices and a passing release gate. | Synthetic fixtures do not represent real supplier diversity; currency fallback and unscored HSN/SAC remain limitations. | Blocking for accuracy claims | Keep thresholds; add representative fixtures and human QA before accuracy claims. |
| Export correctness | Benchmark verifies 32 format checks and formula sanitization. | Comprehensive Unicode, CSV quoting/newline, empty/large dataset and unsafe hyperlink coverage remains incomplete. | Blocking | Add parsed artifact regression tests for all supported formats. |
| Dependency security | Audit report exists and workflow passed. | Report contains 2 critical, 2 high and 10 moderate findings; no clean audit. | Blocking | Fresh audit, reviewed upgrades, and explicit maintainer risk acceptance for any unresolved critical/high issue. |
| Accessibility/support | Basic semantic controls and automated browser tests. | Keyboard, screen-reader, real device and assistive-technology QA incomplete. | Blocking for broad support claims | Run targeted manual QA and record exact browser/device matrix. |
| Documentation/public metadata | README, privacy, security, terms, roadmap, OCR and llms.txt exist. | Several statements overstated memory erasure, cache cleanup and seller-template behavior; third-party version list was stale. | Non-blocking after this PR | Synchronize docs and verify public SEO/structured data from generated build. |
| Deployment controls | Pages deploy workflow runs on pushes to main. | Main branch API reports `protected: false`; deploy workflow omits full PR gates. | Blocking control risk | Maintainer decision on branch protection/required checks; do not change repository settings here. |

## Implemented capabilities

- Browser-local PDF text extraction, batch processing, multi-invoice splitting and editable review.
- Locale-aware date/number parsing for en-IN, en-US, en-GB and de-DE.
- Local OCR for English, German and Hindi, with OCR output capped at 75% confidence and requiring review. German and Hindi accuracy remains experimental.
- XLSX, invoice-summary CSV, line-items CSV and JSON export.
- Formula-injection sanitization for spreadsheet-compatible exports.
- Seller-name matching profiles with consent-gated local save/import. They identify a seller only; custom field/table reading rules are not yet connected to the extraction parser.
- v1.6.0 offline PWA app shell and on-demand per-language OCR model caching.

## Automated evidence from the audited main baseline

The following GitHub Actions run completed successfully for the audited main SHA:

- [CI run #42280991709](https://github.com/MANayab/DocuExtract/actions/runs/42280991709)
- [Playwright report run #42280991709](https://github.com/MANayab/DocuExtract/actions/runs/42280991709)

Recorded results:
- `npm ci`, formatting, typecheck, ESLint, Vitest and production build passed.
- Vitest: 27 test files, 134 tests passed.
- Playwright: 12 tests passed in Chromium.
- Offline extraction benchmark: 8 synthetic invoices processed; 8/8 zero-error (100%); 0 invoices required correction in this fixture set.
- Benchmark group accuracy: English text 100% (40/40 critical-field comparisons); Indian GST 100% (8/8); multi-invoice 100% (16/16).
- Split fixtures: 7/7 passed; expected invoice count 8, actual 8.
- Export verification: XLSX 8/8, invoice CSV 8/8, line-items CSV 8/8, JSON 8/8 (32 export checks).
- The OCR asset-size audit passed on the v1.6.0 metadata PR head.
- The dependency-audit workflow completed and uploaded a report; its result was **not clean** (see Security findings).

The benchmark uses repository-owned synthetic PDFs. These percentages are not real-world accuracy claims and do not establish performance on representative supplier invoices.

## PWA and OCR verification boundary

The audited main baseline had 12 passing Chromium Playwright tests, but it did not prove the full offline/export/update lifecycle. PR #20 now adds:

- Build-derived service-worker IDs and a matching build ID embedded in generated `index.html`.
- Precache coverage for hashed application chunks, PDF.js standard fonts, OCR worker/core and the manifest.
- An Offline ready state that verifies each required shell URL and manifest asset; when entries are missing it stops reporting ready and attempts recovery when connectivity returns.
- Active-tab build-ID handshakes. Old shell caches remain while a live tab reports that it still needs that build; if any client does not respond, cleanup is deferred. Once all tabs report, inactive shell caches are removed and OCR models are migrated to the current versioned cache.
- Offline extraction and parsed export checks for XLSX, invoice-summary CSV, line-items CSV and JSON.
- A four-build update harness covering deferral, acceptance, an old tab requesting a lazy chunk, a failed install preserving the active version, a valid retry and cleanup after the old tab closes.
- Real image-only scan acceptance tests that assert invoice number, seller, subtotal, tax, total and line-item descriptions for each selected OCR model, plus cached offline reload and uncached offline retry.

These additions are implementation and test coverage, not passed evidence until the exact current PR head has green CI and the artifacts have been inspected. The only current scanned invoice fixture is English. Selecting German or Hindi against that English fixture tests model loading/recognition behavior and those numeric invoice anchors; it does not certify native-language invoice accuracy. Separate representative German and Hindi image-only fixtures remain required. Browser quota failure and eviction of every required asset while offline cannot be made recoverable until the browser is online again.

## Privacy and data boundaries

- Invoice PDFs, raw OCR text, extracted fields, corrections and exports are held in application memory; the application has no backend, analytics or telemetry endpoint.
- Cache Storage is limited to same-origin app-shell assets, PDF.js fonts and selected OCR model payloads.
- Seller matching profiles persist only after explicit consent. The schema excludes seller tax IDs, numeric identifiers, contact details and amounts from seller matching keys and text anchors. The parser still matches by seller name only; custom field/table rules are not applied.
- Browser E2E coverage now inspects synthetic invoice markers in Cache Storage response bodies including binary responses, localStorage, sessionStorage, IndexedDB database presence, URLs and captured request URLs/bodies after upload, extraction, corrections, all four invoice exports and reload.
- Separate browser coverage exercises seller-profile consent, save, export, import, delete and reload. Store-level unit tests cover consent-gated update and delete; the UI currently has no profile edit control.

The tests are automated regression evidence, not proof of complete memory erasure or every possible browser state. Real browser/device, keyboard and screen-reader review remains outstanding.

## Extraction and export limitations

- The synthetic benchmark contains eight invoices and seven line-item/splitting fixtures. It is a regression gate, not a representative dataset.
- Currency without a recognized marker defaults to INR at low confidence with an explicit warning; this is a review-required fallback, not evidence that the invoice is INR.
- HSN/SAC is not represented in the current `InvoiceItem` schema and is not scored.
- German and Hindi OCR are experimental and lack representative field-level benchmark coverage.
- Seller profiles currently match seller names only; they do not change field or table parsing.
- Full export fidelity for large/empty data, Unicode edge cases, all CSV quoting/newline combinations and unsafe hyperlink behavior requires additional artifact-level tests.
- Real supplier invoice QA and human correction-effort measurement have not been performed.

## Dependency security findings

The fresh non-mutating lockfile audit for PR #20 is [run #42305472916](https://github.com/MANayab/DocuExtract/actions/runs/42305472916) (head `7e127d5ad4df0df4c59fb35075770e2918f19df6`; package-lock has not changed since). It reports **14 findings: 2 critical, 2 high and 10 moderate**. The workflow succeeded by generating a report; the underlying `npm audit` exit code was 1.

Critical/high packages are `tinypool@1.1.1` (transitive through `vitest@2.1.9`), `vitest@2.1.9` (direct development dependency), `vite@5.4.21` (direct development dependency) and `zod@3.23.8` (direct runtime dependency). The audit lists major-only candidates `vitest@4.1.12`, `vite@8.3.6` and `zod@4.6.7`. Zod is used for local seller-profile import with a 256 KB size cap and bounded schema arrays, but local file input remains a reachable path. Vite/Vitest/Tinypool are build/test tools and are not shipped as application code; they remain developer/CI toolchain risks.

The 10 moderate findings include `@typescript-eslint/*`, `@vitest/mocker`, `esbuild`, `minimatch`, `typescript-eslint` and `vite-node`. The complete advisory identifiers, affected ranges, dependency paths and reachability notes are recorded in [SECURITY.md](../SECURITY.md) and the audit artifact. Major upgrades have not been forced and no residual risk has been accepted. A focused dependent security PR with compatibility tests is required for major migrations; unresolved critical/high risk requires the maintainer's explicit decision.

## Deployment and repository controls

- The GitHub Pages deployment workflow runs on pushes to `main`. Merging a PR into `main` can therefore trigger production deployment automatically.
- This work must remain on a feature branch; do not merge or dispatch the deployment workflow as part of this task.
- The repository's main branch endpoint reported `protected: false`. Repository settings were not changed. Required-check enforcement and branch protection require a maintainer decision.
- The Pages deployment workflow runs install, typecheck, lint, unit tests and build; it does not itself run the full Playwright suite, benchmark, OCR-size audit or dependency audit. Those must be green on the PR before a human approves merge.
- GitHub Pages cannot configure arbitrary HTTP response headers from this repository. The application meta CSP does not replace HSTS, X-Frame-Options, Permissions-Policy or a response-header CSP.

## Manual QA still required

- Test supported browsers and versions on real Windows, macOS, Android and iOS devices.
- Test English, Hindi and German OCR with representative consented sample scans; do not use customer invoices in public CI.
- Verify first-online setup, offline reload, first offline invoice extraction and all four offline export formats by opening the downloaded files.
- Exercise two tabs during update acceptance, update deferral, failed update installation and recovery.
- Verify Cache Storage, localStorage, sessionStorage, IndexedDB, URLs and network requests after upload, extraction, correction, seller-profile save/import/delete, export and reload.
- Keyboard and screen-reader review of the full upload/review/export flow, update prompt and error announcements.
- Human review of actual extraction corrections and accounting/tax suitability.

## Commercial blockers

- [ ] Remediate the current 2 critical and 2 high dependency findings through a focused major-upgrade PR, or obtain an explicit maintainer risk decision; no acceptance has been made.
- [ ] Green exact-head offline extraction and parsed XLSX/CSV/JSON export E2E evidence.
- [ ] Green exact-head update acceptance/deferral/failure-recovery, old-tab lazy-asset and cache-cleanup tests.
- [ ] Green exact-head storage/network privacy tests using distinctive synthetic markers.
- [ ] Decide whether to implement actual seller-specific field/table reading rules or keep profiles as matching-only and remove unimplemented rule claims from the commercial scope.
- [ ] Broader representative fixture coverage and manual QA.
- [ ] Maintainer decision on branch protection and required checks.
- [ ] Dependency and third-party license inventory re-verification before commercial distribution.

## Readiness decision

| Decision | Current result | Reason |
|---|---|---|
| Technical baseline ready for human review | **NO** | Current branch changes still require full CI and offline browser evidence; several scope requirements remain unverified. |
| Commercial launch ready | **NO** | Critical/high dependency findings, incomplete privacy/PWA lifecycle tests, and outstanding manual QA. |
| Pricing/licensing implementation may begin | **NO** | The technical and security baseline is not yet sufficiently verified. |

The repository's existing MIT licence permits commercial use under its terms. This project does not require replacing the MIT licence with a paid licence to commercialize the existing code. Any future paid offering, if considered, must be designed without removing existing MIT rights or introducing unbuilt feature claims.
