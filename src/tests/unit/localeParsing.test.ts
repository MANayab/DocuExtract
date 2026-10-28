import { describe, expect, it } from 'vitest';
import { parseDate } from '../../features/normalization/normalizeDates';
import { parseNumber } from '../../features/normalization/normalizeNumbers';

describe('locale-aware date parsing', () => {
  it.each([
    ['en-IN', '2026-04-03'],
    ['en-GB', '2026-04-03'],
    ['en-US', '2026-03-04'],
    ['de-DE', '2026-04-03'],
  ] as const)('interprets 03/04/2026 using %s date order', (locale, expected) => {
    expect(parseDate('03/04/2026', locale)).toMatchObject({
      value: expected,
      valid: true,
      ambiguous: true,
    });
  });

  it('accepts ISO and month-name dates and validates the calendar', () => {
    expect(parseDate('2026-09-17').value).toBe('2026-09-17');
    expect(parseDate('3 Apr 2026', 'en-IN').value).toBe('2026-04-03');
    expect(parseDate('April 3, 2026', 'en-US').value).toBe('2026-04-03');
    expect(parseDate('31/02/2026').valid).toBe(false);
    expect(parseDate('2026-02-29').valid).toBe(false);
    expect(parseDate('2024-02-29').value).toBe('2024-02-29');
    expect(parseDate('').valid).toBe(false);
    expect(parseDate('not a date').valid).toBe(false);
  });

  it('keeps en-IN as the omitted-locale default', () => {
    expect(parseDate('03/04/2026').value).toBe('2026-04-03');
  });
});

describe('locale-aware number parsing', () => {
  it('parses locale grouping and decimal separators', () => {
    expect(parseNumber('1,23,456.78', 'en-IN')).toMatchObject({
      status: 'valid',
      value: 123456.78,
    });
    expect(parseNumber('123,456.78', 'en-US')).toMatchObject({ status: 'valid', value: 123456.78 });
    expect(parseNumber('123,456.78', 'en-GB')).toMatchObject({ status: 'valid', value: 123456.78 });
    expect(parseNumber('123.456,78', 'de-DE')).toMatchObject({ status: 'valid', value: 123456.78 });
    expect(parseNumber('1 234,56', 'de-DE')).toMatchObject({ status: 'valid', value: 1234.56 });
  });

  it('supports accounting negatives, currency markers, percentages and real zero', () => {
    expect(parseNumber('(1,234.56)', 'en-US')).toMatchObject({ status: 'valid', value: -1234.56 });
    expect(parseNumber('₹1,23,456.78', 'en-IN')).toMatchObject({
      status: 'valid',
      value: 123456.78,
    });
    expect(parseNumber('EUR 123.456,78', 'de-DE')).toMatchObject({
      status: 'valid',
      value: 123456.78,
    });
    expect(parseNumber('12.5%', 'en-IN')).toMatchObject({
      status: 'valid',
      value: 12.5,
      percentage: true,
    });
    expect(parseNumber('0', 'en-IN')).toMatchObject({ status: 'valid', value: 0 });
    expect(parseNumber('', 'en-IN').status).toBe('empty');
    expect(parseNumber('not numeric', 'en-IN').status).toBe('invalid');
  });

  it('flags separator ambiguity rather than silently claiming certainty', () => {
    expect(parseNumber('1.234', 'en-IN').status).toBe('ambiguous');
    expect(parseNumber('1,234', 'en-US').status).toBe('ambiguous');
    expect(parseNumber('1.234', 'de-DE').value).toBe(1234);
  });

  it('uses en-IN by default and rejects excessive fractional precision', () => {
    expect(parseNumber('1,23,456.78').value).toBe(123456.78);
    expect(parseNumber('1.123456789', 'en-IN').status).toBe('invalid');
    expect(parseNumber('999999999999999999999999999999', 'en-IN').status).toBe('valid');
  });
});
