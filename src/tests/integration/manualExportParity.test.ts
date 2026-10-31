// @vitest-environment node
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { BatchStore } from '../../features/batch/batchStore';
import { buildJson } from '../../features/export/jsonExporter';
import { invoicesToXlsx } from '../../features/export/xlsxExporter';
import type { ExportEntry } from '../../features/export/workbookModel';
import { emptyField, type Invoice } from '../../types/invoice';
import { validateInvoice } from '../../features/validation/invoiceValidator';

const field = <T>(value: T, source: 'text' | 'manual' = 'text') => ({
  value,
  confidence: source === 'manual' ? 100 : 92,
  source,
});

const makeInvoice = (): Invoice => ({
  invoiceNumber: field('INV-MANUAL', 'manual'),
  invoiceDate: field('2026-10-01'),
  dueDate: field('2026-10-15'),
  currency: field('INR'),
  seller: {
    name: field('Seller Co'),
    address: field(''),
    taxId: field(''),
    email: field(''),
    phone: field(''),
  },
  buyer: {
    name: field('Buyer Co'),
    address: field(''),
    taxId: field(''),
    email: field(''),
    phone: field(''),
  },
  items: [
    {
      description: field('Manually corrected item', 'manual'),
      quantity: field(3, 'manual'),
      unit: field('pcs'),
      unitPrice: field(400, 'manual'),
      discount: field(0),
      taxRate: field(0),
      taxAmount: field(0),
      lineTotal: field(1200, 'manual'),
    },
  ],
  subtotal: field(1200),
  discountTotal: field(0),
  taxTotal: field(0),
  shipping: field(0),
  otherCharges: field(0),
  grandTotal: field(1234, 'manual'),
  payment: {
    method: emptyField(''),
    reference: emptyField(''),
    terms: emptyField(''),
  },
  extraction: {
    sourceType: 'manual',
    confidence: 100,
    warnings: [],
    sourceFile: 'manual-edit.pdf',
    pageCount: 2,
  },
});

const entry = (invoice: Invoice): ExportEntry => ({
  invoice,
  checks: validateInvoice(invoice).checks,
});

describe('manual edit export parity', () => {
  it('keeps edited values consistent in XLSX, invoice CSV, line-item CSV and JSON', async () => {
    const original = makeInvoice();
    original.invoiceNumber = field('INV-RAW');
    original.grandTotal = field(1200);
    original.items[0].description = field('Original item');

    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [original],
      pageCount: 2,
    }));
    store.addFiles([new File(['%PDF-1.4'], 'manual-edit.pdf', { type: 'application/pdf' })]);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const record = store.getSnapshot()[0];
    expect(record.status).toBe('ready');

    const edited = structuredClone(original);
    edited.invoiceNumber = field('INV-MANUAL', 'manual');
    edited.grandTotal = field(1234, 'manual');
    edited.items[0].description = field('Manually corrected item', 'manual');
    store.updateInvoice(record.id, edited);

    const savedInvoice = store.getSnapshot()[0].invoice;
    expect(savedInvoice).toEqual(edited);
    const entries = [entry(savedInvoice!)];

    const workbookBlob = await invoicesToXlsx(entries);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await workbookBlob.arrayBuffer());

    expect(workbook.getWorksheet('Invoices')?.getCell(2, 1).value).toBe('INV-MANUAL');
    expect(workbook.getWorksheet('Invoices')?.getCell(2, 14).value).toBe(1234);
    expect(workbook.getWorksheet('Line Items')?.getCell(2, 3).value).toBe(
      'Manually corrected item',
    );

    const invoiceCsv = await invoicesToCsv(entries).text();
    const lineItemCsv = await lineItemsToCsv(entries).text();
    const json = buildJson(entries, '2026-10-30T00:00:00.000Z');

    expect(invoiceCsv).toContain('INV-MANUAL');
    expect(invoiceCsv).toContain('1234');
    expect(lineItemCsv).toContain('Manually corrected item');
    expect(json.invoices[0].invoice).toEqual(edited);
  });
});
