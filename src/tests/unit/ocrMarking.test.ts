import { describe, expect, it } from 'vitest';
import { markAsOcr, OCR_CONFIDENCE_CAP } from '../../features/extraction/ocrMarking';
import { emptyField, type Invoice } from '../../types/invoice';

const field = <T>(value: T) => ({ value, confidence: 98, source: 'text' as const });
const party = () => ({
  name: field('Supplier'),
  address: field('Address'),
  taxId: field('GSTIN'),
  email: field('supplier@example.test'),
  phone: field('1234567890'),
});

const makeInvoice = (): Invoice => ({
  invoiceNumber: field('INV-001'),
  invoiceDate: field('2026-10-01'),
  dueDate: field('2026-10-31'),
  currency: field('INR'),
  seller: party(),
  buyer: party(),
  items: [
    {
      description: field('Widget'),
      quantity: field(1),
      unit: field('each'),
      unitPrice: field(100),
      discount: field(0),
      taxRate: field(18),
      taxAmount: field(18),
      lineTotal: field(118),
      hsn: field('1234'),
    },
  ],
  subtotal: field(100),
  discountTotal: field(0),
  taxTotal: field(18),
  shipping: field(0),
  otherCharges: field(0),
  grandTotal: field(118),
  payment: {
    method: emptyField(''),
    reference: emptyField(''),
    terms: emptyField(''),
  },
  extraction: {
    sourceType: 'text',
    confidence: 98,
    warnings: [],
    sourceFile: 'scan.pdf',
    pageCount: 1,
  },
});

describe('OCR review policy', () => {
  it.each(['eng', 'hin', 'deu'] as const)(
    'marks all %s OCR values for review and caps confidence',
    () => {
      const invoice = makeInvoice();
      markAsOcr(invoice);

      expect(invoice.extraction.sourceType).toBe('ocr');
      expect(invoice.extraction.confidence).toBe(OCR_CONFIDENCE_CAP);
      expect(invoice.invoiceNumber.source).toBe('ocr');
      expect(invoice.invoiceNumber.confidence).toBe(OCR_CONFIDENCE_CAP);
      expect(invoice.seller.name.source).toBe('ocr');
      expect(invoice.items[0].description.source).toBe('ocr');
      expect(invoice.grandTotal.confidence).toBe(OCR_CONFIDENCE_CAP);
      expect(invoice.extraction.warnings.join(' ')).toMatch(/review every value/i);
    },
  );
});
