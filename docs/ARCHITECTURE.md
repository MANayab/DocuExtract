# Architecture

The application is a static Vite bundle. React owns the UI. PDF parsing is done by pdf.js, which runs its parser in its own dedicated Web Worker (bundled locally, no CDN), so the UI thread stays responsive. Positioned text spans returned by pdf.js are rebuilt into visual lines (`features/pdf/textLines.ts`); field and table detection, normalization and validation then operate on one canonical invoice model, and exporters consume that same model.

Flow: file selection → validation → pdf.js text extraction (own worker) → visual line reconstruction → text classification → heuristic field/table detection → normalization → Zod validation → arithmetic validation → editable review → export.

The PDF engine (`pdfjs-dist`) and the Excel engine (`exceljs`) are loaded lazily, only when a file is processed or an XLSX download is requested.

No application backend or persistent invoice store exists. `base: '/DocuExtract/'` makes the bundle compatible with a GitHub Pages project site.
