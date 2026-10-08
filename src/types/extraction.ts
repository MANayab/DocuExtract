import type { Invoice } from './invoice';
export interface TextSpan { text: string; x: number; y: number; width: number; height: number; page: number; }
export interface PdfExtraction { fileName: string; pageCount: number; spans: TextSpan[]; text: string; kind: 'text-based'|'image-only'|'encrypted'|'corrupt'; }
export interface ExtractionResult { invoice: Invoice; raw: PdfExtraction; }
