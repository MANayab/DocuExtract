import type { PdfExtraction } from '../../types/extraction';
import { detectHeaderFields } from './fieldDetector';

export interface InvoiceSegment {
  raw: PdfExtraction;
  firstPage: number;
  lastPage: number;
}

/** Comparable form of an invoice number: first word, lower-case, letters and digits only. */
const keyOf = (value: string) =>
  (value.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Splits a PDF holding several invoices into one extraction per invoice.
 *
 * A new invoice starts on a page whose invoice number differs from the one
 * being read. Pages without a recognisable number continue the current
 * invoice, so ordinary multi-page invoices are never split.
 */
export function splitInvoices(raw: PdfExtraction): InvoiceSegment[] {
  const pages = raw.pageTexts;
  const whole: InvoiceSegment = { raw, firstPage: 1, lastPage: raw.pageCount };

  if (!pages || pages.length < 2) return [whole];

  const groups: { pages: number[]; key: string }[] = [];

  pages.forEach((text, index) => {
    const key = keyOf(detectHeaderFields(text).invoiceNumber.value);
    const last = groups[groups.length - 1];

    if (!last) {
      groups.push({ pages: [index + 1], key });
    } else if (key && last.key && key !== last.key) {
      groups.push({ pages: [index + 1], key });
    } else {
      last.pages.push(index + 1);
      if (!last.key && key) last.key = key;
    }
  });

  if (groups.length === 1) return [whole];

  return groups.map((group) => ({
    firstPage: group.pages[0],
    lastPage: group.pages[group.pages.length - 1],
    raw: {
      ...raw,
      pageCount: group.pages.length,
      spans: raw.spans.filter((s) => group.pages.includes(s.page)),
      text: group.pages.map((p) => pages[p - 1]).join('\n'),
      pageTexts: group.pages.map((p) => pages[p - 1]),
    },
  }));
}
