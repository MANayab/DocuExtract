import type { BatchRecord } from '../../types/batch';
import { analyzeInvoice } from '../validation/analysis';

export interface BatchSummary {
  files: number;
  invoices: number;
  inProgress: number;
  failed: number;
  needsOcr: number;
  needsReview: number;
  passed: number;
  avgConfidence: number | null;
  totals: { currency: string; amount: number }[];
}

export function summarize(records: BatchRecord[]): BatchSummary {
  const fileIds = new Set(records.map((r) => r.id.split('#')[0]));
  const ready = records.filter((r) => r.status === 'ready' && r.invoice);
  const totals = new Map<string, number>();
  let confidence = 0;
  let needsReview = 0;

  for (const r of ready) {
    const invoice = r.invoice!;
    const currency = invoice.currency.value || 'INR';

    totals.set(currency, (totals.get(currency) ?? 0) + invoice.grandTotal.value);
    confidence += invoice.extraction.confidence;
    if (analyzeInvoice(invoice).status === 'REVIEW') needsReview++;
  }

  return {
    files: fileIds.size,
    invoices: ready.length,
    inProgress: records.filter((r) => r.status === 'queued' || r.status === 'processing').length,
    failed: records.filter((r) => r.status === 'error').length,
    needsOcr: records.filter((r) => r.status === 'needs-ocr').length,
    needsReview,
    passed: ready.length - needsReview,
    avgConfidence: ready.length ? Math.round(confidence / ready.length) : null,
    totals: [...totals.entries()].map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    })),
  };
}

/** Ids of records that look like the same invoice (same number, seller and total) as another one. */
export function findDuplicates(records: BatchRecord[]): Set<string> {
  const groups = new Map<string, string[]>();

  for (const r of records) {
    const invoice = r.invoice;
    const number = invoice?.invoiceNumber.value.trim().toLowerCase();

    if (!invoice || !number) continue;

    const key = [number, invoice.seller.name.value.trim().toLowerCase(), invoice.grandTotal.value].join('|');
    groups.set(key, [...(groups.get(key) ?? []), r.id]);
  }

  const duplicates = new Set<string>();

  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id) => duplicates.add(id));
  }

  return duplicates;
}
