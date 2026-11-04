import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundled locally (no CDN): pdf.js runs its parser in its own Web Worker,
// so the UI thread stays responsive.
GlobalWorkerOptions.workerSrc = workerUrl;

// Browser builds resolve this against Vite's configured base path, so GitHub
// Pages uses /DocuExtract/standard_fonts/. Vitest/Node reads the pinned package
// data directly from disk instead of attempting a browser fetch.
const standardFontDataUrl = import.meta.env.SSR
  ? `${process.cwd().replaceAll('\\\\', '/')}/node_modules/pdfjs-dist/standard_fonts/`
  : new URL(`${import.meta.env.BASE_URL}standard_fonts/`, import.meta.url).href;

export async function loadPdf(data: ArrayBuffer) {
  const task = getDocument({
    data,
    standardFontDataUrl,
    // Never evaluate PDF-supplied code; also keeps the CSP free of unsafe-eval.
    isEvalSupported: false,
  });

  return task.promise;
}
