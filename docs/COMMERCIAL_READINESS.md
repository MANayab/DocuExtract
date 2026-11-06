# Pre-commercial technical readiness

**Assessment date:** 2026-11-07  
**Audited baseline:** `main` at `02173d97d6ab8caa6c02ebe550aaf0eb9fc5fb02`  
**Application version:** `1.6.0`  
**Published tag:** `v1.6.0`  
**Source licence:** MIT (verified in `LICENSE`)

This document separates evidence from incomplete work. It is not a commercial launch approval.

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

## PWA verification boundary

The prior v1.6.0 Playwright suite had 12 passing tests, but it did not prove every required commercial/offline workflow. In particular, a complete two-build service-worker lifecycle test for update acceptance, deferral, failed update recovery and multiple active tabs was not present. Parsed contents of offline XLSX, both CSV formats and JSON downloads were not all asserted in a single offline end-to-end workflow.

The current pre-commercial branch adds:
- A build-derived service-worker ID tied to package version, hashed build asset names and service-worker source.
- Build-derived precaching of PDF.js standard fonts as well as hashed application chunks.
- A cache-verified Offline ready status.
- User-selected OCR language pre-download, so OCR can be prepared without first processing an invoice online.
- Old versioned shell caches retained during updates; cached hashed chunks are searched across shell caches to avoid breaking already-open tabs.
- Regression assertions for the generated build ID and 14 precached standard fonts.

These changes still require the branch's CI and browser execution evidence. They do not yet constitute full two-build update lifecycle verification or quota-failure browser verification.

## Privacy and data boundaries

- Invoice PDFs and invoice records are held in application memory for processing and review; the application has no backend or analytics endpoint.
- Cache Storage is intended for app-shell assets, PDF.js standard fonts and OCR model payloads only.
- Seller matching profiles are persisted only after explicit consent. The current schema excludes seller tax IDs, numeric identifiers, contact details and amounts from seller matching keys and text anchors. Invalid/legacy profiles that fail the schema are removed on load.
- Profile imports now require explicit consent, like profile saves.
- Custom field/table reading rules are not applied by the parser. The UI describes profiles as seller matching only.

Comprehensive automated inspection of Cache Storage response bodies, localStorage, sessionStorage, IndexedDB, request bodies, URL/query parameters and browser memory after every workflow remains incomplete. The existing test suite is not proof of complete memory erasure.

## Extraction and export limitations

- The synthetic benchmark contains eight invoices and seven line-item/splitting fixtures. It is a regression gate, not a representative dataset.
- Currency without a recognized marker defaults to INR at low confidence with an explicit warning; this is a review-required fallback, not evidence that the invoice is INR.
- HSN/SAC is not represented in the current `InvoiceItem` schema and is not scored.
- German and Hindi OCR are experimental and lack representative field-level benchmark coverage.
- Seller profiles currently match seller names only; they do not change field or table parsing.
- Full export fidelity for large/empty data, Unicode edge cases, all CSV quoting/newline combinations and unsafe hyperlink behavior requires additional artifact-level tests.
- Real supplier invoice QA and human correction-effort measurement have not been performed.

## Dependency security findings

The latest captured non-mutating audit report is from [run #42271943998](https://github.com/MANayab/DocuExtract/actions/runs/42271943998), against PR #19 head `86343074c22785196fb9856d53baaf9f607c32c7`. It reported **14 findings: 2 critical, 2 high and 10 moderate**. This audit is not a clean security result.

The critical/high items include the Vitest/Tinypool test toolchain and Vite/Zod dependencies. Detailed advisory paths and the earlier reachability analysis are recorded in [issue #14](https://github.com/MANayab/DocuExtract/issues/14). A fresh audit on the current main dependency tree and a tested major-version migration plan remain outstanding. No residual critical/high risk has been accepted by the maintainer.

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

- [ ] Fresh dependency audit and reviewed remediation of critical/high findings, or explicit maintainer risk acceptance.
- [ ] Full offline extraction and parsed XLSX/CSV/JSON export E2E evidence.
- [ ] Two-build update acceptance/deferral/failure-recovery and multi-tab safety tests.
- [ ] Full storage/network privacy tests using distinctive synthetic markers.
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
