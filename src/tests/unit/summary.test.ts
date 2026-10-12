import { describe, expect, it } from 'vitest';
import { findDuplicates, summarize } from '../../features/batch/summary';
import type { BatchRecord } from '../../types/batch';
import { emptyField, type Invoice } from '../../types/invoice';

const field = <T,>(value: T, confidence = 92) => ({ value, confidence, source: 'text' as const });
const party = (name: string) => ({
  name: field(name), address: field(''), taxId: field(''), email: field(''), phone: field(''),
});

const invoice = (number: string, total: number, currency = 'INR', confidence = 92): Invoice => ({
  invoiceNumber: field(number), invoiceDate: field('2026-10-01'), dueDate: field(''), currency: field(currency),
  seller: party('Seller Co'), buyer: party('Buyer Co'),
  items: [{
    description: field('Item'), quantity: field(1), unit: field('pcs'), unitPrice: field(total), discount: field(0),
    taxRate: field(0), taxAmount: field(0), lineTotal: field(total),
  }],
  subtotal: field(total), discountTotal: field(0), taxTotal: field(0), shipping: field(0), otherCharges: field(0),
  grandTotal: field(total),
  payment: { method: emptyField(''), reference: emptyField(''), terms: emptyField('') },
  extraction: { sourceType: 'text', confidence, warnings: [], sourceFile: 'f.pdf', pageCount: 1 },
});

const record = (id: string, inv?: Invoice, status: BatchRecord['status'] = 'ready'): BatchRecord => ({
  id, fileName: `${id}.pdf`, size: 1, status, progress: 100, label: '', invoice: inv,
});

describe('summarize', () => {
  it('counts statuses, averages confidence and totals per currency', () => {
    const summary = summarize([
      record('f1', invoice('A', 100)),
      record('f2', invoice('B', 250.5, 'INR', 50)),
      record('f3', invoice('C', 40, 'USD')),
      record('f4', undefined, 'error'),
      record('f5', undefined, 'needs-ocr'),
      record('f6', undefined, 'processing'),
    ]);

    expect(summary.invoices).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.needsOcr).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.needsReview).toBe(1); // the 50% confidence one
    expect(summary.passed).toBe(2);
    expect(summary.avgConfidence).toBe(78);
    expect(summary.totals).toEqual([
      { currency: 'INR', amount: 350.5 },
      { currency: 'USD', amount: 40 },
    ]);
  });

  it('counts a multi-invoice PDF as one file', () => {
    const summary = summarize([record('f1#1', invoice('A', 1)), record('f1#2', invoice('B', 2))]);
    expect(summary.files).toBe(1);
    expect(summary.invoices).toBe(2);
  });

  it('has no average for an empty batch', () => {
    expect(summarize([]).avgConfidence).toBeNull();
  });
});

describe('findDuplicates', () => {
  it('flags the same invoice number, seller and total appearing twice', () => {
    const dupes = findDuplicates([
      record('f1', invoice('INV-7', 500)),
      record('f2', invoice('INV-7', 500)),
      record('f3', invoice('INV-8', 500)),
      record('f4', invoice('INV-7', 999)),
    ]);

    expect([...dupes].sort()).toEqual(['f1', 'f2']);
  });

  it('ignores invoices without a number', () => {
    expect(findDuplicates([record('f1', invoice('', 5)), record('f2', invoice('', 5))]).size).toBe(0);
  });
});
