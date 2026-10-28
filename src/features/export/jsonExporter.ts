import { analyzeInvoice } from '../validation/analysis';
import type { ExportEntry } from './workbookModel';
import { SITE } from '../../content/site';

export const APP_VERSION = SITE.version;

export function buildJson(entries: ExportEntry[], exportedAt = new Date().toISOString()) {
  return {
    generator: 'DocuExtract',
    version: APP_VERSION,
    exportedAt,
    count: entries.length,
    invoices: entries.map(({ invoice, checks }) => {
      const analysis = analyzeInvoice(invoice);

      return {
        invoice,
        validation: { status: analysis.status, reasons: analysis.reasons, checks },
      };
    }),
  };
}

export const invoicesToJson = (entries: ExportEntry[]): Blob =>
  new Blob([JSON.stringify(buildJson(entries), null, 2)], {
    type: 'application/json;charset=utf-8',
  });
