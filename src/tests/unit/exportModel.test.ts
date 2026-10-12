// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sheetToCsv, invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { buildJson } from '../../features/export/jsonExporter';
import { buildSheets, type ExportEntry } from '../../features/export/workbookModel';
import { emptyField, type Invoice } from '../../types/invoice';
import { validateInvoice } from '../../features/validation/invoiceValidator';

const field = <T,>(value: T, confidence = 92) => ({ value, confidence, source: 'text' as const });
const party = (name: string, tax = '') => ({
  name: field(name), address: field(''), taxId: field(tax), email: field(''), phone: field(''),
});
const item = (description: string, qty: number, price: number, taxRate = 0, taxAmount = 0) => ({
  description: field(description), quantity: field(qty), unit: field('pcs'), unitPrice: field(price),
  discount: field(0), taxRate: field(taxRate), taxAmount: field(taxAmount), lineTotal: field(qty * price),
});

function invoice(number: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceNumber: field(number), invoiceDate: field('2026-10-01'), dueDate: field('2026-10-15'),
    currency: field('INR'), seller: party('Seller Co', '36ABCDE1234F1Z5'), buyer: party('Buyer Co'),
    items: [item('Widget', 2, 500, 18, 180), item('Gadget', 1, 1000, 18, 180)],
    subtotal: field(2000), discountTotal: field(0), taxTotal: field(360), shipping: field(0),
    otherCharges: field(0), grandTotal: field(2360),
    payment: { method: field('UPI'), reference: emptyField(''), terms: emptyField('') },
    extraction: { sourceType: 'text', confidence: 92, warnings: [], sourceFile: `${number}.pdf`, pageCount: 1 },
    ...overrides,
  };
}

const entry = (i: Invoice): ExportEntry => ({ invoice: i, checks: validateInvoice(i).checks });

describe('workbook model', () => {
  const entries = [entry(invoice('INV-1')), entry(invoice('INV-2'))];
  const sheets = buildSheets(entries);
  const byName = (n: string) => sheets.find((s) => s.name === n)!;

  it('has the six documented sheets in order', () => {
    expect(sheets.map((s) => s.name)).toEqual([
      'Invoices', 'Line Items', 'Parties', 'Taxes', 'Validation', 'Extraction Metadata',
    ]);
  });

  it('writes one Invoices row per invoice and every line item once', () => {
    expect(byName('Invoices').rows).toHaveLength(2);
    expect(byName('Line Items').rows).toHaveLength(4);
    expect(byName('Parties').rows).toHaveLength(4);
    expect(byName('Invoices').rows.every((r) => r.length === byName('Invoices').headers.length)).toBe(true);
  });

  it('reports PASS for a reconciling invoice and REVIEW with notes for a broken one', () => {
    const broken = entry(invoice('INV-3', { grandTotal: field(9999) }));
    const model = buildSheets([entries[0], broken]).find((s) => s.name === 'Invoices')!;
    const status = model.headers.indexOf('Status');
    const notes = model.headers.indexOf('Review Notes');

    expect(model.rows[0][status]).toBe('PASS');
    expect(model.rows[1][status]).toBe('REVIEW');
    expect(String(model.rows[1][notes])).toMatch(/Invoice total arithmetic/);
  });

  it('groups taxes by rate with the taxable amount', () => {
    const taxes = byName('Taxes');
    expect(taxes.rows[0].slice(0, 4)).toEqual(['INV-1', 18, 2000, 360]);
  });

  it('formula-sanitizes every text cell, in every sheet', () => {
    const evil = entry(
      invoice('=cmd|"/c calc"!A1', {
        seller: party('=HYPERLINK("http://evil","x")'),
        items: [item('+SUM(A1:A9)', 1, 10), item('@now', 1, 5)],
      }),
    );

    for (const sheet of buildSheets([evil])) {
      for (const row of sheet.rows) {
        for (const cell of row) {
          if (typeof cell === 'string') expect(cell).not.toMatch(/^[=+\-@\t\r]/);
        }
      }
    }

    expect(byName('Invoices').rows[0][0]).toBe('INV-1');
    expect(buildSheets([evil])[0].rows[0][0]).toBe("'=cmd|\"/c calc\"!A1");
  });
});

describe('csv export', () => {
  it('quotes commas, quotes and newlines and uses CRLF', () => {
    const csv = sheetToCsv({
      name: 't', headers: ['a', 'b'], rows: [['x,y', 'say "hi"'], ['line1\nline2', null]], numberColumns: [], widths: [],
    });

    expect(csv).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line1\nline2",');
  });

  it('exports invoices and line items as separate files, with a UTF-8 BOM for Excel', async () => {
    const entries = [entry(invoice('INV-1')), entry(invoice('INV-2'))];
    const invoicesBlob = invoicesToCsv(entries);
    const invoicesText = await invoicesBlob.text();
    const itemsText = await lineItemsToCsv(entries).text();

    // Blob.text() drops the BOM when decoding, so check the raw bytes.
    const head = Array.from(new Uint8Array(await invoicesBlob.arrayBuffer()).slice(0, 3));
    expect(head).toEqual([0xef, 0xbb, 0xbf]);
    expect(invoicesText.split('\r\n')).toHaveLength(3);
    expect(itemsText.split('\r\n')).toHaveLength(5);
    expect(itemsText).toContain('Widget');
  });
});

describe('json export', () => {
  it('wraps all invoices with validation status', () => {
    const json = buildJson([entry(invoice('INV-1'))], '2026-10-10T00:00:00.000Z');

    expect(json.count).toBe(1);
    expect(json.exportedAt).toBe('2026-10-10T00:00:00.000Z');
    expect(json.invoices[0].validation.status).toBe('PASS');
    expect(json.invoices[0].invoice.invoiceNumber.value).toBe('INV-1');
  });
});
