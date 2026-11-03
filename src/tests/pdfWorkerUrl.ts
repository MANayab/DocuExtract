// Vitest/jsdom uses PDF.js's real legacy worker as a fake worker in Node.
// A file URL lets PDF.js dynamically import the worker module without Vite's
// browser asset URL (/node_modules/...) being interpreted as a Node module path.
export default new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
