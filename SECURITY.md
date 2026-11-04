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
