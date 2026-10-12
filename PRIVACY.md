# Privacy

DocuExtract is designed as a zero-backend browser application. The application code processes selected PDF files locally in the browser and does not send invoice content to an application server, database, analytics service, or telemetry endpoint.

The application does not intentionally store invoice data in localStorage, sessionStorage, or URLs. Processing uses in-memory browser objects and releases the PDF document after extraction.

This document is not a promise about every network request made by a browser, extension, hosting platform, or future dependency. Users with strict privacy requirements should verify network activity in their own environment before processing sensitive documents.

## OCR

When OCR is used, the page images, the Tesseract worker, the WebAssembly engine and the language data are all handled and served from this application's own origin. Nothing is requested from a third-party CDN, and OCR language data is not cached in browser storage.

## Hosting

The site is served by GitHub Pages. GitHub may keep ordinary web-server logs for page requests; those logs do not contain your invoices because invoices are never sent.
