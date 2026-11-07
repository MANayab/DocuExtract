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

The fresh non-mutating lockfile audit for PR #20 head `7e127d5ad4df0df4c59fb35075770e2918f19df6` is [run #42305472916](https://github.com/MANayab/DocuExtract/actions/runs/42305472916), artifact `dependency-security-audit`. The lockfile has not changed since that audit. It reports **14 package findings: 2 critical, 2 high and 10 moderate**. The workflow succeeded because it generated and uploaded a report; the underlying `npm audit` exit code was 1. This is not a clean audit.

### Critical and high findings

| Installed package and path | Advisory identifiers, affected range and fix | Exposure / reachability evidence |
|---|---|---|
| `tinypool@1.1.1` — transitive, `node_modules/tinypool` via Vitest | **Critical:** [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), affected `<=2.1.0`, patched `2.1.2`; [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), affected `<2.1.2`, patched `2.1.2`. npm's dependency-level remediation candidate is `vitest@4.1.12`. | Test/CI worker pool only; not included in the browser bundle. The described RCE requires prior prototype pollution to reach worker options. The repository's Vitest worker configuration and tests are repository-controlled; no invoice/PDF input is passed to Tinypool. A compromised test dependency or malicious repository change remains a toolchain risk. |
| `vitest@2.1.9` — direct dev dependency, `node_modules/vitest`; transitive `@vitest/mocker@2.1.9` and `vite-node@2.1.9` | **Critical:** [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp), affected `<3.2.6`, patched `3.2.6` (and the 4.x line); npm candidate `4.1.12`. **Additional moderate finding:** [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), affected `>=2.1.0, <4.1.11`, patched `4.1.11` (also present on the transitive `@vitest/mocker` row). | Test-only; project scripts run `vitest run`, not the Vitest UI server or Browser Mode. The critical UI-server advisory specifically requires the UI server or Browser Mode on Windows / an exposed server. It is not exercised by the normal test script, but remains present in the installed package and must be upgraded before treating the toolchain as clean. |
| `vite@5.4.21` — direct dev dependency, `node_modules/vite`; includes `launch-editor` and `esbuild@0.21.5` | **High:** [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), affected through `6.4.3`. **Moderate:** [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff). **Low:** [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw). npm candidate `vite@8.3.6`. | Build/dev tooling; not shipped by GitHub Pages. The deployed site is static and does not run Vite's dev server. Local developers can still be exposed while running the dev server; Windows-specific `launch-editor` advisories are relevant to the Windows development environment. Do not expose the dev server to an untrusted network. |
| `zod@3.23.8` — direct runtime dependency, `node_modules/zod` | **High:** [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), affected `<4.6.6`, patched `4.6.6`; npm candidate `zod@4.6.7`. | Browser runtime used to validate local seller-profile imports. The importer caps input at 256 KB before JSON parsing; schemas cap templates at 100, field mappings at 20 and table columns at 8. There is no server endpoint for these payloads. Those controls bound this application's input path, but the vulnerable runtime remains installed and a local import is still a reachable validation path. |

### Moderate dependency findings

| Installed package and dependency path | Advisory / affected range | Fixed version or upstream limitation |
|---|---|---|
| `@typescript-eslint/eslint-plugin@8.72.1`, `@typescript-eslint/parser@8.72.1`, `@typescript-eslint/type-utils@8.72.1`, `@typescript-eslint/typescript-estree@8.72.1`, `@typescript-eslint/utils@8.72.1` — transitive paths under `node_modules/@typescript-eslint/` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), through nested `minimatch`; audit range `>=6.16.0`. | npm reports `typescript-eslint@8.36.0` as a candidate even though installed `typescript-eslint@8.72.1` is newer. This is inconsistent with the resolved tree; do not downgrade or override without upstream confirmation. Tooling-only. |
| `@vitest/mocker@2.1.9` — transitive, `node_modules/@vitest/mocker` | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), `>=2.1.0, <4.1.11`; [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), `>=2.1.0-beta.7, <4.1.12`. | Fixed in `4.1.11` / `4.1.12`; upgrade via Vitest 4.1.12. Dev/test-only WebSocket mock registration surface; not used by the deployed app. |
| `esbuild@0.21.5` — transitive, `node_modules/esbuild` | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), affected `<=0.24.2`. | npm proposes `vite@8.3.6`; dev/build server only, not deployed. |
| `minimatch@10.2.6` — nested at `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch`; sibling copies `3.1.5` and `5.1.9` are outside the reported range | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), affected `>=7.0.0, <11.0.1`. | Advisory fix is `11.0.1`; npm proposes `typescript-eslint@8.36.0`, which conflicts with the installed newer `8.72.1`. Requires upstream dependency-tree clarification; tooling-only. |
| `typescript-eslint@8.72.1` — direct dev dependency, `node_modules/typescript-eslint` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) through the minimatch dependency tree. | npm candidate `8.36.0` is older than the installed version; no downgrade/override applied. Tooling-only. |
| `vite-node@2.1.9` — transitive, `node_modules/vite-node` via Vitest | Inherits the Vite / `launch-editor` / esbuild advisories listed above. | npm proposes `vitest@4.1.12`; dev/test-only. |

The raw `npm-audit.json` and generated Markdown report in [workflow run #42305472916](https://github.com/MANayab/DocuExtract/actions/runs/42305472916) contain all 14 package findings, exact installed paths, audit ranges and npm fix candidates. No finding has been suppressed.

No vulnerable dependency was force-upgraded and no residual risk has been accepted. The audit's proposed major migrations are `vitest@4.1.12`, `vite@8.3.6` and `zod@4.6.7`. They require a focused dependent security PR with lockfile review, compatibility changes, typecheck, lint, unit, production build and full browser tests. Any remaining critical/high risk requires the maintainer's explicit decision before commercial launch.

GitHub Pages serves static files and does not provide repository-controlled HTTP response headers. The application has a CSP meta element, but it cannot substitute for every response-header control (for example, HSTS, X-Frame-Options, Permissions-Policy or a report-only CSP header). Do not claim those headers are configured by this repository.

## Offline service-worker boundary

The build generates a versioned precache manifest from hashed Vite assets and PDF.js standard fonts. OCR models are cached in separate per-language caches after the user selects or uses a language online. Each generated page carries its build ID; active tabs report that ID to the worker. Old shell caches are retained while a tab reports that it needs the build. If any client is suspended or does not respond, cleanup is deferred. Once every live tab reports, inactive shell caches are deleted and inactive OCR caches are migrated before deletion. The new browser suite covers this lifecycle, but exact-head execution is still required before treating it as verified.

A waiting update is user-controlled. The worker is not allowed to cache invoice PDFs, extracted fields, corrections, review state, exports or seller profiles. Offline readiness checks all required shell entries and attempts to restore missing assets when connectivity returns. Browser eviction while offline cannot be prevented; the application does not promise offline operation after all required assets have been evicted.

## Reporting

Report suspected vulnerabilities privately to the repository maintainer before public disclosure when practical. Do not attach real customer invoices, extracted invoice contents, secrets or account identifiers to public issues. Use synthetic fixtures and redact logs.
