# Roadmap

## Released

### v1.0.0
Browser-only extraction for text PDFs, editable review, arithmetic validation, XLSX/CSV/JSON export, formula-injection protection, CSP and Pages deployment.

### v1.1.0
Batch processing, combined exports, multi-invoice splitting, label-above-value extraction, GST table handling, English local OCR and search/discoverability support.

### v1.2.0
Locale-aware date and number parsing for India, the United States, the United Kingdom and Germany.

### v1.3.0
Locale and parsing hardening, including JSON export metadata synchronization.

### v1.3.1
Production version-source correction.

### v1.4.0
Selectable local OCR for English, German and Hindi, separate OCR-language and invoice-locale controls, mixed text/scanned-page handling, cancellation, retry behavior and same-origin OCR asset auditing.

### v1.5.0
Consent-based seller-name matching profiles with local storage and validated JSON import/export. Custom field/table reading rules are not connected to the parser.

### v1.5.1
Improved difficult line-item and table extraction, added currency fallback and warnings, added multi-invoice regression coverage and offline extraction-quality gates, and synchronized the app version with package.json.

### v1.6.0
Offline PWA support with a same-origin application shell at `/DocuExtract/`, versioned application/OCR caches, PDF.js standard-font caching and user-controlled update handling. OCR models are cached after a language is selected or used online. Invoice PDFs and extracted invoice data are excluded from service-worker caches.

## v1.6.1 release candidate

PWA presentation and upload-first layout polish: accessible state banner, responsive page-container alignment, keyboard-operable dismissal, reserved banner space, and collapsed independent reading options below upload. Automated Chromium layout checks are added; visual review on real desktop and phone devices remains pending.

## Next

- v1.7.0: extraction quality, language-specific OCR amount parsing, end-to-end seller templates, HSN/SAC and field-level benchmark reporting.
- v1.7.1: dependency remediation, privacy/network audit automation and release consistency checks.
- v1.8.0: measured performance budgets and accessibility hardening.

## Later ideas

- Use-case SEO pages.
- More OCR benchmark fixtures.
- Improving German and Hindi OCR extraction accuracy.
- HSN/SAC in the `InvoiceItem` schema.

## Known limitations

German and Hindi OCR are experimental and are not certified by the current field-level quality gate. Extraction remains heuristic and requires review. Seller profiles currently match seller names only; custom field/table reading rules are not implemented. Seller-profile end-to-end human QA on real seller invoices is pending. Multi-invoice splitting depends on detectable invoice boundaries.
