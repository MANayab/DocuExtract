import '@testing-library/jest-dom';
import { GlobalWorkerOptions } from 'pdfjs-dist';

// Vitest runs in Node/jsdom, where Vite's ?url worker asset is not a browser URL.
// Point PDF.js at its locally installed legacy worker for real parser execution.
GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;
