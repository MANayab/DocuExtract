import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { seoHead, staticContent } from './src/content/seo';

const packageVersion = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
  .version as string;

/** True when scripts/prepare-ocr-assets.mjs bundled Tesseract files before this build. */
const ocrBundled = existsSync(resolve(process.cwd(), 'public/ocr/manifest.json'));

/**
 * Injects the SEO <head> tags, JSON-LD and pre-rendered content from
 * src/content so crawlers and AI assistants get real HTML without running JS.
 */
const pwaPrecache = (): Plugin => {
  let buildId = '';

  return {
    name: 'docuextract-pwa-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(
        (fileName) => fileName.startsWith('assets/') && /-[A-Za-z0-9_-]{8,}\./.test(fileName),
      );
      const fontDirectory = resolve(process.cwd(), 'public/standard_fonts');
      const standardFonts = existsSync(fontDirectory)
        ? readdirSync(fontDirectory)
            .filter((fileName) => /\.(pfb|ttf)$/i.test(fileName))
            .sort()
            .map((fileName) => `standard_fonts/${fileName}`)
        : [];

      const workerTemplate = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
      if (!workerTemplate.includes('__DOCUEXTRACT_BUILD_ID__')) {
        throw new Error('public/sw.js is missing the generated build ID placeholder.');
      }

      const ocrDirectory = resolve(process.cwd(), 'public/ocr');
      const ocrRuntime = existsSync(ocrDirectory)
        ? [
            ...(existsSync(resolve(ocrDirectory, 'manifest.json')) ? ['ocr/manifest.json'] : []),
            ...(existsSync(resolve(ocrDirectory, 'worker.min.js')) ? ['ocr/worker.min.js'] : []),
            ...(existsSync(resolve(ocrDirectory, 'core'))
              ? readdirSync(resolve(ocrDirectory, 'core'))
                  .filter((fileName) => !fileName.startsWith('.'))
                  .sort()
                  .map((fileName) => `ocr/core/${fileName}`)
              : []),
          ]
        : [];

      const precacheAssets = [...assets, ...standardFonts, ...ocrRuntime];
      const publicAssetHashes = precacheAssets
        .filter((asset) => !asset.startsWith('assets/'))
        .map((asset) =>
          createHash('sha256')
            .update(readFileSync(resolve(process.cwd(), 'public', asset)))
            .digest('hex'),
        );
      const fingerprintInput = [
        precacheAssets.join('\\n'),
        publicAssetHashes.join('\\n'),
        workerTemplate,
      ].join('\\n');
      const fingerprint = createHash('sha256').update(fingerprintInput).digest('hex').slice(0, 10);
      buildId = `${packageVersion}-${fingerprint}`;

      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ version: packageVersion, buildId, assets: precacheAssets }),
      });
    },
    closeBundle() {
      if (!buildId) throw new Error('The PWA precache manifest was not generated.');
      const serviceWorkerPath = resolve(process.cwd(), 'dist/sw.js');
      const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
      if (!serviceWorker.includes('__DOCUEXTRACT_BUILD_ID__')) {
        throw new Error('The built service worker is missing the generated build ID placeholder.');
      }
      writeFileSync(
        serviceWorkerPath,
        serviceWorker.replaceAll('__DOCUEXTRACT_BUILD_ID__', buildId),
      );

      // Vite's HTML output is written after generateBundle hooks, so inject
      // the page build ID from closeBundle once dist/index.html exists.
      const indexHtmlPath = resolve(process.cwd(), 'dist/index.html');
      const indexHtml = readFileSync(indexHtmlPath, 'utf8');
      if (!indexHtml.includes('__DOCUEXTRACT_BUILD_ID__')) {
        throw new Error('The built index.html is missing the generated build ID placeholder.');
      }
      writeFileSync(indexHtmlPath, indexHtml.replace('__DOCUEXTRACT_BUILD_ID__', buildId));
    },
  };
};

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
  plugins: [react(), seo(), pwaPrecache()],
  define: {
    __OCR_BUNDLED__: JSON.stringify(ocrBundled),
    __DOCUEXTRACT_BUILD_LABEL__: JSON.stringify(process.env.DOCUEXTRACT_BUILD_LABEL ?? 'release'),
  },
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
