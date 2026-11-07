import type { PdfExtraction } from '../../types/extraction';
import type { Invoice } from '../../types/invoice';
import { detectHeaderFields, detectParty } from './fieldDetector';
import { detectLineItems } from './tableDetector';
import { normalizeInvoice } from '../normalization/normalizeInvoice';
import { overallConfidence } from './confidence';
import { buildRows } from '../pdf/textLines';
import { DEFAULT_LOCALE, type LocaleCode } from '../../config/locales';

const normalizeIndicDigits = (value: string) =>
  value.replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));

export function parseInvoice(raw: PdfExtraction, locale: LocaleCode = DEFAULT_LOCALE): Invoice {
  // Hindi OCR returns native Devanagari digits. Normalize only the parser's
  // working copy so invoice text remains intact while numeric fields parse.
  const parserText = normalizeIndicDigits(raw.text);
  const parserSpans = raw.spans.map((span) => ({
    ...span,
    text: normalizeIndicDigits(span.text),
  }));
  const h = detectHeaderFields(parserText, buildRows(parserSpans), locale);
  const items = detectLineItems(parserSpans, parserText, locale);
  const paymentMethod =
    parserText.match(/(?:payment method|paid via)\\s*[:#-]?\\s*([^\\n]+)/i)?.[1] ?? '';
  const reference =
    parserText.match(/(?:reference|transaction id|utr)\\s*[:#-]?\\s*([^\\n]+)/i)?.[1] ?? '';
  const terms = parserText.match(/(?:payment terms|terms)\\s*[:#-]?\\s*([^\\n]+)/i)?.[1] ?? '';
  const values = [
    h.invoiceNumber.confidence,
    h.invoiceDate.confidence,
    h.grandTotal.confidence,
    ...items.flatMap((i) => [
      i.description.confidence,
      i.quantity.confidence,
      i.unitPrice.confidence,
      i.lineTotal.confidence,
    ]),
  ];
  const i: Invoice = {
    invoiceNumber: h.invoiceNumber,
    invoiceDate: h.invoiceDate,
    dueDate: h.dueDate,
    currency: h.currency,
    seller: detectParty(parserText, 'seller'),
    buyer: detectParty(parserText, 'buyer'),
    items,
    subtotal: h.subtotal,
    discountTotal: h.discountTotal,
    taxTotal: h.taxTotal,
    shipping: h.shipping,
    otherCharges: h.otherCharges,
    grandTotal: h.grandTotal,
    payment: {
      method: { value: paymentMethod.trim(), confidence: paymentMethod ? 85 : 30, source: 'text' },
      reference: { value: reference.trim(), confidence: reference ? 85 : 30, source: 'text' },
      terms: { value: terms.trim(), confidence: terms ? 85 : 30, source: 'text' },
    },
    extraction: {
      sourceType: 'text',
      confidence: overallConfidence(values),
      warnings: [],
      sourceFile: raw.fileName,
      pageCount: raw.pageCount,
    },
  };
  return normalizeInvoice(i, locale);
}
