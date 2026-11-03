import '@testing-library/jest-dom';
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure the same legacy PDF.js module instance used by Vitest's alias.
// The browser Vite loader and production worker configuration remain untouched.
GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;
