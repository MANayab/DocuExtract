import { describe, expect, it } from 'vitest';
import { sanitizeCell } from '../../features/export/sanitizeCell';
import { normalizeNumber } from '../../features/normalization/normalizeNumbers';
import { validateTax } from '../../features/validation/taxValidator';
import { validateTotals } from '../../features/validation/totalsValidator';
import type { Invoice } from '../../types/invoice';

describe('invalid numeric extraction safety', () => {
  it('does not turn invalid parser results into a plausible exported zero', () => {
    const parsed = normalizeNumber('not a number', 'en-IN');
    expect(Number.isNaN(parsed)).toBe(true);
    expect(sanitizeCell(parsed)).toBeNull();
    expect(sanitizeCell(0)).toBe(0);
  });

  it('blocks totals and tax reconciliation when numeric fields are invalid', () => {
    const invoice = {
      items: [],
      subtotal: { value: Number.NaN },
      discountTotal: { value: 0 },
      taxTotal: { value: Number.NaN },
      shipping: { value: 0 },
      otherCharges: { value: 0 },
      grandTotal: { value: Number.NaN },
    } as unknown as Invoice;

    expect(validateTotals(invoice).some((check) => check.status === 'FAIL')).toBe(true);
    expect(validateTax(invoice).some((check) => check.status === 'FAIL')).toBe(true);
  });
});
