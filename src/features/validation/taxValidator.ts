import type { Invoice } from '../../types/invoice';
import type { ValidationCheck } from './totalsValidator';

export function validateTax(i: Invoice): ValidationCheck[] {
  const columnTax = Number(i.items.reduce((s, x) => s + x.taxAmount.value, 0).toFixed(2));
  const hasColumn = columnTax > 0;

  const expected = hasColumn
    ? columnTax
    : Number(i.items.reduce((s, x) => s + (x.lineTotal.value * x.taxRate.value) / 100, 0).toFixed(2));
  const actual = Number(i.taxTotal.value.toFixed(2));

  const noTaxData = !hasColumn && i.items.every((x) => x.taxRate.value === 0);
  const pass = Math.abs(expected - actual) <= 0.02 || noTaxData;

  return [
    {
      check: 'Tax arithmetic',
      expected,
      actual,
      status: pass ? 'PASS' : 'FAIL',
      message: pass
        ? hasColumn
          ? 'Tax total matches the sum of the line tax amounts.'
          : 'Tax is consistent with line rates where available.'
        : 'Tax total differs from the line tax columns; review them.',
    },
  ];
}
