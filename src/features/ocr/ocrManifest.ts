import { OCR_BUNDLED } from '../../config/build';

/** Written by scripts/prepare-ocr-assets.mjs when the OCR files were bundled into this build. */
export interface OcrManifest {
  engine: string;
  lang: string;
  gzip: boolean;
  languages: string[];
}

/** Base URL of the OCR files served by this site (no trailing slash). */
export const ocrAssetBase = () => `${import.meta.env.BASE_URL}ocr`;

let manifestPromise: Promise<OcrManifest | null> | undefined;

/** Resolves to the bundled OCR configuration, or null when this build ships without OCR data. */
export function getOcrManifest(): Promise<OcrManifest | null> {
  manifestPromise ??= (async () => {
    // Build-time flag: no request (and no console 404) when OCR was not bundled.
    if (!OCR_BUNDLED) return null;

    try {
      const response = await fetch(`${ocrAssetBase()}/manifest.json`, { cache: 'no-cache' });
      if (!response.ok) return null;

      const json = (await response.json()) as Partial<OcrManifest>;
      return json && typeof json.lang === 'string'
        ? {
            engine: String(json.engine ?? 'tesseract.js'),
            lang: json.lang,
            languages: Array.isArray(json.languages)
              ? json.languages.filter((item): item is string => typeof item === 'string')
              : [json.lang],
            gzip: json.gzip !== false,
          }
        : null;
    } catch {
      return null;
    }
  })();

  return manifestPromise;
}
