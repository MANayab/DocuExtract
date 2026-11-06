/** Injected by vite.config.ts / vitest.config.ts. */
declare const __OCR_BUNDLED__: boolean | undefined;
declare const __DOCUEXTRACT_BUILD_LABEL__: string | undefined;

/**
 * True when this build ships the Tesseract files (scripts/prepare-ocr-assets.mjs
 * found them). Everything user-facing about OCR depends on this, so the app
 * never promises a feature the build does not contain.
 */
export const OCR_BUNDLED = typeof __OCR_BUNDLED__ !== 'undefined' && __OCR_BUNDLED__ === true;

/** Non-sensitive build marker used to exercise real PWA updates in browser tests. */
export const DOCUEXTRACT_BUILD_LABEL =
  typeof __DOCUEXTRACT_BUILD_LABEL__ !== 'undefined' ? __DOCUEXTRACT_BUILD_LABEL__ : 'release';
