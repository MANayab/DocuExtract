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

  const imageOnlyPages = raw.pageTexts
    ?.map((pageText, index) =>
      pageText.trim().length === 0 ? index + 1 : null,
    )
    .filter((page): page is number => page !== null);
  const needsOcr = raw.kind === 'image-only' || (imageOnlyPages?.length ?? 0) > 0;

  if (needsOcr) {
    if (!options.ocr) return { kind: 'needs-ocr', pageCount: raw.pageCount };

    const { ocrPdf } = await import('../ocr/ocrEngine');
    const ocrResult = await ocrPdf(
      file,
      (p, label) => onProgress(54 + p * 0.38, label),
      options.ocrLanguage ?? 'eng',
      imageOnlyPages,
      options.signal,
    );
    const pageTexts = raw.pageTexts?.length
      ? raw.pageTexts.map((pageText, index) =>
          imageOnlyPages?.includes(index + 1)
            ? ocrResult.pageTexts?.[index] ?? ''
            : pageText,
        )
      : ocrResult.pageTexts ?? [];
    raw = {
      ...raw,
      spans: [...raw.spans, ...ocrResult.spans].sort((a, b) => a.page - b.page),
      pageTexts,
      text: pageTexts.join('\n'),
      kind: 'text-based',
      ocr: true,
    };
  }

  onProgress(92, 'Detecting invoice fields');

  const invoices = splitInvoices(raw).map((segment) => {
    const invoice = parseInvoice(segment.raw, options.locale ?? DEFAULT_LOCALE);
    return raw.ocr ? markAsOcr(invoice) : invoice;
  });

  return { kind: 'invoices', invoices, pageCount: raw.pageCount };
};
