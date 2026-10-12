import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { seoHead, staticContent } from './src/content/seo';

/** True when scripts/prepare-ocr-assets.mjs bundled the Tesseract files (it runs before every build). */
const ocrBundled = existsSync(resolve(process.cwd(), 'public/ocr/manifest.json'));

/**
 * Injects the SEO <head> tags, JSON-LD and pre-rendered content from
 * src/content so crawlers and AI assistants get real HTML without running JS.
 */
const seo = (): Plugin => ({
  name: 'docuextract-seo',
  transformIndexHtml(html) {
    return html
      .replace('<!--seo-head-->', seoHead(ocrBundled))
      .replace('<!--seo-static-->', staticContent(ocrBundled));
  },
});

export default defineConfig({
  base: '/DocuExtract/',
  plugins: [react(), seo()],
  define: { __OCR_BUNDLED__: JSON.stringify(ocrBundled) },
  build: {
    target: 'es2022',
    sourcemap: false,
    minify: 'esbuild',
    // exceljs (~0.9 MB) and tesseract load on demand; the pdf.js worker is a separate asset.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: { pdf: ['pdfjs-dist'], excel: ['exceljs'], ocr: ['tesseract.js'] },
      },
    },
  },
  esbuild: { drop: ['console', 'debugger'] },
});
