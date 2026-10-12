import type { Invoice } from '../../types/invoice';
import { validateInvoice } from './invoiceValidator';
import type { ValidationCheck } from './totalsValidator';

export type ReviewStatus = 'PASS' | 'REVIEW';

export interface InvoiceAnalysis {
  checks: ValidationCheck[];
  reasons: string[];
  status: ReviewStatus;
}

/** Overall confidence below this always needs a human look. */
export const REVIEW_CONFIDENCE_THRESHOLD = 70;

/** Why an invoice needs review (empty = nothing flagged). */
export function reviewReasons(invoice: Invoice, checks: ValidationCheck[]): string[] {
  const reasons: string[] = [];

  for (const check of checks) {
    if (check.status === 'FAIL') reasons.push(`${check.check} does not reconcile`);
  }

  if (!invoice.invoiceNumber.value.trim()) reasons.push('Invoice number not found');
  if (!(invoice.grandTotal.value > 0)) reasons.push('Grand total not found');
  if (invoice.items.length === 0) reasons.push('No line items found');

  if (invoice.extraction.confidence < REVIEW_CONFIDENCE_THRESHOLD) {
    reasons.push(`Low overall confidence (${invoice.extraction.confidence}%)`);
  }

  // A guessed invoice number is a real risk (it keys the export). Other guesses - default
  // currency, seller taken from the first line, DD/MM date ambiguity - are flagged on the
  // field itself (amber hint in the review screen) so they do not mark every invoice "Review".
  if (invoice.invoiceNumber.warning) reasons.push(invoice.invoiceNumber.warning);

  reasons.push(...invoice.extraction.warnings);

  return [...new Set(reasons)];
}

const cache = new WeakMap<Invoice, InvoiceAnalysis>();

/** Validation + review status for an invoice, memoised per (immutable) invoice object. */
export function analyzeInvoice(invoice: Invoice): InvoiceAnalysis {
  const hit = cache.get(invoice);
  if (hit) return hit;

  const { checks } = validateInvoice(invoice);
  const reasons = reviewReasons(invoice, checks);
  const analysis: InvoiceAnalysis = { checks, reasons, status: reasons.length ? 'REVIEW' : 'PASS' };

  cache.set(invoice, analysis);

  return analysis;
}
