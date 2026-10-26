import { DEFAULT_LOCALE, getLocaleConfig, type LocaleCode } from '../../config/locales';

export type NumberParseResult =
  | { status: 'valid'; value: number; raw: string; ambiguous: false; percentage: boolean }
  | { status: 'empty'; value: null; raw: string; ambiguous: false; percentage: false }
  | { status: 'invalid'; value: null; raw: string; ambiguous: false; warning: string }
  | { status: 'ambiguous'; value: number; raw: string; ambiguous: true; warning: string; percentage: boolean };

const CURRENCY = /(?:₹|\$|€|£|\b(?:INR|USD|EUR|GBP|AUD|CAD|AED|SAR|SGD)\b)/gi;

function validGrouping(integer: string, separator: string, indian: boolean): boolean {
  if (!integer.includes(separator)) return /^\d+$/.test(integer);
  const groups = integer.split(separator);
  if (groups.some((g) => !/^\d+$/.test(g))) return false;
  if (indian) return groups[0].length >= 1 && groups[0].length <= 2 && groups.slice(1, -1).every((g) => g.length === 2) && groups[groups.length - 1].length === 3;
  return groups[0].length >= 1 && groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3);
}

/** Strict locale-aware number parser. Raw text is retained for review/audit. */
export function parseNumber(input: string, locale: LocaleCode = DEFAULT_LOCALE): NumberParseResult {
  const raw = input;
  let s = input.trim();
  if (!s) return { status: 'empty', value: null, raw, ambiguous: false, percentage: false };
  const config = getLocaleConfig(locale);
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
  if (s.startsWith('-')) { if (negative) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Conflicting negative notation.' }; negative = true; s = s.slice(1); }
  else if (s.startsWith('+')) s = s.slice(1);
  const percentage = /%\s*$/.test(s);
  if (percentage) s = s.replace(/%\s*$/, '').trim();
  s = s.replace(CURRENCY, '').trim();
  if (!s || /[^\d.,\s]/.test(s)) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Contains unsupported characters.' };
  s = s.replace(/\u00a0/g, ' ').trim();
  if (/\s{2,}/.test(s)) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid whitespace grouping.' };

  // Whitespace grouping is accepted only in groups of three.
  let normalized = s;
  if (s.includes(' ')) {
    if (s.includes(',') || s.includes('.')) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Mixed whitespace and punctuation grouping is not supported.' };
    const parts = s.split(' ');
    if (parts.length < 2 || !/^\d{1,3}$/.test(parts[0]) || parts.slice(1).some((p) => !/^\d{3}$/.test(p))) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid space grouping.' };
    normalized = parts.join('');
  }

  const commas = (normalized.match(/,/g) ?? []).length;
  const dots = (normalized.match(/\./g) ?? []).length;
  const ambiguous = (commas === 1 && dots === 0 && /^\d{1,3},\d{3}$/.test(normalized)) ||
    (dots === 1 && commas === 0 && /^\d{1,3}\.\d{3}$/.test(normalized));
  let integer = normalized;
  let fraction = '';
  if (commas && dots) {
    const decimal = normalized.lastIndexOf(config.decimalSeparator);
    const grouping = config.groupingSeparator;
    if (decimal < 0 || normalized.indexOf(config.decimalSeparator) !== decimal) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Separators do not match the selected locale.' };
    integer = normalized.slice(0, decimal);
    fraction = normalized.slice(decimal + 1);
    if (!fraction || !/^\d+$/.test(fraction) || fraction.length > 8) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid decimal fraction.' };
    if (!validGrouping(integer, grouping, config.groupingPattern === 'indian')) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid digit grouping for selected locale.' };
  } else if (commas || dots) {
    const separator = commas ? ',' : '.';
    const count = commas || dots;
    const isDecimal = separator === config.decimalSeparator;
    if (count > 1) {
      if (isDecimal || !validGrouping(normalized, separator, config.groupingPattern === 'indian')) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid separator placement.' };
      integer = normalized.split(separator).join('');
    } else {
      const [left, right] = normalized.split(separator);
      if (!left || !right) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid separator placement.' };
      if (ambiguous) {
        if (isDecimal) { integer = left; fraction = right; }
        else {
          if (!validGrouping(normalized, separator, config.groupingPattern === 'indian')) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid grouping for selected locale.' };
          integer = left + right;
        }
      } else if (isDecimal) {
        if (!/^\d+$/.test(left) || !/^\d{1,8}$/.test(right)) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid decimal format.' };
        integer = left; fraction = right;
      } else {
        if (!validGrouping(normalized, separator, config.groupingPattern === 'indian')) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid grouping for selected locale.' };
        integer = normalized.split(separator).join('');
      }
    }
  }
  if (!/^\d+$/.test(integer) || (fraction && !/^\d+$/.test(fraction))) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Invalid numeric format.' };
  const value = Number(`${integer}${fraction ? '.' + fraction : ''}`);
  if (!Number.isFinite(value)) return { status: 'invalid', value: null, raw, ambiguous: false, warning: 'Number is outside the supported range.' };
  const signed = negative ? -value : value;
  if (ambiguous) return { status: 'ambiguous', value: signed, raw, ambiguous: true, percentage, warning: `Ambiguous separator interpreted using ${config.code} rules; please confirm. This interpretation is not verified.` };
  return { status: 'valid', value: signed, raw, ambiguous: false, percentage };
}

/** Compatibility adapter. Invalid values become NaN, never a plausible zero. */
export function normalizeNumber(input: string, locale: LocaleCode = DEFAULT_LOCALE): number {
  const result = parseNumber(input, locale);
  return result.status === 'valid' || result.status === 'ambiguous' ? result.value : Number.NaN;
}
