import { buildSheets, type Cell, type ExportEntry, type SheetModel } from './workbookModel';

const quote = (cell: Cell) => {
  const s = cell === null ? '' : String(cell);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text for one sheet. Cells are already formula-sanitized by the workbook model. */
export function sheetToCsv(sheet: SheetModel): string {
  return [sheet.headers, ...sheet.rows].map((row) => row.map(quote).join(',')).join('\r\n');
}

/** UTF-8 with a BOM so Excel shows currency symbols (₹ € £) correctly. */
const toBlob = (csv: string) => new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });

const sheetFor = (entries: ExportEntry[], name: string) => {
  const found = buildSheets(entries).find((s) => s.name === name);
  if (!found) throw new Error(`Unknown sheet: ${name}`);
  return found;
};

/** One row per invoice, with totals, status and review notes. */
export const invoicesToCsv = (entries: ExportEntry[]): Blob => toBlob(sheetToCsv(sheetFor(entries, 'Invoices')));

/** One row per line item across all invoices. */
export const lineItemsToCsv = (entries: ExportEntry[]): Blob => toBlob(sheetToCsv(sheetFor(entries, 'Line Items')));
