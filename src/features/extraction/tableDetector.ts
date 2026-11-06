import type { TextSpan } from '../../types/extraction';
import type { InvoiceItem } from '../../types/invoice';
import { normalizeNumber } from '../normalization/normalizeNumbers';
import { DEFAULT_LOCALE, type LocaleCode } from '../../config/locales';
import { spansToLines } from '../pdf/textLines';

const CURRENCY = '(?:₹|\\$|€|£|Rs\\.?|INR)';
const NUMERIC_CELL = new RegExp(`^-?\\(?\\s*${CURRENCY}?\\s*\\d(?:[\\d., ]*\\d)?\\s*\\)?%?$`, 'i');
// Do not allow ordinary spaces inside a token: in unaligned PDF text, single spaces
// separate quantity, rate and amount columns. Punctuation grouping (1,000 / 1.000)
// remains part of one numeric token and is normalized by normalizeNumber.
const NUMBER_TOKEN = /-?\(?[₹$€£]?\s*\d(?:[\d.,]*\d)?\)?/g;
function isHeader(line: string): boolean {
  const value = line.toLowerCase();
  const hasDescription =
    /description|item|particulars|product|beschreibung|artikel|bezeichnung/.test(value) ||
    value.includes('विवरण');
  const hasQuantity = /qty|quantity|menge/.test(value) || value.includes('मात्रा');
  const hasAmount =
    /price|rate|amount|total|betrag|preis|einzelpreis/.test(value) ||
    value.includes('राशि') ||
    value.includes('दर');
  return hasDescription && hasQuantity && hasAmount;
}
const STOP =
  /^(subtotal|sub total|total|grand total|tax|cgst|sgst|igst|discount|shipping|amount due|zwischensumme|gesamtbetrag|steuer|mwst|umsatzsteuer|rabatt|versand|उप-योग|कुल राशि|कुल|कर|छूट)/i;
const NOISE = /^page\s+\d+/i;

type Role =
  | 'serial'
  | 'qty'
  | 'rate'
  | 'amount'
  | 'taxable'
  | 'discount'
  | 'taxRate'
  | 'taxAmount'
  | 'other'
  | 'text';

/** Classifies a table header cell, e.g. "CGST %" -> taxRate, "Taxable Value" -> taxable. */
export function roleOf(header: string): Role {
  const h = header.toLowerCase().trim();

  if (/^(?:sr\.?|s\.?\s*no\.?|sl\.?(?:\s*no\.?)?|#|no\.?)$/.test(h)) return 'serial';
  if (/qty|quantity|\bnos\b|menge/.test(h) || h.includes('मात्रा')) return 'qty';
  if (/disc|rabatt/.test(h) || h.includes('छूट')) return 'discount';
  if (/taxable|steuerpflichtig/.test(h) || h.includes('कर योग्य')) return 'taxable';

  if (/tax|gst|cgst|sgst|igst|vat|steuer|mwst|umsatzsteuer/.test(h) || h.includes('कर')) {
    return /%|rate|percent/.test(h) ? 'taxRate' : 'taxAmount';
  }

  if (/%/.test(h)) return 'taxRate';
  if (/amount|total|value|amt|betrag|summe/.test(h) || h.includes('राशि') || h.includes('कुल'))
    return 'amount';
  if (/rate|price|mrp|preis|einzelpreis/.test(h) || h.includes('दर')) return 'rate';
  if (/hsn|sac|code|uom|\bunit\b/.test(h)) return 'other';
  if (
    /description|item|particulars|product|name|details|beschreibung|artikel|bezeichnung/.test(h) ||
    h.includes('विवरण') ||
    h.includes('वस्तु')
  )
    return 'text';

  return 'other';
}

/**
 * Header cells can merge when columns sit close together ("SGST %  SGST Amt"
 * printed with a small gap). Tax headers are split back into one cell each.
 */
const TAX_HEADER =
  /\b(?:cgst|sgst|igst|gst|vat|tax(?!able)|steuer|mwst|umsatzsteuer)\s*(?:%|rate|amt|amount|value)?|कर/gi;

export function splitHeaderCells(cells: string[]): string[] {
  return cells.flatMap((cell) => {
    const parts = cell.match(TAX_HEADER);
    return parts && parts.length > 1 ? parts.map((p) => p.trim()) : [cell];
  });
}

const cellsOf = (line: string) =>
  line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

interface Row {
  description: string;
  qty: number;
  rate: number;
  amount: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  hasTax: boolean;
  aligned: boolean;
}

/** Column-aware parse: relies on wide gaps between table cells. */
function parseByColumns(line: string, headerRoles: Role[] | null, locale: LocaleCode): Row | null {
  let cells = cellsOf(line);
  let roles = headerRoles;

  // A leading serial number ("1  Cotton Fabric ...") is not part of the description.
  if (cells.length > 2 && /^\d{1,3}\.?$/.test(cells[0]) && !NUMERIC_CELL.test(cells[1])) {
    cells = cells.slice(1);
    if (roles?.[0] === 'serial') roles = roles.slice(1);
  }

  let tail = 0;

  while (tail < cells.length - 1 && NUMERIC_CELL.test(cells[cells.length - 1 - tail])) tail++;

  if (tail < 2) return null;

  const nums = cells.slice(cells.length - tail).map((c) => normalizeNumber(c, locale));
  const description = cells
    .slice(0, cells.length - tail)
    .join(' ')
    .trim();

  let qty: number | undefined;
  let rate: number | undefined;
  let amount: number | undefined;
  let taxable: number | undefined;
  let discount = 0;
  let taxRate = 0;
  let taxAmount = 0;
  let hasTax = false;
  let aligned = false;

  if (roles && tail <= roles.length) {
    // Align the numeric cells to the header columns from the right-hand side.
    const used = roles.slice(roles.length - tail);

    for (let i = 0; i < used.length; i++) {
      const role = used[i];

      if (role === 'qty') qty = nums[i];
      else if (role === 'rate') rate = nums[i];
      else if (role === 'amount') amount = nums[i];
      else if (role === 'taxable') taxable = nums[i];
      else if (role === 'discount') discount = nums[i];
      else if (role === 'taxRate') {
        // CGST % + SGST % columns add up to the effective rate.
        taxRate += nums[i];
        hasTax = true;
      } else if (role === 'taxAmount') {
        taxAmount += nums[i];
        hasTax = true;
      }
    }

    aligned = amount !== undefined || rate !== undefined || taxable !== undefined;
  }

  if (!aligned) {
    qty = tail >= 3 ? nums[tail - 3] : 1;
    rate = tail >= 3 ? nums[tail - 2] : nums[0];
    amount = nums[tail - 1];
    discount = 0;
    taxRate = 0;
    taxAmount = 0;
    hasTax = false;
  }

  const finalQty = qty ?? 1;
  const finalAmount = amount ?? taxable ?? (rate ?? 0) * finalQty - discount;
  const finalRate = rate ?? (finalQty ? (finalAmount + discount) / finalQty : finalAmount);

  return {
    description: description || line,
    qty: finalQty,
    rate: finalRate,
    amount: finalAmount,
    discount,
    taxRate: Number(taxRate.toFixed(4)),
    taxAmount: Number(taxAmount.toFixed(2)),
    hasTax,
    aligned,
  };
}

/** Fallback for single-spaced text where no column gaps exist. */
function parseLoosely(line: string, locale: LocaleCode, headerRoles: Role[] | null): Row | null {
  const matches = [...line.matchAll(NUMBER_TOKEN)];
  const nums = matches.map((m) => normalizeNumber(m[0], locale));

  if (nums.length < 2 || nums.some((value) => !Number.isFinite(value))) return null;

  const first = matches[0]?.[0] ?? '';
  const description = line.slice(0, Math.max(1, line.indexOf(first))).trim() || line;

  // With no positioned column gaps, use the numeric column order advertised by
  // the table header. This preserves GST/discount columns instead of guessing
  // that every row contains only quantity, rate and amount.
  if (headerRoles && headerRoles.length === nums.length) {
    let qty: number | undefined;
    let rate: number | undefined;
    let amount: number | undefined;
    let taxable: number | undefined;
    let discount = 0;
    let taxRate = 0;
    let taxAmount = 0;
    let hasTax = false;

    headerRoles.forEach((role, index) => {
      const value = nums[index];
      if (role === 'qty') qty = value;
      else if (role === 'rate') rate = value;
      else if (role === 'amount') amount = value;
      else if (role === 'taxable') taxable = value;
      else if (role === 'discount') discount = value;
      else if (role === 'taxRate') {
        taxRate += value;
        hasTax = true;
      } else if (role === 'taxAmount') {
        taxAmount += value;
        hasTax = true;
      }
    });

    if (amount !== undefined || taxable !== undefined || rate !== undefined) {
      const finalQty = qty ?? 1;
      const finalAmount = amount ?? taxable ?? (rate ?? 0) * finalQty - discount;
      const finalRate = rate ?? (finalQty ? (finalAmount + discount) / finalQty : finalAmount);
      return {
        description,
        qty: finalQty,
        rate: finalRate,
        amount: finalAmount,
        discount,
        taxRate: Number(taxRate.toFixed(4)),
        taxAmount: Number(taxAmount.toFixed(2)),
        hasTax,
        aligned: true,
      };
    }
  }

  return {
    description,
    qty: nums.length >= 3 ? nums[0] : 1,
    rate: nums.length >= 3 ? nums[1] : nums[0],
    amount: nums[nums.length - 1],
    discount: 0,
    taxRate: 0,
    taxAmount: 0,
    hasTax: false,
    aligned: false,
  };
}

function rolesFromHeader(line: string): Role[] {
  return splitHeaderCells(cellsOf(line)).map(roleOf);
}

const field = (value: number, confidence: number) => ({
  value,
  confidence,
  source: 'text' as const,
});

export function detectLineItems(
  spans: TextSpan[],
  text: string,
  locale: LocaleCode = DEFAULT_LOCALE,
): InvoiceItem[] {
  const spanRows = spansToLines(spans);
  const lines = (spanRows.length ? spanRows : text.split(/\r?\n/))
    .map((x) => x.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((x) => isHeader(x));
  const headerCells = headerIndex >= 0 ? splitHeaderCells(cellsOf(lines[headerIndex])) : [];
  const roles =
    headerCells.length >= 3
      ? headerCells.map(roleOf)
      : headerIndex >= 0
        ? rolesFromHeader(lines[headerIndex])
        : null;

  const source =
    headerIndex >= 0
      ? lines.slice(headerIndex + 1)
      : lines.filter((x) => /\s+\d+(?:\.\d+)?\s+\D*\s*[₹$€£]?\s*\d/.test(x));

  const out: InvoiceItem[] = [];
  let pendingDescription = '';

  for (const line of source) {
    if (STOP.test(line)) break;
    if (NOISE.test(line)) continue;

    const row = parseByColumns(line, roles, locale) ?? parseLoosely(line, locale, roles);

    if (!row) {
      // Some invoices wrap the item description onto one or more lines above
      // the numeric cells. Carry only non-summary text forward to the next row.
      if (!isHeader(line) && !/^(?:continued invoice|page\s+\d+)/i.test(line)) {
        pendingDescription = [pendingDescription, line].filter(Boolean).join(' ');
      }
      continue;
    }

    if (pendingDescription) {
      row.description = [pendingDescription, row.description].filter(Boolean).join(' ').trim();
      pendingDescription = '';
    }

    out.push({
      description: { value: row.description, confidence: 80, source: 'text' },
      quantity: field(row.qty, row.aligned ? 85 : 70),
      unit: { value: 'pcs', confidence: 40, source: 'text' },
      unitPrice: field(row.rate, row.aligned ? 85 : 70),
      discount: field(row.discount, row.aligned ? 80 : 55),
      taxRate: field(row.taxRate, row.hasTax ? 85 : 45),
      taxAmount: field(row.taxAmount, row.hasTax ? 85 : 45),
      lineTotal: field(row.amount, row.aligned ? 90 : 80),
    });
  }

  return out.slice(0, 500);
}
