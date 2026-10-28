import type { Invoice } from '../../types/invoice';

export interface ValidationCheck {
  check: string;
  expected: number | null;
  actual: number | null;
  status: 'PASS' | 'FAIL';
  message: string;
}

const TOLERANCE = 0.02;
const round = (n: number) => Math.round(n * 100) / 100;
const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;

export function validateTotals(i: Invoice): ValidationCheck[] {
  const numericFields = [
    i.subtotal.value,
    i.discountTotal.value,
    i.taxTotal.value,
    i.shipping.value,
    i.otherCharges.value,
    i.grandTotal.value,
    ...i.items.flatMap((item) => [
      item.quantity.value,
      item.unitPrice.value,
      item.discount.value,
      item.taxRate.value,
      item.taxAmount.value,
      item.lineTotal.value,
    ]),
  ];
  if (numericFields.some((value) => !Number.isFinite(value))) {
    return [
      {
        check: 'Numeric extraction',
        expected: 0,
        actual: null,
        status: 'FAIL',
        message:
          'One or more amounts could not be parsed. Review the original extracted text before exporting.',
      },
    ];
  }
  const lineSum = round(i.items.reduce((s, x) => s + x.lineTotal.value, 0));
  const taxColumn = round(i.items.reduce((s, x) => s + x.taxAmount.value, 0));
  const subtotal = round(i.subtotal.value);

  // Some invoices print line totals including tax; accept that reading too.
  const lineExTax = round(lineSum - taxColumn);
  const subtotalMatches = near(lineSum, subtotal) || (taxColumn > 0 && near(lineExTax, subtotal));
  const subtotalExpected =
    taxColumn > 0 && !near(lineSum, subtotal) && near(lineExTax, subtotal) ? lineExTax : lineSum;

  const grandExpected = round(
    subtotal - i.discountTotal.value + i.taxTotal.value + i.shipping.value + i.otherCharges.value,
  );
  const grand = round(i.grandTotal.value);
  const grandOk = near(grandExpected, grand);

  return [
    {
      check: 'Line items → subtotal',
      expected: subtotalExpected,
      actual: subtotal,
      status: subtotalMatches ? 'PASS' : 'FAIL',
      message: subtotalMatches
        ? 'Line totals reconcile.'
        : `Difference: ${round(subtotal - lineSum).toFixed(2)}`,
    },
    {
      check: 'Invoice total arithmetic',
      expected: grandExpected,
      actual: grand,
      status: grandOk ? 'PASS' : 'FAIL',
      message: grandOk
        ? 'Header totals reconcile.'
        : `Difference: ${round(grand - grandExpected).toFixed(2)}`,
    },
  ];
}

export function validateLineItems(i: Invoice): ValidationCheck[] {
  if (
    i.items.some((item) =>
      [
        item.quantity.value,
        item.unitPrice.value,
        item.discount.value,
        item.taxRate.value,
        item.taxAmount.value,
        item.lineTotal.value,
      ].some((value) => !Number.isFinite(value)),
    )
  ) {
    return [
      {
        check: 'Line item numeric extraction',
        expected: 0,
        actual: Number.NaN,
        status: 'FAIL',
        message:
          'One or more line-item amounts could not be parsed. Review the original extracted text.',
      },
    ];
  }
  return i.items.map((x, n) => {
    const base = round(x.quantity.value * x.unitPrice.value - x.discount.value);
    const actual = round(x.lineTotal.value);
    const withTaxAmount = round(base + x.taxAmount.value);
    const withTaxRate = round(base * (1 + x.taxRate.value / 100));

    const pass =
      near(base, actual) ||
      (x.taxAmount.value > 0 && near(withTaxAmount, actual)) ||
      (x.taxRate.value > 0 && near(withTaxRate, actual));

    const includesTax = !near(base, actual) && pass;

    return {
      check: `Line ${n + 1} arithmetic`,
      expected: includesTax ? (near(withTaxAmount, actual) ? withTaxAmount : withTaxRate) : base,
      actual,
      status: pass ? 'PASS' : 'FAIL',
      message: pass
        ? includesTax
          ? 'Quantity × price − discount + tax reconciles (line total includes tax).'
          : 'Quantity × price − discount reconciles.'
        : `Difference: ${round(actual - base).toFixed(2)}`,
    } as ValidationCheck;
  });
}
