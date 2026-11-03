import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // PDF.js documents its legacy build for Node.js; keep the browser build in Vite production.
    alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
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
