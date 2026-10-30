import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_OCR_LANGUAGE, OCR_LANGUAGES } from '../../features/ocr/ocrLanguages';

describe('OCR language configuration', () => {
  it('defines the supported languages and keeps English as the default', () => {
    expect(OCR_LANGUAGES.map((language) => language.code)).toEqual(['eng', 'hin', 'deu']);
    expect(DEFAULT_OCR_LANGUAGE).toBe('eng');
    expect(OCR_LANGUAGES.every((language) => language.label && language.nativeLabel)).toBe(true);
    expect(OCR_LANGUAGES.every((language) => language.fileName.endsWith('.traineddata.gz'))).toBe(
      true,
    );
  });

  it('keeps the generated asset manifest complete with the typed configuration', () => {
    const manifest = JSON.parse(readFileSync('public/ocr/manifest.json', 'utf8')) as {
      lang: string;
      languages: string[];
    };

    expect(manifest.lang).toBe(DEFAULT_OCR_LANGUAGE);
    expect(manifest.languages).toEqual(OCR_LANGUAGES.map((language) => language.code));
  });
});
