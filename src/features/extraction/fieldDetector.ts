import type { ExtractedField, Party } from '../../types/invoice';
import { emptyField } from '../../types/invoice';
import { normalizeNumber } from '../normalization/normalizeNumbers';
import { DEFAULT_LOCALE, type LocaleCode } from '../../config/locales';
import type { LayoutCell, LayoutRow } from '../pdf/textLines';

const f = (value: string, confidence = 85, warning?: string): ExtractedField<string> => ({
  value: value.trim(),
  confidence,
  source: 'text',
  ...(warning ? { warning } : {}),
});

const escapeRegex = (label: string) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const alternation = (labels: string[]) => labels.map(escapeRegex).join('|');

/**
 * A wide gap (two or more spaces) marks a column break produced by the line
 * builder, so "Invoice No: INV-1   Date: 17/09/2026" yields only "INV-1".
 */
const firstColumn = (value: string) => value.split(/\s{2,}/)[0]?.trim() ?? '';

/** Text value following a label on the same line. */
function labelled(text: string, labels: string[]): string {
  const r = new RegExp(`\\b(?:${alternation(labels)})\\b[ \\t]*[:#-]?[ \\t]*([^\\n]+)`, 'i');

  return firstColumn(text.match(r)?.[1] ?? '');
}

/** Text that is itself a field label ("Invoice Date"), so it cannot be a value. */
const LABEL_LIKE =
  /^(?:invoice\s*(?:no|number|date|#)|date\b|due\s*date|payment\s*due|bill(?:ed)?\s*to|ship(?:ped)?\s*to|gstin|tax\s*id|total\b|sub\s*total|grand\s*total|amount\b|qty\b|quantity\b|description\b|item\b|seller\b|buyer\b|customer\b|vendor\b)/i;

const looksLikeLabel = (value: string) => LABEL_LIKE.test(value.trim());

/**
 * Value printed directly below a label cell ("Invoice No." above "INV-77").
 * The value is the cell on the next row that overlaps the label horizontally.
 */
function valueBelow(rows: LayoutRow[] | undefined, labels: string[]): string {
  if (!rows) return '';

  const exact = new RegExp(`^(?:${alternation(labels)})\\s*[:#.]*$`, 'i');

  for (let i = 0; i < rows.length - 1; i++) {
    const label = rows[i].cells.find((c) => exact.test(c.text.trim()));
    const next = rows[i + 1];

    if (!label || next.page !== rows[i].page || rows[i].y - next.y > 45) continue;

    let best: LayoutCell | undefined;
    let bestOverlap = 0;

    for (const cell of next.cells) {
      const overlap = Math.min(cell.x1, label.x1 + 20) - Math.max(cell.x0, label.x0 - 20);

      if (overlap > bestOverlap) {
        best = cell;
        bestOverlap = overlap;
      }
    }

    if (best && !looksLikeLabel(best.text)) return best.text.trim();
  }

  return '';
}

const CURRENCY_TOKEN = '(?:₹|\\$|€|£|INR|USD|EUR|GBP|Rs\\.?)';

/** Amount (as raw text) following a label; skips matches that are not numbers. */
function labelledAmounts(text: string, labels: string[]): string[] {
  const r = new RegExp(
    `\\b(?:${alternation(labels)})\\b(?:[ \\t]*@?[ \\t]*\\(?\\d+(?:\\.\\d+)?[ \\t]*%\\)?)?[ \\t]*[:#-]?[ \\t]*${CURRENCY_TOKEN}?[ \\t]*` +
      `(\\(?-?[\\d][\\d., ]*\\d\\)?)(?![A-Za-z\\d,]|\\s*%)`,
    'gi',
  );

  return [...text.matchAll(r)].map((m) => m[1]);
}

const firstAmount = (text: string, labels: string[]) => labelledAmounts(text, labels)[0] ?? '';

const lastLineAmount = (text: string, label: string) => {
  const r = new RegExp(
    `^[ \\t]*${label}\\b(?![ \\t]*(?:tax|gst|discount|qty|quantity))[ \\t]*[:#-]?[ \\t]*${CURRENCY_TOKEN}?[ \\t]*` +
      `(\\(?-?\\d[\\d,]*(?:\\.\\d+)?\\)?)(?![A-Za-z\\d,]|\\.\\d|\\s*%)`,
    'gim',
  );
  const all = [...text.matchAll(r)];
  return all.length ? all[all.length - 1][1] : '';
};

const amountField = (raw: string, hit: number, miss: number, locale: LocaleCode) => {
  const value = raw ? normalizeNumber(raw, locale) : 0;
  return {
    value,
    confidence: raw ? (Number.isFinite(value) ? hit : Math.min(hit, 35)) : miss,
    source: 'text' as const,
    ...(raw && !Number.isFinite(value)
      ? {
          warning: `Could not parse amount "${raw}" using ${locale}; please review the original text.`,
        }
      : {}),
  };
};

export function detectHeaderFields(
  text: string,
  rows?: LayoutRow[],
  locale: LocaleCode = DEFAULT_LOCALE,
) {
  const sameLineNumber = firstColumn(
    text.match(/\binvoice\s+(?:no(?:\.|\b)|number|#)\s*[:#-]?\s*([^\n]+)/i)?.[1] ??
      text.match(/\binv(?:oice)?\s*(?:no\.?|#)\s*[:#-]?\s*([^\n]+)/i)?.[1] ??
      '',
  );
  const invoiceNumberSame = looksLikeLabel(sameLineNumber) ? '' : sameLineNumber;
  const invoiceNumberBelow = invoiceNumberSame
    ? ''
    : valueBelow(rows, [
        'invoice no',
        'invoice number',
        'invoice #',
        'inv no',
        'bill no',
        'bill number',
      ]);
  const invoiceNumber = invoiceNumberSame || invoiceNumberBelow;

  const sameLineDate =
    labelled(text, ['invoice date', 'date of issue', 'issue date']) ||
    firstColumn(
      text.match(/(?<!due |payment |ship |delivery )\bdate\b[ \t]*[:#-]?[ \t]*([^\n]+)/i)?.[1] ??
        '',
    );
  const invoiceDateSame = looksLikeLabel(sameLineDate) ? '' : sameLineDate;
  const invoiceDateBelow = invoiceDateSame
    ? ''
    : valueBelow(rows, ['invoice date', 'date', 'date of issue', 'issue date']);
  const invoiceDate = invoiceDateSame || invoiceDateBelow;

  const sameLineDue = labelled(text, ['due date', 'payment due']);
  const dueDateSame = looksLikeLabel(sameLineDue) ? '' : sameLineDue;
  const dueDateBelow = dueDateSame ? '' : valueBelow(rows, ['due date', 'payment due', 'due on']);
  const dueDate = dueDateSame || dueDateBelow;

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
        parts.reduce((sum, raw) => sum + normalizeNumber(raw, locale), 0).toFixed(2),
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

  const taxTotal = amountField(taxTotalRaw, 90, 45, locale);
  if (taxTotalValue !== undefined) taxTotal.value = taxTotalValue;

  return {
    invoiceNumber: f(invoiceNumber, invoiceNumberSame ? 96 : invoiceNumberBelow ? 84 : 45),

    invoiceDate: f(invoiceDate, invoiceDateSame ? 90 : invoiceDateBelow ? 80 : 40),

    dueDate: f(dueDate, dueDateSame ? 90 : dueDateBelow ? 80 : 35),

    currency: currencyMatch
      ? f(currencyMatch, 95)
      : f('INR', 40, 'No currency symbol found; defaulted to INR. Please confirm.'),

    subtotal: amountField(subtotal, 90, 35, locale),

    discountTotal: amountField(discountTotal, 90, 45, locale),

    taxTotal,

    shipping: amountField(shipping, 85, 50, locale),

    otherCharges: amountField(otherCharges, 85, 50, locale),

    grandTotal: amountField(grandTotal, 96, 35, locale),
  };
}

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g;
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE =
  /\b(?:phone|mobile|mob|tel|contact|ph)\b\.?[ \t]*(?:no\.?)?[ \t]*[:#-]?[ \t]*(\+?\d[\d ()-]{7,}\d)/gi;

const nth = (matches: string[], n: number) => matches[n] ?? '';

/** Issuer name guess: one of the first 3 lines, never a label, title or table-header line. */
function firstHeadingLine(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);

  for (const raw of lines) {
    const line = firstColumn(raw);
    if (!line || line.includes(':')) continue;
    if (
      /invoice|bill|ship|date|description|item|qty|quantity|total|original|duplicate|page\s+\d|^\d+$/i.test(
        line,
      )
    )
      continue;
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
