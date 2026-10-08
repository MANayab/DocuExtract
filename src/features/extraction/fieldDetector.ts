import type { ExtractedField, Party } from '../../types/invoice';
import { emptyField } from '../../types/invoice';
import { normalizeNumber } from '../normalization/normalizeNumbers';

const f = (
  value: string,
  confidence = 85,
  warning?: string,
): ExtractedField<string> => ({
  value: value.trim(),
  confidence,
  source: 'text',
  ...(warning ? { warning } : {}),
});

const escapeRegex = (label: string) =>
  label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alternation = (labels: string[]) => labels.map(escapeRegex).join('|');

/**
 * A wide gap (two or more spaces) marks a column break produced by the line
 * builder, so "Invoice No: INV-1   Date: 17/09/2026" yields only "INV-1".
 */
const firstColumn = (value: string) => value.split(/\s{2,}/)[0]?.trim() ?? '';

/** Text value following a label on the same line. */
function labelled(text: string, labels: string[]): string {
  const r = new RegExp(
    `\\b(?:${alternation(labels)})\\b[ \\t]*[:#-]?[ \\t]*([^\\n]+)`,
    'i',
  );

  return firstColumn(text.match(r)?.[1] ?? '');
}

const CURRENCY_TOKEN = '(?:₹|\\$|€|£|INR|USD|EUR|GBP|Rs\\.?)';

/** Amount (as raw text) following a label; skips matches that are not numbers. */
function labelledAmounts(text: string, labels: string[]): string[] {
  const r = new RegExp(
    `\\b(?:${alternation(labels)})\\b(?:[ \\t]*@?[ \\t]*\\(?\\d+(?:\\.\\d+)?[ \\t]*%\\)?)?[ \\t]*[:#-]?[ \\t]*${CURRENCY_TOKEN}?[ \\t]*` +
      `(\\(?-?\\d[\\d,]*(?:\\.\\d+)?\\)?)(?![A-Za-z\\d,]|\\.\\d|\\s*%)`,
    'gi',
  );

  return [...text.matchAll(r)].map((m) => m[1]);
}

const firstAmount = (text: string, labels: string[]) =>
  labelledAmounts(text, labels)[0] ?? '';

const lastLineAmount = (text: string, label: string) => {
  const r = new RegExp(
    `^[ \\t]*${label}\\b(?![ \\t]*(?:tax|gst|discount|qty|quantity))[ \\t]*[:#-]?[ \\t]*${CURRENCY_TOKEN}?[ \\t]*` +
      `(\\(?-?\\d[\\d,]*(?:\\.\\d+)?\\)?)(?![A-Za-z\\d,]|\\.\\d|\\s*%)`,
    'gim',
  );
  const all = [...text.matchAll(r)];
  return all.length ? all[all.length - 1][1] : '';
};

const amountField = (raw: string, hit: number, miss: number) => ({
  value: raw ? normalizeNumber(raw) : 0,
  confidence: raw ? hit : miss,
  source: 'text' as const,
});

export function detectHeaderFields(text: string) {
  const invoiceNumber = firstColumn(
    text.match(/\binvoice\s+(?:no(?:\.|\b)|number|#)\s*[:#-]?\s*([^\n]+)/i)?.[1] ??
      text.match(/\binv(?:oice)?\s*(?:no\.?|#)\s*[:#-]?\s*([^\n]+)/i)?.[1] ??
      '',
  );

  const invoiceDate =
    labelled(text, ['invoice date', 'date of issue', 'issue date']) ||
    firstColumn(
      text.match(
        /(?<!due |payment |ship |delivery )\bdate\b[ \t]*[:#-]?[ \t]*([^\n]+)/i,
      )?.[1] ?? '',
    );

  const dueDate = labelled(text, ['due date', 'payment due']);

  const currencyMatch = text.match(/₹|\$|€|£|\b(?:INR|USD|EUR|GBP)\b/i)?.[0];

  const subtotal = firstAmount(text, ['subtotal', 'sub total', 'sub-total']);

  const discountTotal = firstAmount(text, ['discount total', 'total discount', 'discount']);

  let taxTotalRaw = firstAmount(text, [
    'tax total',
    'total tax',
    'tax amount',
    'total gst',
    'gst total',
  ]);
  let taxTotalValue: number | undefined;

  if (!taxTotalRaw) {
    // Indian GST invoices usually split tax into CGST + SGST (or IGST).
    const parts = ['cgst', 'sgst', 'igst']
      .map((label) => firstAmount(text, [label]))
      .filter(Boolean);

    if (parts.length) {
      taxTotalValue = Number(
        parts.reduce((sum, raw) => sum + normalizeNumber(raw), 0).toFixed(2),
      );
      taxTotalRaw = parts.join('+');
    } else {
      taxTotalRaw = firstAmount(text, ['tax', 'gst', 'vat']);
    }
  }

  const shipping = firstAmount(text, ['shipping', 'freight', 'delivery charges']);

  const otherCharges = firstAmount(text, ['other charges', 'charges']);

  const grandTotal =
    firstAmount(text, [
      'grand total',
      'amount due',
      'balance due',
      'total amount',
      'total payable',
      'invoice total',
    ]) || lastLineAmount(text, 'total');

  const taxTotal = amountField(taxTotalRaw, 90, 45);
  if (taxTotalValue !== undefined) taxTotal.value = taxTotalValue;

  return {
    invoiceNumber: f(invoiceNumber, invoiceNumber ? 96 : 45),

    invoiceDate: f(invoiceDate, invoiceDate ? 90 : 40),

    dueDate: f(dueDate, dueDate ? 90 : 35),

    currency: currencyMatch
      ? f(currencyMatch, 95)
      : f('INR', 40, 'No currency symbol found; defaulted to INR. Please confirm.'),

    subtotal: amountField(subtotal, 90, 35),

    discountTotal: amountField(discountTotal, 90, 45),

    taxTotal,

    shipping: amountField(shipping, 85, 50),

    otherCharges: amountField(otherCharges, 85, 50),

    grandTotal: amountField(grandTotal, 96, 35),
  };
}

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE =
  /\b(?:phone|mobile|mob|tel|contact|ph)\b\.?[ \t]*(?:no\.?)?[ \t]*[:#-]?[ \t]*(\+?\d[\d ()-]{7,}\d)/gi;

const nth = (matches: string[], n: number) => matches[n] ?? '';

/** Issuer name guess: one of the first 3 lines, never a label, title or table-header line. */
function firstHeadingLine(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 3);

  for (const raw of lines) {
    const line = firstColumn(raw);
    if (!line || line.includes(':')) continue;
    if (/invoice|bill|ship|date|description|item|qty|quantity|total|original|duplicate|page\s+\d|^\d+$/i.test(line)) continue;
    return line;
  }
  return '';
}

export function detectParty(text: string, kind: 'seller' | 'buyer'): Party {
  const plain =
    kind === 'seller'
      ? ['seller', 'sold by', 'vendor', 'supplier']
      : ['buyer', 'bill to', 'billed to', 'customer', 'client'];

  // "from" is too common a word; only trust it when followed by a colon.
  const labelRegex = new RegExp(
    `\\b(?:${alternation(plain)})\\b[ \\t]*:?[ \\t]*\\n?[ \\t]*([^\\n]+)` +
      (kind === 'seller' ? `|\\bfrom[ \\t]*:[ \\t]*([^\\n]+)` : ''),
    'i',
  );

  const found = labelRegex.exec(text);
  const labelled_ = firstColumn(found?.[1] ?? found?.[2] ?? '');

  let name = labelled_;
  let nameConfidence = name ? 82 : 35;
  let nameWarning: string | undefined;

  if (!name && kind === 'seller') {
    name = firstHeadingLine(text);
    if (name) {
      nameConfidence = 50;
      nameWarning = 'No "Seller" label found; guessed from the first line.';
    }
  }

  // Parties are told apart by order of appearance: first hit = seller, second = buyer.
  const index = kind === 'seller' ? 0 : 1;
  const taxIds = text.match(GSTIN) ?? [];
  const emails = text.match(EMAIL) ?? [];
  const phones = [...text.matchAll(PHONE)].map((m) => m[1]);

  const tax = nth(taxIds, index);
  const email = nth(emails, index);
  const phone = nth(phones, index);

  return {
    name: f(name, nameConfidence, nameWarning),
    address: emptyField(''),
    taxId: f(tax, tax ? 94 : 35),
    email: f(email, email ? 94 : 35),
    phone: f(phone, phone ? 85 : 35),
  };
}
