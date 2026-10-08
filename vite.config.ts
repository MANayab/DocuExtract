import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/DocuExtract/',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    minify: 'esbuild',
    // exceljs (~0.9 MB) is lazy-loaded on export; pdf.js worker is a separate asset.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: { pdf: ['pdfjs-dist'], excel: ['exceljs'], ocr: ['tesseract.js'] },
      },
    },
  },
  esbuild: { drop: ['console', 'debugger'] },
});
