import ExcelJS from 'exceljs';
import { buildSheets, type ExportEntry } from './workbookModel';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Writes the combined workbook: one row per invoice on "Invoices", plus
 * line items, parties, taxes, validation and extraction metadata for every
 * invoice. Cell content comes from the sanitized workbook model.
 */
export async function invoicesToXlsx(entries: ExportEntry[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();

  wb.creator = 'DocuExtract';
  wb.created = new Date();

  for (const model of buildSheets(entries)) {
    const ws = wb.addWorksheet(model.name);

    ws.columns = model.headers.map((header, i) => ({
      header,
      key: `c${i}`,
      width: model.widths[i],
    }));

    ws.addRows(model.rows);

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    head.alignment = { vertical: 'middle' };

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: model.headers.length } };

    for (const col of model.numberColumns) {
      ws.getColumn(col + 1).numFmt = '#,##0.00';
    }
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new Blob([buffer], { type: XLSX_MIME });
}
