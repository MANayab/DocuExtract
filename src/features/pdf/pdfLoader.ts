import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundled locally (no CDN): pdf.js runs its parser in its own Web Worker,
// so the UI thread stays responsive.
GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(data: ArrayBuffer) {
  const task = getDocument({
    data,
    // Never evaluate PDF-supplied code; also keeps the CSP free of unsafe-eval.
    isEvalSupported: false,
  });

  return task.promise;
}
