import { describe, expect, it } from 'vitest';
import { detectLineItems } from '../../features/extraction/tableDetector';
import type { TextSpan } from '../../types/extraction';

function spansForLines(lines: string[]): TextSpan[] {
  return lines.map((text, index) => ({
    text,
    x: 48,
    y: 800 - index * 24,
    width: text.length * 5,
    height: 12,
    page: 1,
  }));
}

describe('deterministic line-item parsing', () => {
  it('splits single-spaced quantity, rate and amount tokens in a basic invoice row', () => {
    const items = detectLineItems(
      spansForLines([
        'Description Quantity Unit Price Line Total',
        'Widget 2 500 1000',
        'Subtotal: 1000',
        'Tax: 180',
      ]),
      'Description Quantity Unit Price Line Total\nWidget 2 500 1000',
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Widget' },
      quantity: { value: 2 },
      unitPrice: { value: 500 },
      lineTotal: { value: 1000 },
    });
  });

  it('preserves punctuation-grouped amounts while separating GST row values', () => {
    const items = detectLineItems(
      spansForLines([
        'Description Quantity Unit Price Tax Amount Line Total',
        'Service 2 1,500 540 3,540',
        'Subtotal: 3000',
        'CGST: 270',
        'SGST: 270',
      ]),
      'Description Quantity Unit Price Tax Amount Line Total\nService 2 1,500 540 3,540',
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Service' },
      quantity: { value: 2 },
      unitPrice: { value: 1500 },
      taxAmount: { value: 540 },
      lineTotal: { value: 3540 },
    });
  });

  it('parses discount rows without treating the discount as the line amount', () => {
    const items = detectLineItems(
      spansForLines([
        'Description Quantity Unit Price Discount Line Total',
        'Item 2 500 100 900',
        'Subtotal: 900',
        'Discount: 100',
      ]),
      'Description Quantity Unit Price Discount Line Total\nItem 2 500 100 900',
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Item' },
      quantity: { value: 2 },
      unitPrice: { value: 500 },
      discount: { value: 100 },
      lineTotal: { value: 900 },
    });
  });

  it('keeps rows from separate PDF pages independent', () => {
    const spans = spansForLines([
      'Description Quantity Unit Price Line Total',
      'Consulting 2 500 1000',
    ]).map((span) => ({ ...span, page: 1 }));
    spans.push({
      text: 'Tax: 180',
      x: 48,
      y: 800,
      width: 50,
      height: 12,
      page: 2,
    });

    const items = detectLineItems(
      spans,
      'Description Quantity Unit Price Line Total\nConsulting 2 500 1000\nTax: 180',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Consulting' },
      quantity: { value: 2 },
      unitPrice: { value: 500 },
      lineTotal: { value: 1000 },
    });
  });

  it('extracts the one-column quantity and amount layout used by sparse invoices', () => {
    const items = detectLineItems(
      spansForLines(['Description Quantity Unit Price Line Total', 'Item 1 100 100']),
      'Description Quantity Unit Price Line Total\nItem 1 100 100',
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Item' },
      quantity: { value: 1 },
      unitPrice: { value: 100 },
      lineTotal: { value: 100 },
    });
  });

  it('joins wrapped description lines to the following numeric row', () => {
    const items = detectLineItems(
      spansForLines([
        'Description Quantity Unit Price Line Total',
        'Industrial consulting and',
        'implementation support 2 500 1000',
        'Subtotal: 1000',
      ]),
      [
        'Description Quantity Unit Price Line Total',
        'Industrial consulting and',
        'implementation support 2 500 1000',
      ].join('\\n'),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      description: { value: 'Industrial consulting and implementation support' },
      quantity: { value: 2 },
      unitPrice: { value: 500 },
      lineTotal: { value: 1000 },
    });
  });
});
