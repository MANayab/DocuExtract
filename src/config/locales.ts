export type LocaleCode = 'en-IN' | 'en-US' | 'en-GB' | 'de-DE';

export interface LocaleConfig {
  readonly code: LocaleCode;
  readonly label: string;
  readonly dateOrder: 'DMY' | 'MDY';
  readonly dateSeparator: '/' | '.';
  readonly decimalSeparator: '.' | ',';
  readonly groupingSeparator: ',' | '.' | ' ';
  readonly groupingPattern: 'indian' | 'western';
}

export const DEFAULT_LOCALE: LocaleCode = 'en-IN';

export const LOCALES: Readonly<Record<LocaleCode, LocaleConfig>> = {
  'en-IN': {
    code: 'en-IN',
    label: 'India (en-IN)',
    dateOrder: 'DMY',
    dateSeparator: '/',
    decimalSeparator: '.',
    groupingSeparator: ',',
    groupingPattern: 'indian',
  },
  'en-US': {
    code: 'en-US',
    label: 'United States (en-US)',
    dateOrder: 'MDY',
    dateSeparator: '/',
    decimalSeparator: '.',
    groupingSeparator: ',',
    groupingPattern: 'western',
  },
  'en-GB': {
    code: 'en-GB',
    label: 'United Kingdom (en-GB)',
    dateOrder: 'DMY',
    dateSeparator: '/',
    decimalSeparator: '.',
    groupingSeparator: ',',
    groupingPattern: 'western',
  },
  'de-DE': {
    code: 'de-DE',
    label: 'Germany (de-DE)',
    dateOrder: 'DMY',
    dateSeparator: '.',
    decimalSeparator: ',',
    groupingSeparator: '.',
    groupingPattern: 'western',
  },
};

export const getLocaleConfig = (locale: LocaleCode = DEFAULT_LOCALE): LocaleConfig =>
  LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
