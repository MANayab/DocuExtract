export type AppErrorCode = 'INVALID_FILE'|'PDF_CORRUPT'|'PDF_ENCRYPTED'|'PDF_TOO_LARGE'|'TOO_MANY_PAGES'|'EXTRACTION_FAILED'|'OCR_UNAVAILABLE'|'EXPORT_FAILED';
export class AppError extends Error { constructor(public code: AppErrorCode, message: string) { super(message); this.name = 'AppError'; } }
