# Security

## Implemented controls

- Browser-only processing with no application backend.
- PDF limits of 25 MB and 100 pages; OCR processing is limited to 20 scanned pages.
- pdf.js runs locally and PDF-supplied script evaluation is disabled.
- Formula-injection characters are sanitized before XLSX and CSV cells are written.
- OCR uses locally served same-origin worker, WebAssembly and language assets. The CSP has no remote origins.
- React rendering avoids raw HTML injection.
- No invoice data is intentionally placed in URLs, localStorage or sessionStorage.
- Seller-template rules may be persisted only after explicit consent; invoice files and extracted invoice data are not persisted there.
- CI runs type checking, linting, tests and build validation before deployment.

Report suspected vulnerabilities privately to the repository maintainer before public disclosure when practical.


## Offline service worker boundary

The service worker is served and scoped under `/DocuExtract/`, accepts only same-origin application requests, and must not cache PDF uploads, invoice data, exports or templates. OCR language assets are cached separately by language after use. A waiting update is user-controlled; the application does not automatically reload a tab that may contain active invoice work.

Dependency-security audit findings are reported separately by CI. A green application test suite does not mean every transitive development-tool vulnerability has been eliminated; remaining findings must be documented with their reachability rather than suppressed.
