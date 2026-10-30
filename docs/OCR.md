# OCR for scanned PDFs

DocuExtract can read scanned or image-only PDF pages with [Tesseract](https://github.com/naptha/tesseract.js) compiled to WebAssembly. In mixed PDFs, only pages with no extractable text are sent through OCR; text-layer pages are retained and merged in page order. Everything runs **in the browser tab**: the worker, the WASM engine and the selected language data are served from this site, so no invoice image and no OCR file ever comes from a CDN.

OCR is **optional at build time**. A build without the OCR files works normally; scanned PDFs are then listed as "Scanned PDF" with a disabled **Run OCR** button, and the site copy (FAQ, structured data) says so honestly.

## Enable it (one time)

`tesseract.js` and its WASM core are already dependencies. English (`eng`), German (`deu`) and Hindi (`hin`) language data are bundled locally. English is the default. The selected model is fetched from the same-origin asset path only when OCR starts; text-only PDFs do not request OCR assets:

```bash
npm ci
git add package.json package-lock.json
git commit -m "chore: bundle English, German and Hindi OCR data"
npm run build
```

`npm run build` (and `npm run dev`) first runs `scripts/prepare-ocr-assets.mjs`, which copies the worker, WASM core, and all three language models into `public/ocr/` (git-ignored, regenerated every build):

| File | From | Size (approx.) |
| --- | --- | --- |
| `worker.min.js` | `node_modules/tesseract.js/dist/` | < 1 MB |
| `core/*lstm*.wasm.js` | `node_modules/tesseract.js-core/` | 3 to 4 MB each |
| `lang/eng.traineddata.gz` | `@tesseract.js-data/eng@1.0.0` | 2,952,873 deployed bytes (5,199,098 raw bytes) |
| `lang/deu.traineddata.gz` | `@tesseract.js-data/deu@1.0.0` | 1,333,102 deployed bytes (2,070,514 raw bytes) |
| `lang/hin.traineddata.gz` | `@tesseract.js-data/hin@1.0.0` | 1,389,692 deployed bytes (1,651,097 raw bytes) |

and writes `public/ocr/manifest.json`. The script prints the model sizes during the build. A CI size audit measured gzip -9 sizes of 2,944,714 bytes (English), 1,388,860 bytes (Hindi), and 1,332,206 bytes (German). The generated deployment artifact measured 17,141,436 bytes on both main and the feature build (0-byte increase because all three models already existed on main).

For reproducible builds, keep the pinned language packages in `package.json` and `package-lock.json`. If maintaining a custom local model, place the allowlisted `eng`, `deu` or `hin` model in `ocr-data/` and verify its source and license before building.

Users only download the selected language model and OCR runtime files when they click **Run OCR**; all requests are same-origin static assets, not a CDN. The language selector is separate from invoice locale.

## How it works

```
scanned PDF -> pdf.js renders each page to a canvas (about 216 dpi)
            -> Tesseract recognises words (in its own Web Worker)
            -> words become positioned text spans (same shape as a text PDF)
            -> the normal extractor reads rows, labels and tables
            -> every value is marked source "ocr" and capped at 75% confidence
```

Because OCR output is capped below the HIGH band and carries a warning, an OCR'd invoice always has the status **Review**. This is deliberate: OCR can swap digits, and a wrong digit in an invoice total is expensive.

## Limits

- English, German and Hindi are selectable when their model files are bundled. Additional languages require an explicitly reviewed allowlist entry, a pinned data package, license documentation, and regression tests.
- OCR language is independent of invoice locale: OCR language controls text recognition; invoice locale controls date and number interpretation. Supported languages are English (default), German and Hindi.
- At most 20 pages requiring OCR per PDF (`OCR_MAX_PAGES` in `src/config/limits.ts`); a mixed PDF may contain additional text-layer pages. Each rendered page is capped at 24 million canvas pixels (`OCR_MAX_PIXELS`), and rendering scale is capped at 3. The shared PDF validator also enforces 25 MB and 100 total pages. There is no separate wall-clock OCR timeout; use Cancel OCR to stop between pages. OCR runtime varies by device and document, so no time or accuracy guarantee is made.
- Handwriting, photos taken at an angle and low-resolution faxes are not reliable.
- Tables with no visible column gaps may merge cells; review line items.

## Privacy

- `cacheMethod: 'none'` stops Tesseract from persisting language data in IndexedDB.
- The app does not request the OCR manifest, worker, WASM core or language data on initial load. These same-origin assets are requested only after the user chooses **Run OCR** for a scanned PDF.
- The Cancel OCR control stops processing between pages. The page currently being recognized may finish first; then the worker is terminated and canvases are released. The file remains in a Cancelled state with Retry OCR available.
- The Content-Security-Policy allows `wasm-unsafe-eval` (needed to start WebAssembly) and no remote origins.
- Verify in DevTools → Network: during OCR the only requests are to this site's `/ocr/` files.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| **Run OCR** is disabled | The build has no `public/ocr/manifest.json`. Follow "Enable it" and rebuild. |
| A language model returns 404 or cannot be decoded | Check the same-origin `/ocr/lang/` asset path and deployment output. DocuExtract reports the selected language failure and offers Retry OCR; it does not silently switch languages. |
| OCR runs out of memory or fails while rendering | The row reports the failure without deleting the source file or edited invoice data. Retry after reducing the PDF's scanned-page count or image dimensions. |
| OCR is cancelled | The current page may finish, then the worker is terminated. The row remains available with Retry OCR. |
| Build log says a language model is missing | Run `npm ci`; the production build fails if any allowlisted model is missing. |
| `OCR failed: ...` on a row | Open DevTools → Console/Network. A 404 under `/DocuExtract/ocr/` means the files were not deployed; check `dist/ocr/`. |
| Garbled numbers | Scan quality. Re-scan at 300 dpi, straight, high contrast. |

## Licenses

The `@tesseract.js-data/eng`, `@tesseract.js-data/deu` and `@tesseract.js-data/hin` wrapper packages are MIT; the underlying `naptha/tessdata` traineddata is Apache-2.0. Tesseract.js and its core are Apache-2.0. See `docs/THIRD-PARTY-LICENSES.md` and the MIT, Apache-2.0 and attribution text copied into the generated OCR asset directory.
