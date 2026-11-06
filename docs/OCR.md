# OCR for scanned PDFs

DocuExtract runs Tesseract locally in the browser for scanned or image-only pages. English, German and Hindi are selectable when their locally bundled models are present. OCR language is independent of invoice locale.

Mixed PDFs keep text-layer pages and send pages without extractable text through OCR. OCR-derived values are capped at 75% confidence and require review.

## Offline preparation

After the app reports **Offline ready**, selecting an OCR language while online downloads that language model into its separate versioned Cache Storage entry. This prepares OCR for offline use without requiring the user to process an invoice online first. A language model is not cached until the user selects or uses that language.

If the model has not been cached and the device is offline, the app returns a clear recoverable message asking the user to connect and select the language once.

## Accuracy status

English is included in the bundled OCR configuration. German and Hindi extraction accuracy is experimental. The current automated quality gate does not certify representative field-level accuracy for German or Hindi scans, and human QA on real multilingual scans is pending.

## Limits and privacy

- At most 20 pages requiring OCR per PDF.
- PDFs are limited to 25 MB and 100 total pages.
- Handwriting, angled photographs and low-resolution scans are not guaranteed.
- The worker, WebAssembly core and language assets are served from the application's own origin.
- No third-party OCR CDN is used.
- OCR output should always be reviewed.

`npm run prepare:ocr` prepares local OCR assets for development and production builds. The CI OCR asset-size audit checks generated assets.
