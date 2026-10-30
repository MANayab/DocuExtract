# Third-party licenses

Direct dependencies used by this project:

| Package | Version | License |
|---|---:|---|
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| pdfjs-dist | 4.10.38 | Apache-2.0 |
| tesseract.js | 5.1.1 | Apache-2.0 |
| tesseract.js-core (transitive, bundled for OCR) | 5.1.1 | Apache-2.0 |
| @tesseract.js-data/eng (bundled OCR model package) | 1.0.0 | MIT (package wrapper) |
| @tesseract.js-data/deu (bundled OCR model package) | 1.0.0 | MIT (package wrapper) |
| @tesseract.js-data/hin (bundled OCR model package) | 1.0.0 | MIT (package wrapper) |
| exceljs | 4.4.0 | MIT |
| file-saver | 2.0.5 | MIT |
| zod | 3.23.8 | MIT |
| typescript | 5.6.3 | Apache-2.0 |
| vite | 5.4.10 | MIT |
| @vitejs/plugin-react | 4.3.3 | MIT |
| tailwindcss | 3.4.14 | MIT |
| postcss | 8.4.47 | MIT |
| autoprefixer | 10.4.20 | MIT |
| vitest | 2.1.5 | MIT |
| @testing-library/react | 16.0.1 | MIT |
| @testing-library/jest-dom | 6.6.3 | MIT |
| @testing-library/user-event | 14.5.2 | MIT |
| jsdom | 25.0.1 | MIT |
| playwright | 1.48.2 | Apache-2.0 |
| pdf-lib | 1.17.1 | MIT |
| eslint | 9.14.0 | MIT |
| prettier | 3.3.3 | MIT |
| @types/react | 18.3.12 | MIT |
| @types/react-dom | 18.3.1 | MIT |
| @types/file-saver | 2.0.7 | MIT |
| eslint-plugin-react-hooks | 5.0.0 | MIT |
| eslint-plugin-react-refresh | 0.4.14 | MIT |
| @eslint/js | 9.14.0 | MIT |
| globals | 15.12.0 | MIT |
| typescript-eslint | 8.13.0 | MIT |


## OCR model data notices

The traineddata payloads supplied by `@tesseract.js-data/eng`, `@tesseract.js-data/deu` and `@tesseract.js-data/hin` originate from `naptha/tessdata` and are licensed under Apache-2.0. The npm package wrappers declare MIT; this does not replace the underlying model-data license. The build copies the exact package MIT license files, the Apache-2.0 tessdata license text and the OCR attribution notice into `public/ocr/licenses/` so they are distributed with the OCR assets. The source Apache license is retained at `licenses/Apache-2.0-tessdata.txt`.

The maintainer must re-verify all dependency and transitive-dependency licenses before commercial distribution.
