import type { ExtractedField, Invoice } from '../../types/invoice';
import { normalizeDate } from './normalizeDates';
import { normalizeCurrency } from './normalizeCurrency';

/** True for numeric dates such as 05/09/2026 that read differently as DD/MM and MM/DD. */
const isAmbiguousDate = (s: string) => {
  const m = s.trim().match(/^(\d{1,2})[-./](\d{1,2})[-./]\d{4}$/);
  return !!m && Number(m[1]) <= 12 && Number(m[2]) <= 12 && m[1] !== m[2];
};

function normalizeDateField(field: ExtractedField<string>) {
  const raw = field.value;
  field.value = normalizeDate(raw) || raw;

  if (isAmbiguousDate(raw)) {
    field.confidence = Math.min(field.confidence, 70);
    field.warning = 'Ambiguous date; read as DD/MM/YYYY. Please confirm.';
  }
}

export function normalizeInvoice(i: Invoice): Invoice {
  normalizeDateField(i.invoiceDate);
  normalizeDateField(i.dueDate);
  i.currency.value = normalizeCurrency(i.currency.value);
  return i;
}
