import type { Invoice } from './invoice';
import type { LocaleCode } from '../config/locales';
import type { OcrLanguage } from '../features/ocr/ocrLanguages';
export type { OcrLanguage } from '../features/ocr/ocrLanguages';

export type RecordStatus = 'queued' | 'processing' | 'ready' | 'needs-ocr' | 'cancelled' | 'error';

/** One row of the dashboard: a file being processed, or one invoice extracted from a file. */
export interface BatchRecord {
  id: string;
  fileName: string;
  size: number;
  status: RecordStatus;
  progress: number;
  label: string;
  error?: string;
  /** True when this record is currently being processed with OCR or can retry it. */
  ocrRequested?: boolean;
  invoice?: Invoice;
  pageCount?: number;
  /** Set when one PDF contained several invoices. */
  segment?: { index: number; total: number };
  /** Set only after a seller template safely matches this invoice. */
  templateApplied?: { id: string; name: string };
}

export type ProcessResult =
  | { kind: 'invoices'; invoices: Invoice[]; pageCount: number }
  | { kind: 'needs-ocr'; pageCount: number };

export type Processor = (
  file: File,
  options: {
    ocr: boolean;
    locale?: LocaleCode;
    ocrLanguage?: OcrLanguage;
    signal?: AbortSignal;
  },
  onProgress: (percent: number, label: string) => void,
) => Promise<ProcessResult>;
