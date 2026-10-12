# OCR for scanned PDFs

DocuExtract can read scanned or image-only PDFs with [Tesseract](https://github.com/naptha/tesseract.js) compiled to WebAssembly. Everything runs **in the browser tab**: the worker, the WASM engine and the language data are served from this site, so no invoice image and no OCR file ever comes from a CDN.

OCR is **optional at build time**. A build without the OCR files works normally; scanned PDFs are then listed as "Scanned PDF" with a disabled **Run OCR** button, and the site copy (FAQ, structured data) says so honestly.

## Enable it (one time)

`tesseract.js` and its WASM core are already dependencies. Only the English language data is added:

```bash
npm install --save-exact '@tesseract.js-data/eng'
git add package.json package-lock.json
git commit -m "chore: bundle English OCR data"
npm run build
```

`npm run build` (and `npm run dev`) first runs `scripts/prepare-ocr-assets.mjs`, which copies three things into `public/ocr/` (git-ignored, regenerated every build):

| File | From | Size (approx.) |
| --- | --- | --- |
| `worker.min.js` | `node_modules/tesseract.js/dist/` | < 1 MB |
| `core/*lstm*.wasm.js` | `node_modules/tesseract.js-core/` | 3 to 4 MB each |
| `lang/eng.traineddata.gz` | `node_modules/@tesseract.js-data/eng/` | ~ 10 MB |

and writes `public/ocr/manifest.json`. The script prints a line such as `[ocr] bundled worker, 2 core file(s) and eng.traineddata.gz`.

**No npm access to the data package?** Download `eng.traineddata.gz` (or `eng.traineddata`) from the [tessdata_best](https://github.com/tesseract-ocr/tessdata_best) project and put it in `ocr-data/` at the repository root. The script uses it first.

Users only download these files when they click **Run OCR**; nothing is fetched otherwise.

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

- English only. Other languages need their own `*.traineddata` and a small change to the script and manifest.
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
| Build log says `English language data not found` | Install `@tesseract.js-data/eng` or add `ocr-data/eng.traineddata.gz`. |
| `OCR failed: ...` on a row | Open DevTools → Console/Network. A 404 under `/DocuExtract/ocr/` means the files were not deployed; check `dist/ocr/`. |
| Garbled numbers | Scan quality. Re-scan at 300 dpi, straight, high contrast. |

## Licenses

Tesseract, tesseract.js, tesseract.js-core and the tessdata models are Apache-2.0. Re-verify exact versions before redistributing (see `docs/THIRD-PARTY-LICENSES.md`).
