import type { Invoice } from './invoice';
export interface TextSpan { text: string; x: number; y: number; width: number; height: number; page: number; }
export interface PdfExtraction { fileName: string; pageCount: number; spans: TextSpan[]; text: string; kind: 'text-based'|'image-only'|'encrypted'|'corrupt'; /** Text of each page (index 0 = page 1). Optional so hand-built extractions stay valid. */ pageTexts?: string[]; /** True when the text came from OCR rather than the PDF text layer. */ ocr?: boolean; }
export interface ExtractionResult { invoice: Invoice; raw: PdfExtraction; }
