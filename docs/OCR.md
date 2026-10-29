# OCR for scanned PDFs

DocuExtract can read scanned or image-only PDFs with [Tesseract](https://github.com/naptha/tesseract.js) compiled to WebAssembly. Everything runs **in the browser tab**: the worker, the WASM engine and the language data are served from this site, so no invoice image and no OCR file ever comes from a CDN.

OCR is **optional at build time**. A build without the OCR files works normally; scanned PDFs are then listed as "Scanned PDF" with a disabled **Run OCR** button, and the site copy (FAQ, structured data) says so honestly.

## Enable it (one time)

`tesseract.js` and its WASM core are already dependencies. English, German and Hindi language data are bundled locally:

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
| `lang/eng.traineddata.gz` | `node_modules/@tesseract.js-data/eng/` | measured during build |
| `lang/deu.traineddata.gz` | `node_modules/@tesseract.js-data/deu/` | measured during build |
| `lang/hin.traineddata.gz` | `node_modules/@tesseract.js-data/hin/` | measured during build |

and writes `public/ocr/manifest.json`. The script prints a line such as `[ocr] bundled worker, 2 core file(s), languages: eng, deu, hin`.

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
- OCR language is independent of invoice locale: OCR language controls text recognition; invoice locale controls date and number interpretation.
- At most 20 pages per PDF (`OCR_MAX_PAGES` in `src/config/limits.ts`). OCR runs at roughly 5 to 20 seconds per page depending on the device.
- Handwriting, photos taken at an angle and low-resolution faxes are not reliable.
- Tables with no visible column gaps may merge cells; review line items.

## Privacy

- `cacheMethod: 'none'` stops Tesseract from persisting language data in IndexedDB.
- The Content-Security-Policy allows `wasm-unsafe-eval` (needed to start WebAssembly) and no remote origins.
- Verify in DevTools → Network: during OCR the only requests are to this site's `/ocr/` files.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| **Run OCR** is disabled | The build has no `public/ocr/manifest.json`. Follow "Enable it" and rebuild. |
| Build log says a language model is missing | Run `npm ci`; the production build fails if any allowlisted model is missing. |
| `OCR failed: ...` on a row | Open DevTools → Console/Network. A 404 under `/DocuExtract/ocr/` means the files were not deployed; check `dist/ocr/`. |
| Garbled numbers | Scan quality. Re-scan at 300 dpi, straight, high contrast. |

## Licenses

Tesseract, tesseract.js, tesseract.js-core and the tessdata models are Apache-2.0. Re-verify exact versions before redistributing (see `docs/THIRD-PARTY-LICENSES.md`).
