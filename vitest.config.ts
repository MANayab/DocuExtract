import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // PDF.js documents its legacy build for Node.js; keep the browser build in Vite production.
    alias: [
      { find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' },
      {
        // The production loader's ?url import normally becomes a browser asset path.
        // In Vitest, use a file:// URL to the actual legacy worker for Node's fake-worker import.
        find: /^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/,
        replacement: resolve(process.cwd(), 'src/tests/pdfWorkerUrl.ts'),
      },
    ],
  },
  define: { __OCR_BUNDLED__: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    css: true,
    include: ['src/tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
