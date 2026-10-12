/** Injected by vite.config.ts / vitest.config.ts. */
declare const __OCR_BUNDLED__: boolean | undefined;

/**
 * True when this build ships the Tesseract files (scripts/prepare-ocr-assets.mjs
 * found them). Everything user-facing about OCR depends on this, so the app
 * never promises a feature the build does not contain.
 */
export const OCR_BUNDLED = typeof __OCR_BUNDLED__ !== 'undefined' && __OCR_BUNDLED__ === true;
