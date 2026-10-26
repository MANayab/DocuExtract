import type { ExtractedField, Invoice } from '../../types/invoice';
import { parseDate } from './normalizeDates';
import { normalizeCurrency } from './normalizeCurrency';
import { DEFAULT_LOCALE, type LocaleCode } from '../../config/locales';

function normalizeDateField(field: ExtractedField<string>, locale: LocaleCode) {
  const raw = field.value;
  const result = parseDate(raw, locale);
  if (result.valid) field.value = result.value;
  else if (raw.trim()) {
    field.warning = result.warning ?? 'Date could not be parsed; please review.';
    field.confidence = Math.min(field.confidence, 50);
  }
  if (result.ambiguous && result.warning) {
    field.confidence = Math.min(field.confidence, 70);
    field.warning = result.warning;
  } else if (result.valid && !result.ambiguous) {
    field.warning = undefined;
  }
}

export function normalizeInvoice(i: Invoice, locale: LocaleCode = DEFAULT_LOCALE): Invoice {
  normalizeDateField(i.invoiceDate, locale);
  normalizeDateField(i.dueDate, locale);
  i.currency.value = normalizeCurrency(i.currency.value);
  return i;
}
