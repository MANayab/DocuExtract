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

  return manifestPromise.then((manifest) => {
    if (!manifest) manifestPromise = undefined;
    return manifest;
  });
}


/**
 * Prepares a user-selected language for offline OCR without requiring an
 * invoice to be processed first. The service worker stores the model in that
 * language's dedicated cache; this function confirms the cache entry exists.
 */
export async function prepareOcrLanguage(language: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    throw new Error(
      'Wait until the application reports Offline ready, then select the OCR language again.',
    );
  }

  const manifest = await getOcrManifest();
  if (!manifest || !manifest.languages.includes(language)) {
    throw new Error(`The ${language} OCR model is not bundled in this build.`);
  }

  const modelUrl = `${ocrAssetBase()}/lang/${language}.traineddata${manifest.gzip ? '.gz' : ''}`;
  const response = await fetch(modelUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`The ${language} OCR model could not be downloaded.`);

  const cached = await caches.match(modelUrl);
  if (!cached) {
    throw new Error(
      `The ${language} model was downloaded but could not be confirmed in offline storage. Retry while online.`,
    );
  }
}
