import type { Invoice } from '../../types/invoice';
import { analyzeInvoice } from '../validation/analysis';
import type { ValidationCheck } from '../validation/totalsValidator';
import { sanitizeCell } from './sanitizeCell';

export type Cell = string | number | null;

export interface ExportEntry {
  invoice: Invoice;
  checks: ValidationCheck[];
}

export interface SheetModel {
  name: string;
  headers: string[];
  rows: Cell[][];
  /** Zero-based columns that hold money / quantities and get a number format. */
  numberColumns: number[];
  widths: number[];
}

/** Every cell goes through the formula-injection sanitizer exactly once, here. */
const clean = (value: unknown): Cell => {
  const safe = typeof value === 'number' && !Number.isFinite(value) ? null : sanitizeCell(value);
  if (safe === null || safe === undefined) return null;
  if (typeof safe === 'boolean') return safe ? 'TRUE' : 'FALSE';
  return safe;
};

const cleanRow = (values: unknown[]): Cell[] => values.map(clean);

const round2 = (n: number) => Math.round(n * 100) / 100;

function widthsFor(headers: string[], rows: Cell[][]): number[] {
  return headers.map((header, i) => {
    let max = header.length;

    for (const row of rows) {
      const cell = row[i];
      if (cell !== null && cell !== undefined) max = Math.max(max, String(cell).length);
    }

    return Math.min(48, Math.max(11, max + 2));
  });
}

function sheet(name: string, headers: string[], rows: Cell[][], numberColumns: number[] = []): SheetModel {
  return { name, headers, rows, numberColumns, widths: widthsFor(headers, rows) };
}

/** Taxable base of a line: quantity x price - discount. */
const lineBase = (x: Invoice['items'][number]) =>
  round2(x.quantity.value * x.unitPrice.value - x.discount.value);

/** Builds the workbook content once; XLSX and CSV writers both consume it. */
export function buildSheets(entries: ExportEntry[]): SheetModel[] {
  const invoices = sheet(
    'Invoices',
    [
      'Invoice Number', 'Invoice Date', 'Due Date', 'Seller', 'Seller Tax ID', 'Buyer', 'Buyer Tax ID',
      'Currency', 'Subtotal', 'Discount', 'Tax', 'Shipping', 'Other Charges', 'Grand Total',
      'Payment Method', 'Source File', 'Source', 'Confidence', 'Status', 'Review Notes',
    ],
    entries.map(({ invoice: i }) => {
      const analysis = analyzeInvoice(i);

      return cleanRow([
        i.invoiceNumber.value, i.invoiceDate.value, i.dueDate.value, i.seller.name.value,
        i.seller.taxId.value, i.buyer.name.value, i.buyer.taxId.value, i.currency.value,
        i.subtotal.value, i.discountTotal.value, i.taxTotal.value, i.shipping.value,
        i.otherCharges.value, i.grandTotal.value, i.payment.method.value, i.extraction.sourceFile,
        i.extraction.sourceType === 'ocr' ? 'OCR' : 'PDF text', i.extraction.confidence,
        analysis.status, analysis.reasons.join('; '),
      ]);
    }),
    [8, 9, 10, 11, 12, 13],
  );

  const lineItems = sheet(
    'Line Items',
    [
      'Invoice Number', 'Line Number', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Discount',
      'Tax Rate', 'Tax Amount', 'Line Total', 'Source File',
    ],
    entries.flatMap(({ invoice: i }) =>
      i.items.map((x, n) =>
        cleanRow([
          i.invoiceNumber.value, n + 1, x.description.value, x.quantity.value, x.unit.value,
          x.unitPrice.value, x.discount.value, x.taxRate.value, x.taxAmount.value, x.lineTotal.value,
          i.extraction.sourceFile,
        ]),
      ),
    ),
    [3, 5, 6, 7, 8, 9],
  );

  const parties = sheet(
    'Parties',
    ['Invoice Number', 'Role', 'Name', 'Address', 'Tax ID', 'Email', 'Phone', 'Source File'],
    entries.flatMap(({ invoice: i }) =>
      (
        [
          ['Seller', i.seller],
          ['Buyer', i.buyer],
        ] as const
      ).map(([role, p]) =>
        cleanRow([
          i.invoiceNumber.value, role, p.name.value, p.address.value, p.taxId.value, p.email.value,
          p.phone.value, i.extraction.sourceFile,
        ]),
      ),
    ),
  );

  // Taxes: one row per (invoice, tax rate). Falls back to the header tax total.
  const taxRows: Cell[][] = [];

  for (const { invoice: i } of entries) {
    const byRate = new Map<number, { taxable: number; tax: number }>();

    for (const x of i.items) {
      if (x.taxRate.value <= 0 && x.taxAmount.value <= 0) continue;

      const entry = byRate.get(x.taxRate.value) ?? { taxable: 0, tax: 0 };
      entry.taxable += lineBase(x);
      entry.tax += x.taxAmount.value > 0 ? x.taxAmount.value : (lineBase(x) * x.taxRate.value) / 100;
      byRate.set(x.taxRate.value, entry);
    }

    if (byRate.size === 0 && i.taxTotal.value > 0) {
      taxRows.push(cleanRow([i.invoiceNumber.value, null, round2(i.subtotal.value), round2(i.taxTotal.value), i.extraction.sourceFile]));
      continue;
    }

    for (const [rate, v] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
      taxRows.push(cleanRow([i.invoiceNumber.value, rate, round2(v.taxable), round2(v.tax), i.extraction.sourceFile]));
    }
  }

  const taxes = sheet(
    'Taxes',
    ['Invoice Number', 'Tax Rate', 'Taxable Amount', 'Tax Amount', 'Source File'],
    taxRows,
    [1, 2, 3],
  );

  const validation = sheet(
    'Validation',
    ['Invoice Number', 'Check', 'Expected', 'Actual', 'Status', 'Message'],
    entries.flatMap(({ invoice: i, checks }) =>
      checks.map((c) => cleanRow([i.invoiceNumber.value, c.check, c.expected, c.actual, c.status, c.message])),
    ),
    [2, 3],
  );

  const metadata = sheet(
    'Extraction Metadata',
    ['Invoice Number', 'Source Type', 'Source File', 'Page Count', 'Confidence', 'Warnings'],
    entries.map(({ invoice: i }) =>
      cleanRow([
        i.invoiceNumber.value, i.extraction.sourceType, i.extraction.sourceFile, i.extraction.pageCount,
        i.extraction.confidence, i.extraction.warnings.join('; '),
      ]),
    ),
  );

  return [invoices, lineItems, parties, taxes, validation, metadata];
}
