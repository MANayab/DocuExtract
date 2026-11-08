# OCR for scanned PDFs

DocuExtract runs Tesseract locally in the browser for scanned or image-only pages. English, German and Hindi are selectable when their locally bundled models are present. OCR language is independent of invoice locale.

Mixed PDFs keep text-layer pages and send pages without extractable text through OCR. OCR-derived values are capped at 75% confidence and require review. The scanned-PDF language selector is independent of invoice locale and is available in the Reading options disclosure below the primary upload action.

## Offline preparation

After the app reports **Offline ready**, selecting an OCR language in Reading options while online downloads that language model into its separate versioned Cache Storage entry. This prepares OCR for offline use without requiring the user to process an invoice online first. A language model is not cached until the user selects or uses that language.

If the model has not been cached and the device is offline, the app returns a clear recoverable message asking the user to connect and select the language once. The engine uses a same-origin GET availability request because the service worker intentionally handles GET requests; a HEAD probe would bypass that route. The service worker returns a structured 503 for an uncached offline model, and the OCR action can be retried after connectivity returns.

## Production asset path

The worker, WebAssembly core and traineddata models are loaded from the application's `/DocuExtract/ocr/` path. The app does not create a blob worker or contact a third-party OCR service. The service worker precaches the OCR manifest, worker and core files; it caches a traineddata model only after the user selects or uses that language online.

## Accuracy status

English, German and Hindi are included in the bundled OCR configuration. German and Hindi extraction accuracy remains experimental. The repository's current image-only fixture contains an English invoice; running the three language models against that fixture can verify model initialization and selected invoice anchors, but it cannot certify native German or Hindi invoice accuracy. Representative image-only scans in each language and human QA are still required.

## Limits and privacy

- At most 20 pages requiring OCR per PDF.
- PDFs are limited to 25 MB and 100 total pages.
- Handwriting, angled photographs and low-resolution scans are not guaranteed.
- The worker, WebAssembly core and language assets are served from the application's own origin.
- No third-party OCR CDN is used.
- OCR output should always be reviewed.

`npm run prepare:ocr` prepares local OCR assets for development and production builds. The CI OCR asset-size audit checks generated assets.
