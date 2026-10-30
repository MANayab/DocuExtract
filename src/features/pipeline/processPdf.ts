import type { Processor } from '../../types/batch';
import { markAsOcr } from '../extraction/ocrMarking';
import { parseInvoice } from '../extraction/invoiceParser';
import { splitInvoices } from '../extraction/splitInvoices';
import { DEFAULT_LOCALE } from '../../config/locales';

/**
 * The full local pipeline for one PDF: read text (or OCR a scan on request),
 * split multi-invoice files, then parse each invoice.
 */
export const processPdf: Processor = async (file, options, onProgress) => {
  const { extractPdf } = await import('../pdf/pdfTextExtractor');

  onProgress(4, 'Reading PDF');

  let raw = await extractPdf(file, (p) => onProgress(4 + p * 0.5, 'Extracting PDF text'));

  if (raw.kind === 'image-only') {
    if (!options.ocr) return { kind: 'needs-ocr', pageCount: raw.pageCount };

    const { ocrPdf } = await import('../ocr/ocrEngine');
    raw = await ocrPdf(
      file,
      (p, label) => onProgress(54 + p * 0.38, label),
      options.ocrLanguage ?? 'eng',
    );
  }

  onProgress(92, 'Detecting invoice fields');

  const invoices = splitInvoices(raw).map((segment) => {
    const invoice = parseInvoice(segment.raw, options.locale ?? DEFAULT_LOCALE);
    return raw.ocr ? markAsOcr(invoice) : invoice;
  });

  return { kind: 'invoices', invoices, pageCount: raw.pageCount };
};
