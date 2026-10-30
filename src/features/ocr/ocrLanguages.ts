import languageConfig from '../../../ocr-languages.json';

export type OcrLanguage = 'eng' | 'hin' | 'deu';

export interface OcrLanguageOption {
  code: OcrLanguage;
  label: string;
  nativeLabel: string;
  fileName: string;
  sizeNote: string;
}

const config = languageConfig as {
  defaultLanguage: OcrLanguage;
  languages: OcrLanguageOption[];
};

export const DEFAULT_OCR_LANGUAGE: OcrLanguage = config.defaultLanguage;
export const OCR_LANGUAGES: readonly OcrLanguageOption[] = config.languages;
