import { describe, expect, it } from 'vitest';
import { parseInvoice } from '../../features/extraction/invoiceParser';
import { spansToLines } from '../../features/pdf/textLines';
import { splitInvoices } from '../../features/extraction/splitInvoices';
import { markAsOcr, OCR_CONFIDENCE_CAP } from '../../features/extraction/ocrMarking';
import { validateInvoice } from '../../features/validation/invoiceValidator';
import type { PdfExtraction, TextSpan } from '../../types/extraction';

/** Builds a PdfExtraction the same way the real extractor does: positioned spans -> lines. */
function pdfFrom(rows: Array<Array<[string, number]>>): PdfExtraction {
  const spans: TextSpan[] = [];
  let y = 800;

  for (const row of rows) {
    for (const [text, x] of row) {
      spans.push({ text, x, y, width: text.length * 5, height: 10, page: 1 });
    }
    y -= 18;
  }

  return {
    fileName: 'test.pdf',
    pageCount: 1,
    spans,
    text: spansToLines(spans).join('\n'),
    kind: 'text-based',
  };
}

describe('invoice parser', () => {
  it('extracts labelled fields from plain text', () => {
    const i = parseInvoice({
      fileName: 'basic.pdf',
      pageCount: 1,
      kind: 'text-based',
      spans: [],
      text: 'INVOICE NO: INV-204\nInvoice Date: 17 Sep 2026\nSeller: Fictional Goods Ltd\nBuyer: Example Buyer\nSubtotal: 1000\nTax: 180\nGrand Total: 1180',
    });

    expect(i.invoiceNumber.value).toBe('INV-204');
    expect(i.invoiceDate.value).toBe('2026-09-17');
    expect(i.grandTotal.value).toBe(1180);
  });

  it('keeps every field on its own line when parsing a positioned PDF (regression: one-line text)', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Seller: ABC Traders Pvt Ltd', 50]],
        [['Invoice No: INV-2026-00125', 50]],
        [['Invoice Date: 17/09/2026', 50]],
        [['Due Date: 17/10/2026', 50]],
        [['Bill To: XYZ Ltd', 50]],
        [['Description', 50], ['Quantity', 300], ['Rate', 380], ['Amount', 460]],
        [['Widget A', 50], ['2', 300], ['500.00', 380], ['1,000.00', 460]],
        [['Gadget B', 50], ['3', 300], ['1,000.00', 380], ['3,000.00', 460]],
        [['Subtotal: 4,000.00', 50]],
        [['Tax: 720.00', 50]],
        [['Grand Total: 4,720.00', 50]],
      ]),
    );

    expect(i.invoiceNumber.value).toBe('INV-2026-00125');
    expect(i.invoiceDate.value).toBe('2026-09-17');
    expect(i.dueDate.value).toBe('2026-10-17');
    expect(i.seller.name.value).toBe('ABC Traders Pvt Ltd');
    expect(i.buyer.name.value).toBe('XYZ Ltd');
    expect(i.subtotal.value).toBe(4000);
    expect(i.taxTotal.value).toBe(720);
    expect(i.grandTotal.value).toBe(4720);
    expect(i.items).toHaveLength(2);
    expect(i.items[0].description.value).toBe('Widget A');
    expect(i.items[1].lineTotal.value).toBe(3000);
  });

  it('splits side-by-side header fields at column gaps', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Invoice No: INV-9', 50], ['Invoice Date: 05/09/2026', 350]],
        [['Grand Total: 100.00', 50]],
      ]),
    );

    expect(i.invoiceNumber.value).toBe('INV-9');
    expect(i.invoiceDate.value).toBe('2026-09-05');
    // 05/09 is ambiguous, so the user must be told.
    expect(i.invoiceDate.warning).toMatch(/ambiguous/i);
  });

  it('reads label/value pairs laid out as separate table columns', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Invoice No', 50], ['INV-77', 200]],
        [['Invoice Date', 50], ['17/09/2026', 200]],
        [['Grand Total', 50], ['INR 2,500.00', 200]],
      ]),
    );

    expect(i.invoiceNumber.value).toBe('INV-77');
    expect(i.invoiceDate.value).toBe('2026-09-17');
    expect(i.grandTotal.value).toBe(2500);
  });

  it('does not mistake the "Tax Invoice" title or "Tax ID" for the tax total', () => {
    const i = parseInvoice(
      pdfFrom([
        [['TAX INVOICE', 50]],
        [['Tax ID: 36ABCDE1234F1Z5', 50]],
        [['Subtotal: 100.00', 50]],
        [['Tax: 18.00', 50]],
        [['Grand Total: 118.00', 50]],
      ]),
    );

    expect(i.taxTotal.value).toBe(18);
  });

  it('sums CGST + SGST and gives seller and buyer their own GSTIN', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Seller: ABC Traders', 50]],
        [['GSTIN: 36ABCDE1234F1Z5', 50]],
        [['Bill To: XYZ Ltd', 50]],
        [['GSTIN: 29PQRSX5678L1ZK', 50]],
        [['Subtotal: 1,000.00', 50]],
        [['CGST: 90.00', 50]],
        [['SGST: 90.00', 50]],
        [['Grand Total: 1,180.00', 50]],
      ]),
    );

    expect(i.taxTotal.value).toBe(180);
    expect(i.seller.taxId.value).toBe('36ABCDE1234F1Z5');
    expect(i.buyer.taxId.value).toBe('29PQRSX5678L1ZK');
  });

  it('keeps digits in item descriptions out of the quantity and price columns', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Item', 50], ['HSN', 200], ['Qty', 260], ['Rate', 320], ['Amount', 400]],
        [['Cotton Fabric 40s', 50], ['5208', 200], ['10', 260], ['250.00', 320], ['2,500.00', 400]],
        [['Item 2', 50], ['9988', 200], ['4', 260], ['125.00', 320], ['500.00', 400]],
        [['Subtotal: 3,000.00', 50]],
      ]),
    );

    expect(i.items).toHaveLength(2);
    expect(i.items[0].description.value).toBe('Cotton Fabric 40s');
    expect(i.items[0].quantity.value).toBe(10);
    expect(i.items[0].unitPrice.value).toBe(250);
    expect(i.items[0].lineTotal.value).toBe(2500);
    expect(i.items[1].description.value).toBe('Item 2');
    expect(i.items[1].quantity.value).toBe(4);
  });

  it('reads "CGST @9%" style tax lines and ignores page footers inside the table', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Description', 50], ['Quantity', 260], ['Rate', 320], ['Amount', 400]],
        [['Widget', 50], ['2', 260], ['50.00', 320], ['100.00', 400]],
        [['Page 1 of 2', 50]],
        [['Subtotal: 100.00', 50]],
        [['CGST @9%: 9.00', 50]],
        [['SGST @9%: 9.00', 50]],
        [['Total: 118.00', 50]],
      ]),
    );

    expect(i.items).toHaveLength(1);
    expect(i.taxTotal.value).toBe(18);
    expect(i.grandTotal.value).toBe(118);
  });

  it('flags a missing currency instead of silently trusting a default', () => {
    const i = parseInvoice(pdfFrom([[['Invoice No: A-1', 50]], [['Grand Total: 10', 50]]]));

    expect(i.currency.confidence).toBeLessThan(70);
    expect(i.currency.warning).toBeTruthy();
  });

  it('reads values printed below their labels (label-above layout)', () => {
    const i = parseInvoice(
      pdfFrom([
        [['Northwind Stationers Pvt Ltd', 50]],
        [['Invoice No.', 50], ['Invoice Date', 230], ['Due Date', 400]],
        [['NW/2026/0815', 50], ['08/10/2026', 230], ['22/10/2026', 400]],
        [['Grand Total: 9,322.00', 50]],
      ]),
    );

    expect(i.invoiceNumber.value).toBe('NW/2026/0815');
    expect(i.invoiceDate.value).toBe('2026-10-08');
    expect(i.dueDate.value).toBe('2026-10-22');
    expect(i.seller.name.value).toBe('Northwind Stationers Pvt Ltd');
    // Found below the label, so slightly less certain than a same-line value.
    expect(i.invoiceNumber.confidence).toBeLessThan(90);
  });

  it('does not return another label as a value when a header row has no values', () => {
    const i = parseInvoice(pdfFrom([[['Invoice No', 50], ['Invoice Date', 230]], [['Grand Total: 10.00', 50]]]));

    expect(i.invoiceNumber.value).toBe('');
    expect(i.invoiceDate.value).toBe('');
  });

  it('reads per-line GST columns (CGST % + SGST % -> rate, amounts summed)', () => {
    const cols = [40, 66, 200, 250, 285, 330, 405, 445, 495, 530];
    const row = (cells: string[]): Array<[string, number]> => cells.map((c, n) => [c, cols[n]]);
    const i = parseInvoice(
      pdfFrom([
        row(['Sr', 'Description', 'HSN', 'Qty', 'Rate', 'Taxable Value', 'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt']),
        row(['1', 'Cotton Fabric 40s', '5208', '100', '250.00', '25,000.00', '2.5', '625.00', '2.5', '625.00']),
        row(['2', 'Stitching Service', '9988', '40', '125.00', '5,000.00', '2.5', '125.00', '2.5', '125.00']),
        [['Subtotal: 30,000.00', 50]],
        [['CGST: 750.00', 50]],
        [['SGST: 750.00', 50]],
        [['Grand Total: 31,500.00', 50]],
      ]),
    );

    expect(i.items).toHaveLength(2);
    expect(i.items[0].description.value).toBe('Cotton Fabric 40s');
    expect(i.items[0].quantity.value).toBe(100);
    expect(i.items[0].unitPrice.value).toBe(250);
    expect(i.items[0].lineTotal.value).toBe(25000);
    expect(i.items[0].taxRate.value).toBe(5);
    expect(i.items[0].taxAmount.value).toBe(1250);
    expect(i.taxTotal.value).toBe(1500);
    expect(validateInvoice(i).checks.every((c) => c.status === 'PASS')).toBe(true);
  });

  it('accepts line totals that include tax', () => {
    const cols = [50, 300, 360, 420, 480];
    const row = (cells: string[]): Array<[string, number]> => cells.map((c, n) => [c, cols[n]]);
    const i = parseInvoice(
      pdfFrom([
        row(['Description', 'Qty', 'Rate', 'Tax Amount', 'Amount']),
        row(['Widget', '2', '500.00', '180.00', '1,180.00']),
        [['Subtotal: 1,000.00', 50]],
        [['Tax: 180.00', 50]],
        [['Grand Total: 1,180.00', 50]],
      ]),
    );

    expect(validateInvoice(i).checks.every((c) => c.status === 'PASS')).toBe(true);
  });

  it('splits a PDF that holds several invoices, keeping multi-page invoices together', () => {
    const pageTexts = [
      'Invoice No: A-1\nGrand Total: 10.00',
      'Invoice No: B-2\nGrand Total: 20.00',
      'Invoice No: B-2\nItem  1  5.00  5.00',
      'Notes only, no number',
      'Invoice No: C-3\nGrand Total: 30.00',
    ];
    const spans: TextSpan[] = pageTexts.flatMap((t, p) =>
      t.split('\n').map((line, k) => ({ text: line, x: 50, y: 700 - k * 18, width: line.length * 5, height: 10, page: p + 1 })),
    );

    const segments = splitInvoices({
      fileName: 'bundle.pdf', pageCount: 5, spans, text: pageTexts.join('\n'), pageTexts, kind: 'text-based',
    });

    expect(segments.map((s) => [s.firstPage, s.lastPage])).toEqual([[1, 1], [2, 4], [5, 5]]);
    expect(segments[1].raw.pageCount).toBe(3);
    expect(segments[1].raw.spans.every((s) => s.page >= 2 && s.page <= 4)).toBe(true);
  });

  it('does not split a normal multi-page invoice whose pages repeat the same number', () => {
    const pageTexts = ['Invoice No: X-9\nItem 1', 'Invoice No: X-9\nItem 2', 'Invoice No: x-9\nTotal'];
    const spans: TextSpan[] = [];
    const segments = splitInvoices({
      fileName: 'one.pdf', pageCount: 3, spans, text: pageTexts.join('\n'), pageTexts, kind: 'text-based',
    });

    expect(segments).toHaveLength(1);
  });

  it('marks OCR output as OCR and caps its confidence below the HIGH band', () => {
    const i = markAsOcr(parseInvoice(pdfFrom([[['Invoice No: INV-1', 50]], [['Grand Total: 10.00', 50]]])));

    expect(i.extraction.sourceType).toBe('ocr');
    expect(i.invoiceNumber.source).toBe('ocr');
    expect(i.invoiceNumber.confidence).toBeLessThanOrEqual(OCR_CONFIDENCE_CAP);
    expect(i.extraction.warnings.join(' ')).toMatch(/OCR/);
  });
});
