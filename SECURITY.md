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

The fresh non-mutating audit of PR #20 head `09aa7aea7eb035395da330d0a491db160fc842fb` (run [#42293999766](https://github.com/MANayab/DocuExtract/actions/runs/42293999766), artifact `dependency-security-audit`) reports **14 findings: 2 critical, 2 high and 10 moderate**. The workflow succeeded because it generated and uploaded the report; the underlying `npm audit` exit code was 1. This is not a clean security result.

Critical and high findings from the lockfile:

| Installed package | Dependency path | Advisory identifiers | Exposure and reachability |
|---|---|---|---|
| `tinypool@1.1.1` — critical | Transitive test dependency of `vitest@2.1.9`, at `node_modules/tinypool` | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Not shipped in the browser bundle. Runs in the test toolchain/CI. Current worker options come from repository-controlled Vitest configuration and tests; no invoice input is passed to this API. |
| `vitest@2.1.9` — critical | Direct development dependency, at `node_modules/vitest`; includes `@vitest/mocker` and `vite-node` | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) | Test-only; project scripts use `vitest run`, not the Vitest UI server. Not shipped in the production bundle. CI still executes repository test code, so this remains a toolchain risk. |
| `vite@5.4.21` — high | Direct development dependency, at `node_modules/vite` | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | Build/dev tooling, not served by GitHub Pages. The deployed static site does not run Vite's dev server. Developers can still be exposed while running the local dev server; do not bind it to an untrusted network. |
| `zod@3.23.8` — high | Direct runtime dependency, at `node_modules/zod` | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Used in the browser to validate local seller-profile imports. The importer enforces a 256 KB input cap before JSON parsing; schemas cap templates at 100, field mappings at 20 and table columns at 8. There is no network endpoint for these inputs, but a malicious local file remains a reachable validation path. These limits reduce exposure; they do not make the advisory disappear. |

The audit also reports 10 moderate findings involving `@typescript-eslint/*`, `@vitest/mocker`, `esbuild`, `minimatch`, `typescript-eslint` and `vite-node`. The complete package paths, affected ranges and npm-proposed candidates are in the linked workflow artifact. In particular, the reported candidates for the critical/high packages are `vitest@4.1.12`, `vite@8.3.6` and `zod@4.6.7`; each requires a major-version compatibility migration. The audit reports `typescript-eslint@8.36.0` as a candidate for the minimatch finding despite the installed `8.72.1`, so that finding needs upstream/package-tree clarification rather than an assumed downgrade.

No vulnerable dependency was force-upgraded and no residual risk has been accepted. Major migrations should be isolated in a dependent security PR with lockfile review, typecheck, lint, unit, build and full browser tests. Any remaining critical/high exposure requires the maintainer's explicit decision before commercial launch.

GitHub Pages serves static files and does not provide repository-controlled HTTP response headers. The application has a CSP meta element, but it cannot substitute for every response-header control (for example, HSTS, X-Frame-Options, Permissions-Policy or a report-only CSP header). Do not claim those headers are configured by this repository.

## Offline service-worker boundary

The build generates a versioned precache manifest from hashed Vite assets and PDF.js standard fonts. OCR models are cached in separate per-language caches after the user selects or uses a language online. Old shell caches are retained across updates to protect already-open tabs that may still request old hashed chunks. This avoids unsafe eager cache deletion but can increase browser storage use; a bounded safe cleanup policy remains to be designed and tested.

A waiting update is user-controlled. The worker is not allowed to cache invoice PDFs, extracted fields, corrections, review state, exports or seller profiles. The offline browser suite still needs full two-build update acceptance/deferral/recovery and multi-tab lifecycle coverage.

## Reporting

Report suspected vulnerabilities privately to the repository maintainer before public disclosure when practical. Do not attach real customer invoices, extracted invoice contents, secrets or account identifiers to public issues. Use synthetic fixtures and redact logs.
