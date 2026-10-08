import type { TextSpan } from '../../types/extraction';
import type { InvoiceItem } from '../../types/invoice';
import { normalizeNumber } from '../normalization/normalizeNumbers';
import { spansToLines } from '../pdf/textLines';

const CURRENCY = '(?:₹|\\$|€|£|Rs\\.?|INR)';
const NUMERIC_CELL = new RegExp(`^-?\\(?\\s*${CURRENCY}?\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*\\)?%?$`, 'i');
const NUMBER_TOKEN = /-?\(?[₹$€£]?\s*\d[\d,]*(?:\.\d+)?\)?/g;
const HEADER =
  /(?:description|item|particulars|product).*(?:qty|quantity).*(?:price|rate|amount)|item.*qty/i;
const STOP =
  /^(subtotal|sub total|total|grand total|tax|cgst|sgst|igst|discount|shipping|amount due)/i;
const NOISE = /^page\s+\d+/i;

type Role = 'qty' | 'rate' | 'amount' | 'discount' | 'other' | 'text';

function roleOf(header: string): Role {
  if (/qty|quantity/i.test(header)) return 'qty';
  if (/disc/i.test(header)) return 'discount';
  if (/tax|gst|hsn|sac|code|%/i.test(header)) return 'other';
  if (/amount|total|value/i.test(header)) return 'amount';
  if (/rate|price/i.test(header)) return 'rate';
  if (/unit|uom/i.test(header)) return 'other';
  return 'text';
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
  aligned: boolean;
}

/** Column-aware parse: relies on wide gaps between table cells. */
function parseByColumns(line: string, roles: Role[] | null): Row | null {
  const cells = cellsOf(line);
  let tail = 0;

  while (tail < cells.length - 1 && NUMERIC_CELL.test(cells[cells.length - 1 - tail])) tail++;

  if (tail < 2) return null;

  const nums = cells.slice(cells.length - tail).map((c) => normalizeNumber(c));
  const description = cells.slice(0, cells.length - tail).join(' ').trim();

  let qty: number | undefined;
  let rate: number | undefined;
  let amount: number | undefined;
  let discount = 0;
  let aligned = false;

  if (roles && tail <= roles.length) {
    // Align the numeric cells to the header columns from the right-hand side.
    const used = roles.slice(roles.length - tail);
    used.forEach((role, i) => {
      if (role === 'qty') qty = nums[i];
      else if (role === 'rate') rate = nums[i];
      else if (role === 'amount') amount = nums[i];
      else if (role === 'discount') discount = nums[i];
    });
    aligned = amount !== undefined || rate !== undefined;
  }

  if (!aligned) {
    qty = tail >= 3 ? nums[tail - 3] : 1;
    rate = tail >= 3 ? nums[tail - 2] : nums[0];
    amount = nums[tail - 1];
  }

  const finalQty = qty ?? 1;
  const finalAmount = amount ?? (rate ?? 0) * finalQty - discount;
  const finalRate = rate ?? (finalQty ? (finalAmount + discount) / finalQty : finalAmount);

  return {
    description: description || line,
    qty: finalQty,
    rate: finalRate,
    amount: finalAmount,
    discount,
    aligned,
  };
}

/** Fallback for single-spaced text where no column gaps exist. */
function parseLoosely(line: string): Row | null {
  const nums = [...line.matchAll(NUMBER_TOKEN)].map((m) => normalizeNumber(m[0]));

  if (nums.length < 2) return null;

  const first = line.match(NUMBER_TOKEN)?.[0] ?? '';

  return {
    description: line.slice(0, Math.max(1, line.indexOf(first))).trim() || line,
    qty: nums.length >= 3 ? nums[0] : 1,
    rate: nums.length >= 3 ? nums[1] : nums[0],
    amount: nums[nums.length - 1],
    discount: 0,
    aligned: false,
  };
}

const field = (value: number, confidence: number) => ({
  value,
  confidence,
  source: 'text' as const,
});

export function detectLineItems(spans: TextSpan[], text: string): InvoiceItem[] {
  const spanRows = spansToLines(spans);
  const lines = (spanRows.length ? spanRows : text.split(/\r?\n/))
    .map((x) => x.trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((x) => HEADER.test(x));
  const headerCells = headerIndex >= 0 ? cellsOf(lines[headerIndex]) : [];
  const roles = headerCells.length >= 3 ? headerCells.map(roleOf) : null;

  const source =
    headerIndex >= 0
      ? lines.slice(headerIndex + 1)
      : lines.filter((x) => /\s+\d+(?:\.\d+)?\s+\D*\s*[₹$€£]?\s*\d/.test(x));

  const out: InvoiceItem[] = [];

  for (const line of source) {
    if (STOP.test(line)) break;
    if (NOISE.test(line)) continue;

    const row = parseByColumns(line, roles) ?? parseLoosely(line);

    if (!row) continue;

    out.push({
      description: { value: row.description, confidence: 80, source: 'text' },
      quantity: field(row.qty, row.aligned ? 85 : 70),
      unit: { value: 'pcs', confidence: 40, source: 'text' },
      unitPrice: field(row.rate, row.aligned ? 85 : 70),
      discount: field(row.discount, row.aligned ? 80 : 55),
      taxRate: field(0, 45),
      taxAmount: field(0, 45),
      lineTotal: field(row.amount, row.aligned ? 90 : 80),
    });
  }

  return out.slice(0, 500);
}
