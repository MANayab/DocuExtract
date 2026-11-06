# Security

## Implemented controls

- Static, browser-only processing; no application backend, cloud extraction endpoint, analytics or telemetry.
- PDF limits: 25 MB and 100 pages; OCR is limited to 20 pages requiring OCR per PDF.
- pdf.js runs locally and PDF-supplied script evaluation is disabled.
- Formula-like cell values are sanitized before XLSX and CSV export.
- OCR worker, WebAssembly core and language assets are served from the application's own origin.
- The HTML meta CSP allows only same-origin connections and assets, with narrowly required inline styles, blob workers and WebAssembly evaluation. It contains no remote origins.
- React renders extracted invoice text as text; the app does not intentionally use raw HTML injection for invoice content.
- Seller matching profiles require explicit consent for save/import. The current schema excludes seller tax IDs, numeric identifiers, contact details and amounts from matching keys/anchors.
- The service worker is restricted to same-origin GET requests under `/DocuExtract/`; document/export paths are excluded from caching.
- CI runs formatting, typecheck, lint, unit tests, build, offline benchmark and Playwright tests. OCR-size and dependency-audit workflows provide separate evidence.

## Known security limitations

The latest captured dependency audit for the v1.6.0 release-metadata PR (SHA `86343074c22785196fb9856d53baaf9f607c32c7`, run [#42271943998](https://github.com/MANayab/DocuExtract/actions/runs/42271943998)) reported **14 findings: 2 critical, 2 high and 10 moderate**. The audit workflow completed and uploaded a report; this is not a clean security result. Critical/high findings include the Vitest/Tinypool test toolchain and Vite/Zod packages. The detailed package versions, advisory ranges and dependency paths are recorded in [issue #14](https://github.com/MANayab/DocuExtract/issues/14) and the attached workflow artifact. A fresh audit on the current main baseline is still required.

No risk acceptance for unresolved critical/high findings has been made. A commercial-readiness claim requires a reviewed remediation plan and explicit maintainer acceptance for any residual critical/high risk. Development dependencies still matter because they run in developer workstations and CI.

GitHub Pages serves static files and does not provide repository-controlled HTTP response headers. The application has a CSP meta element, but it cannot substitute for every response-header control (for example, HSTS, X-Frame-Options, Permissions-Policy or a report-only CSP header). Do not claim those headers are configured by this repository.

## Offline service-worker boundary

The build generates a versioned precache manifest from hashed Vite assets and PDF.js standard fonts. OCR models are cached in separate per-language caches after the user selects or uses a language online. Old shell caches are retained across updates to protect already-open tabs that may still request old hashed chunks. This avoids unsafe eager cache deletion but can increase browser storage use; a bounded safe cleanup policy remains to be designed and tested.

A waiting update is user-controlled. The worker is not allowed to cache invoice PDFs, extracted fields, corrections, review state, exports or seller profiles. The offline browser suite still needs full two-build update acceptance/deferral/recovery and multi-tab lifecycle coverage.

## Reporting

Report suspected vulnerabilities privately to the repository maintainer before public disclosure when practical. Do not attach real customer invoices, extracted invoice contents, secrets or account identifiers to public issues. Use synthetic fixtures and redact logs.
