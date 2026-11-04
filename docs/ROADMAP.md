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
Consent-based seller templates with local storage only after explicit consent and validated JSON import/export.

### v1.5.1
Improved difficult line-item and table extraction, added currency fallback and warnings, added multi-invoice regression coverage and offline extraction-quality gates, and synchronized the app version with package.json.

## Next

### v1.6.0: offline PWA
Service worker support with app-shell and local-asset caching, OCR models cached only after use, an update prompt, and a Playwright offline test. Invoice PDFs and extracted invoice data must never be cached. The GitHub Pages base path remains `/DocuExtract/`.

## Later ideas

- Use-case SEO pages.
- More OCR benchmark fixtures.
- Improving German and Hindi OCR extraction accuracy.
- HSN/SAC in the `InvoiceItem` schema.

## Known limitations

German and Hindi OCR are experimental and are not certified by the current field-level quality gate. Extraction remains heuristic and requires review. Seller-template end-to-end human QA on real seller invoices is pending. Multi-invoice splitting depends on detectable invoice boundaries.
