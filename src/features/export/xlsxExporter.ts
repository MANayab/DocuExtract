import ExcelJS from 'exceljs';
import type { Invoice } from '../../types/invoice';
import { sanitizeCell, sanitizeRow } from './sanitizeCell';
import type { ValidationCheck } from '../validation/totalsValidator';

const add = (
  wb: ExcelJS.Workbook,
  name: string,
  headers: string[],
) => {
  const s = wb.addWorksheet(name);

  s.addRow(headers);
  s.getRow(1).font = { bold: true };
  s.views = [{ state: 'frozen', ySplit: 1 }];

  return s;
};

export async function invoiceToXlsx(
  i: Invoice,
  checks: ValidationCheck[],
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  wb.creator = 'DocuExtract';

  const inv = add(wb, 'Invoices', [
    'Invoice Number',
    'Invoice Date',
    'Due Date',
    'Seller',
    'Seller Tax ID',
    'Buyer',
    'Buyer Tax ID',
    'Currency',
    'Subtotal',
    'Discount',
    'Tax',
    'Shipping',
    'Other Charges',
    'Grand Total',
    'Payment Method',
    'Source File',
    'Confidence',
    'Status',
  ]);

  inv.addRow(sanitizeRow([
    i.invoiceNumber.value,
    i.invoiceDate.value,
    i.dueDate.value,
    i.seller.name.value,
    i.seller.taxId.value,
    i.buyer.name.value,
    i.buyer.taxId.value,
    i.currency.value,
    i.subtotal.value,
    i.discountTotal.value,
    i.taxTotal.value,
    i.shipping.value,
    i.otherCharges.value,
    i.grandTotal.value,
    i.payment.method.value,
    i.extraction.sourceFile,
    i.extraction.confidence,
    checks.every((x) => x.status === 'PASS') ? 'PASS' : 'REVIEW',
  ]));

  const li = add(wb, 'Line Items', [
    'Invoice Number',
    'Line Number',
    'Description',
    'Quantity',
    'Unit',
    'Unit Price',
    'Discount',
    'Tax Rate',
    'Tax Amount',
    'Line Total',
  ]);

  i.items.forEach((x, n) => {
    li.addRow(sanitizeRow([
      i.invoiceNumber.value,
      n + 1,
      x.description.value,
      x.quantity.value,
      x.unit.value,
      x.unitPrice.value,
      x.discount.value,
      x.taxRate.value,
      x.taxAmount.value,
      x.lineTotal.value,
    ]));
  });

  const parties = add(wb, 'Parties', [
    'Invoice Number',
    'Role',
    'Name',
    'Address',
    'Tax ID',
    'Email',
    'Phone',
  ]);

  for (const [role, p] of [
    ['Seller', i.seller],
    ['Buyer', i.buyer],
  ] as const) {
    parties.addRow(sanitizeRow([
      i.invoiceNumber.value,
      role,
      p.name.value,
      p.address.value,
      p.taxId.value,
      p.email.value,
      p.phone.value,
    ]));
  }

  const taxes = add(wb, 'Taxes', [
    'Invoice Number',
    'Tax Rate',
    'Tax Amount',
  ]);

  i.items.forEach((x) => {
    taxes.addRow(sanitizeRow([
      i.invoiceNumber.value,
      x.taxRate.value,
      x.taxAmount.value,
    ]));
  });

  const val = add(wb, 'Validation', [
    'Invoice Number',
    'Check',
    'Expected',
    'Actual',
    'Status',
    'Message',
  ]);

  checks.forEach((x) => {
    val.addRow(sanitizeRow([
      i.invoiceNumber.value,
      x.check,
      x.expected,
      x.actual,
      x.status,
      x.message,
    ]));
  });

  const meta = add(wb, 'Extraction Metadata', [
    'Invoice Number',
    'Source Type',
    'Source File',
    'Page Count',
    'Confidence',
    'Warnings',
  ]);

  meta.addRow(sanitizeRow([
    i.invoiceNumber.value,
    i.extraction.sourceType,
    i.extraction.sourceFile,
    i.extraction.pageCount,
    i.extraction.confidence,
    i.extraction.warnings.join('; '),
  ]));

  /*
   * Auto-size worksheet columns.
   *
   * ExcelJS types the eachCell method as optional, so we
   * explicitly guard it before invoking it.
   */
  for (const ws of wb.worksheets) {
    ws.columns.forEach((column) => {
      let max = 12;

      if (column.eachCell) {
        column.eachCell(
          { includeEmpty: false },
          (cell) => {
            const valueLength = String(
              sanitizeCell(cell.value) ?? '',
            ).length + 2;

            max = Math.min(
              45,
              Math.max(max, valueLength),
            );
          },
        );
      }

      column.width = max;
    });
  }

  /*
   * Format numeric cells.
   */
  for (const ws of [inv, li, val]) {
    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        });
      }
    });
  }

  const buf = await wb.xlsx.writeBuffer();

  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}