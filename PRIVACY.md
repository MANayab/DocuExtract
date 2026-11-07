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

The service worker caches same-origin application assets required for offline startup, including content-hashed application chunks, the OCR runtime and PDF.js standard fonts. The application status banner and reading-options controls are interface state only; they do not persist invoice content. OCR models are cached separately by language after the user selects or uses that language while online. The Offline ready state verifies the required shell URLs and every asset listed in the build manifest; if entries are missing while online, the app attempts to restore them. If the browser evicts required assets while offline, the app cannot guarantee reload or processing until connectivity returns.

Versioned shell caches are retained while an open tab reports that it is still running that build. The worker asks active tabs for their embedded build IDs before cleanup; if any tab is suspended, legacy or does not respond, cleanup is deferred rather than risking a broken old tab. Once all active tabs report, inactive shell caches are deleted and selected OCR model entries are moved into the current versioned cache before old OCR caches are removed.

Service-worker caching must exclude invoice PDFs, extracted invoice data, corrections, review state, generated exports and seller profile data. The worker only handles same-origin GET requests under `/DocuExtract/`; sensitive document/export paths are excluded from caching. Cache Storage may hold only same-origin application-shell/runtime assets and separately selected OCR language-model assets. It must never hold invoice PDFs, invoice text, extracted fields, line items, edits, review state, generated exports or seller reading rules. Cache Storage is for application assets and OCR model data, not invoice data.

## OCR

OCR page images are rendered and processed locally. The Tesseract worker, WebAssembly core and selected language model are served from this application's own origin. No third-party OCR CDN is used. Selecting an OCR language while online prepares that model for later offline use; the user does not need to process an invoice online first.

## Verification limits

Automated browser tests use synthetic invoice markers to inspect all Cache Storage response bodies (including binary responses), localStorage, sessionStorage, IndexedDB database presence, resource URLs and captured request URLs/bodies after upload, extraction, corrections, XLSX, invoice-summary CSV, line-items CSV, JSON export and reload. Separate browser coverage exercises consent-gated seller-profile save, export, import, delete and reload; unit tests cover consent-gated profile update and deletion. The seller-profile UI currently has no edit control, so update behavior is verified at the store layer rather than through a user-facing edit workflow.

These tests provide bounded regression evidence, not proof of complete memory erasure or every possible browser state. Object URL and document-resource cleanup are covered only by targeted code paths/tests.

The static site is served by GitHub Pages. This document describes the application code and cannot guarantee the behavior of the user's browser, extensions, hosting logs, or future dependency changes.
