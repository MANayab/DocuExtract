import type { Invoice } from './invoice';
import type { LocaleCode } from '../config/locales';
import type { OcrLanguage } from '../features/ocr/ocrLanguages';
export type { OcrLanguage } from '../features/ocr/ocrLanguages';

export type RecordStatus = 'queued' | 'processing' | 'ready' | 'needs-ocr' | 'error';

/** One row of the dashboard: a file being processed, or one invoice extracted from a file. */
export interface BatchRecord {
  id: string;
  fileName: string;
  size: number;
  status: RecordStatus;
  progress: number;
  label: string;
  error?: string;
  invoice?: Invoice;
  pageCount?: number;
  /** Set when one PDF contained several invoices. */
  segment?: { index: number; total: number };
}

export type ProcessResult =
  | { kind: 'invoices'; invoices: Invoice[]; pageCount: number }
  | { kind: 'needs-ocr'; pageCount: number };

export type Processor = (
  file: File,
  options: { ocr: boolean; locale?: LocaleCode; ocrLanguage?: OcrLanguage },
  onProgress: (percent: number, label: string) => void,
) => Promise<ProcessResult>;
