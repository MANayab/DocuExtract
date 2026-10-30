# OCR asset size report

- Feature SHA: c0d554357f3ba15a2522125660b080a8125ee5f
- Baseline: main (current main)

## Traineddata

| Language | File | Raw bytes | gzip -9 bytes |
|---|---|---:|---:|
| eng | ocr/lang/eng.traineddata.gz | 5,199,098 | 2,944,714 |
| hin | ocr/lang/hin.traineddata.gz | 1,651,097 | 1,388,860 |
| deu | ocr/lang/deu.traineddata.gz | 2,070,514 | 1,332,206 |

The actual deployed compressed file sizes are 2,952,873 bytes (eng), 1,389,692 bytes (hin), and 1,333,102 bytes (deu). The gzip -9 column is a fresh recompression of decompressed raw model bytes, so minor differences from the committed gzip files are expected.

## Worker and WASM core

| File | Bytes |
|---|---:|
| ocr/core/tesseract-core-lstm.wasm.js | 3,938,277 |
| ocr/core/tesseract-core-simd-lstm.wasm.js | 3,938,657 |
| ocr/worker.min.js | 123,724 |

## Deployment artifact comparison

| Build | dist bytes |
|---|---:|
| main baseline | 17,141,436 |
| feature | 17,141,436 |
| increase | 0 |

The zero delta is expected: current main already builds the same three traineddata files, worker and core assets. This v1.4.0 work adds no additional OCR payload relative to main.

## OCR asset inventory

- core/tesseract-core-lstm.wasm.js (3,938,277 bytes)
- core/tesseract-core-simd-lstm.wasm.js (3,938,657 bytes)
- lang/deu.traineddata.gz (1,333,102 bytes)
- lang/eng.traineddata.gz (2,952,873 bytes)
- lang/hin.traineddata.gz (1,389,692 bytes)
- manifest.json (123 bytes)
- worker.min.js (123,724 bytes)

## Provenance and license gate

The package wrappers are pinned at 1.0.0 and carry MIT notices. The underlying traineddata is from naptha/tessdata, Apache-2.0. All three models are present in the actual production build, so English, Hindi and German model bytes and sizes are now verified. The application loads the selected model from its same-origin langPath when OCR is requested; text-only extraction does not invoke the OCR engine and therefore does not request the OCR manifest or language data. Keep all three supported.