# Privacy

DocuExtract is a static, browser-only application. The application code reads selected PDF files and extracts invoice data in the browser; it does not send invoice contents to an application backend, database, analytics service or telemetry endpoint. The project has no application backend.

Files are processed locally by this application and are not uploaded by application code. Verify your own browser network activity if your environment requires independent confirmation. This statement does not make claims about browser extensions, the user's device, network inspection software or hosting-provider access logs.

## Data stored by the application

Invoice PDFs, raw extracted/OCR text, invoice fields, line items, corrections, review state and generated exports are intended to remain in memory only. They are not intentionally written to URLs, localStorage, sessionStorage, IndexedDB or Cache Storage.

The current persistent application data is the seller matching profile store in localStorage. It is written only after an explicit consent checkbox is selected. The schema stores:
- A user-defined profile label.
- A seller-name matching key.
- Optional text-only field/table label anchors in imported profiles.
- Schema version and creation/update timestamps.

The schema rejects seller tax IDs, numeric invoice identifiers, contact details and numeric/currency values in seller keys and reading-rule anchors. It does not store invoice amounts, invoice numbers, dates, tax IDs, addresses, phone numbers, emails or invoice text as supported fields. Existing legacy profiles that fail the current schema are removed from the profile store on load. Profile matching currently identifies a seller by name only; custom field/table reading rules are not yet connected to the extraction parser.

Exporting a profile creates a user-requested local download. Importing or saving a profile requires explicit consent. Deleting a profile removes it from the application's local profile store. Browser-level backups, extensions and operating-system download history are outside the application's control.

## Offline PWA storage

The service worker caches same-origin application assets required for offline startup, including content-hashed application chunks and PDF.js standard fonts. OCR models are cached separately by language after the user selects or uses that language while online. Older versioned application caches are retained across updates so already-open tabs can continue loading their old hashed chunks; this may use additional browser storage until the user clears site data.

Service-worker caching must exclude invoice PDFs, extracted invoice data, corrections, review state, generated exports and seller profile data. The worker only handles same-origin GET requests under `/DocuExtract/`; sensitive document/export paths are excluded from caching. Cache Storage is for application assets and OCR model data, not invoice data.

## OCR

OCR page images are rendered and processed locally. The Tesseract worker, WebAssembly core and selected language model are served from this application's own origin. No third-party OCR CDN is used. Selecting an OCR language while online prepares that model for later offline use; the user does not need to process an invoice online first.

## Verification limits

Automated tests cover selected offline cache and storage behaviors, but they do not yet inspect every Cache Storage response body, every request body, every storage surface after every user workflow, or all browser memory references. Comprehensive privacy verification after upload, extraction, correction, template use, export and reload remains a release blocker. Object URL and document-resource cleanup are covered only by targeted code paths/tests, not a proof of complete memory erasure.

The static site is served by GitHub Pages. This document describes the application code and cannot guarantee the behavior of the user's browser, extensions, hosting logs, or future dependency changes.
