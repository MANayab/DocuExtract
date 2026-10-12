export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_PAGES = 100;
export const OCR_MAX_PAGES = 20;
export const MIN_TEXT_CHARS = 80;
export const MIN_TEXT_CHARS_PER_PAGE = 20;
/** Most PDFs accepted into one batch (each is processed one at a time to bound memory). */
export const MAX_BATCH_FILES = 50;
/** Render scale for OCR (PDF points -> pixels). 3x of 72 dpi is ~216 dpi, a good OCR/speed balance. */
export const OCR_RENDER_SCALE = 3;
/** Safety cap on rendered OCR canvas size in pixels (width * height). */
export const OCR_MAX_PIXELS = 24_000_000;
