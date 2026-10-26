import { DEFAULT_LOCALE, getLocaleConfig, type LocaleCode } from '../../config/locales';

export interface DateParseResult {
  value: string;
  valid: boolean;
  ambiguous: boolean;
  warning?: string;
}

const months: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const invalid = (warning?: string): DateParseResult => ({
  value: '',
  valid: false,
  ambiguous: false,
  ...(warning ? { warning } : {}),
});

function canonical(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse a date without rolling impossible calendar dates into another month. */
export function parseDate(input: string, locale: LocaleCode = DEFAULT_LOCALE): DateParseResult {
  const s = input.trim();
  if (!s) return invalid();
  const config = getLocaleConfig(locale);
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const value = canonical(Number(match[1]), Number(match[2]), Number(match[3]));
    return value ? { value, valid: true, ambiguous: false } : invalid('Invalid calendar date.');
  }

  match = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const month = months[match[2].toLowerCase()];
    const value = month ? canonical(Number(match[3]), month, Number(match[1])) : null;
    return value
      ? { value, valid: true, ambiguous: false }
      : invalid('Invalid or unrecognized month-name date.');
  }
  match = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const month = months[match[1].toLowerCase()];
    const value = month ? canonical(Number(match[3]), month, Number(match[2])) : null;
    return value
      ? { value, valid: true, ambiguous: false }
      : invalid('Invalid or unrecognized month-name date.');
  }

  match = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (!match) return invalid('Unrecognized date format.');
  const a = Number(match[1]);
  const b = Number(match[2]);
  const year = Number(match[3]);
  const ambiguous = a <= 12 && b <= 12 && a !== b;
  let day: number;
  let month: number;
  if (a > 12 && b > 12) return invalid('Both date components exceed 12.');
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    day = b;
    month = a;
  } else if (config.dateOrder === 'MDY') {
    month = a;
    day = b;
  } else {
    day = a;
    month = b;
  }
  const value = canonical(year, month, day);
  if (!value) return invalid('Invalid calendar date.');
  return {
    value,
    valid: true,
    ambiguous,
    ...(ambiguous
      ? {
          warning: `Ambiguous numeric date interpreted as ${config.dateOrder === 'MDY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'} for ${config.code}; please confirm. This interpretation is not verified.`,
        }
      : {}),
  };
}

/** Backwards-compatible string helper; omitted locale retains the en-IN default. */
export function normalizeDate(input: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  return parseDate(input, locale).value;
}
