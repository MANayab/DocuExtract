import { AppError } from '../types/errors';
import { MAX_FILE_BYTES } from '../config/limits';
export function validatePdfFile(file: File): void { if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new AppError('INVALID_FILE','Please select a PDF file.'); if (file.size > MAX_FILE_BYTES) throw new AppError('PDF_TOO_LARGE','PDF exceeds the 25 MB limit.'); }
