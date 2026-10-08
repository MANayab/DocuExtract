# Security

## Implemented controls
- Browser-only processing; no application backend.
- 25 MB file and 100 page limits; OCR limit is 20 pages.
- PDF parsing occurs in pdf.js's own dedicated Web Worker, bundled locally; PDF-supplied script evaluation is disabled (`isEvalSupported: false`).
- Formula-injection characters (`= + - @`, tab, carriage return) are prefixed before every XLSX and CSV cell is written.
- No invoice content is logged with `console` in production builds.
- No invoice data is placed in URLs, localStorage, or sessionStorage.
- React rendering avoids raw HTML injection.
- A Content-Security-Policy meta tag restricts scripts, connections and workers to the application's own origin. GitHub Pages cannot set HTTP response headers, so header-only directives such as `frame-ancestors` are not available.

Report suspected vulnerabilities privately to the repository maintainer before public disclosure when practical.
