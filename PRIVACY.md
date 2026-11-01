# Privacy

DocuExtract is designed as a zero-backend browser application. The application code processes selected PDF files locally in the browser and does not send invoice content to an application server, database, analytics service, or telemetry endpoint.

The application does not intentionally store invoice data in localStorage, sessionStorage, or URLs. Processing uses in-memory browser objects and releases the PDF document after extraction.

This document is not a promise about every network request made by a browser, extension, hosting platform, or future dependency. Users with strict privacy requirements should verify network activity in their own environment before processing sensitive documents.

## OCR

When OCR is used, the page images, Tesseract worker, WebAssembly engine and selected language data are handled locally and served from this application's own origin. The selected model is requested only when OCR starts; text-only PDFs do not request OCR assets. Nothing is requested from a third-party CDN, and OCR language data is not cached in browser storage.

## Hosting

The site is served by GitHub Pages. GitHub may keep ordinary web-server logs for page requests; those logs do not contain your invoices because invoices are never sent.

## Seller templates

Consent-based seller templates are stored only in this browser's local storage after an explicit user action. Template records contain seller match keys and reading-rule anchors only; they are designed not to contain invoice amounts or copied invoice text. Invoice files and extracted invoice data remain in memory and are not stored in URLs, localStorage or sessionStorage by the application.
