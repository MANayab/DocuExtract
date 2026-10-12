import { describe, expect, it } from 'vitest';
import { analyzeInvoice } from '../../features/validation/analysis';
import { emptyField, type Invoice } from '../../types/invoice';

const field = <T,>(value: T, confidence = 92) => ({ value, confidence, source: 'text' as const });
const party = () => ({ name: field('Seller'), address: field(''), taxId: field(''), email: field(''), phone: field('') });

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  invoiceNumber: field('INV-1'), invoiceDate: field('2026-10-01'), dueDate: field(''), currency: field('INR'),
  seller: party(), buyer: party(),
  items: [{
    description: field('Item'), quantity: field(2), unit: field('pcs'), unitPrice: field(50), discount: field(0),
    taxRate: field(0), taxAmount: field(0), lineTotal: field(100),
  }],
  subtotal: field(100), discountTotal: field(0), taxTotal: field(0), shipping: field(0), otherCharges: field(0),
  grandTotal: field(100),
  payment: { method: emptyField(''), reference: emptyField(''), terms: emptyField('') },
  extraction: { sourceType: 'text', confidence: 90, warnings: [], sourceFile: 'a.pdf', pageCount: 1 },
  ...overrides,
});

describe('review status', () => {
  it('passes a consistent invoice', () => {
    expect(analyzeInvoice(invoice()).status).toBe('PASS');
  });

  it('flags totals that do not reconcile, with a reason a person can act on', () => {
    const result = analyzeInvoice(invoice({ grandTotal: field(999) }));

    expect(result.status).toBe('REVIEW');
    expect(result.reasons.join(' ')).toMatch(/Invoice total arithmetic does not reconcile/);
  });

  it('flags a missing invoice number, missing total and absent line items', () => {
    const result = analyzeInvoice(invoice({ invoiceNumber: field(''), grandTotal: field(0), items: [] }));

    expect(result.reasons).toEqual(
      expect.arrayContaining(['Invoice number not found', 'Grand total not found', 'No line items found']),
    );
  });

  it('flags low overall confidence and any extraction warning (such as OCR)', () => {
    expect(analyzeInvoice(invoice({ extraction: { sourceType: 'text', confidence: 55, warnings: [], sourceFile: 'a.pdf', pageCount: 1 } })).status).toBe('REVIEW');
    expect(analyzeInvoice(invoice({ extraction: { sourceType: 'ocr', confidence: 75, warnings: ['Read with OCR'], sourceFile: 'a.pdf', pageCount: 1 } })).status).toBe('REVIEW');
  });

  it('keeps guessed currency and ambiguous dates on the field instead of failing the invoice', () => {
    const result = analyzeInvoice(
      invoice({
        currency: { value: 'INR', confidence: 40, source: 'text', warning: 'No currency symbol found; defaulted to INR.' },
        invoiceDate: { value: '2026-10-05', confidence: 70, source: 'text', warning: 'Ambiguous date; read as DD/MM/YYYY.' },
      }),
    );

    expect(result.status).toBe('PASS');
  });

  it('accepts line totals that include tax and sums per-line tax amounts', () => {
    const result = analyzeInvoice(
      invoice({
        items: [{
          description: field('Item'), quantity: field(2), unit: field('pcs'), unitPrice: field(500), discount: field(0),
          taxRate: field(18), taxAmount: field(180), lineTotal: field(1180),
        }],
        subtotal: field(1000), taxTotal: field(180), grandTotal: field(1180),
      }),
    );

    expect(result.checks.every((c) => c.status === 'PASS')).toBe(true);
    expect(result.status).toBe('PASS');
  });

  it('memoises per invoice object but recomputes after an edit', () => {
    const original = invoice();
    expect(analyzeInvoice(original)).toBe(analyzeInvoice(original));

    const edited = { ...original, grandTotal: field(5) };
    expect(analyzeInvoice(edited)).not.toBe(analyzeInvoice(original));
    expect(analyzeInvoice(edited).status).toBe('REVIEW');
  });
});
