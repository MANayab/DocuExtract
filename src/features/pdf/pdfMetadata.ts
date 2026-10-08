import type { PDFDocumentProxy } from 'pdfjs-dist'; export function classifyPdf(pdf:PDFDocumentProxy):'text-based'|'image-only'|'encrypted'|'corrupt'{return pdf.numPages>0?'text-based':'image-only';}
