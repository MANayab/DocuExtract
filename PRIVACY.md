# Privacy

DocuExtract is a zero-backend browser application. The application code processes selected PDF files locally in the browser and does not send invoice content to an application server, database, analytics service or telemetry endpoint.

Invoice data is not intentionally stored in URLs, localStorage or sessionStorage. Processing uses in-memory browser objects and releases PDF resources after extraction.

The allowed persisted settings are the theme preference and, with explicit consent, seller-template reading rules. Template records are intended to contain seller match keys and reading-rule anchors, not invoice amounts or copied invoice text.

OCR page images are processed locally. The worker, WebAssembly engine and selected language data are served from this application's own origin. The application does not request a third-party OCR CDN.

The static site is served by GitHub Pages. Users with strict privacy requirements should verify network activity in their own environment. This document describes the application code and does not control browser extensions, hosting logs or future dependency behavior.
