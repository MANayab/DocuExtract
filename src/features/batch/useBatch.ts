import { useEffect, useState, useSyncExternalStore } from 'react';
import { OCR_BUNDLED } from '../../config/build';
import { getOcrManifest } from '../ocr/ocrManifest';
import { processPdf } from '../pipeline/processPdf';
import { BatchStore } from './batchStore';

/** One store for the lifetime of the page. */
export function useBatchStore() {
  const [store] = useState(() => new BatchStore(processPdf));
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { store, records };
}

/** null while checking, false when this build ships without OCR data. */
export function useOcrAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(OCR_BUNDLED ? null : false);

  useEffect(() => {
    if (!OCR_BUNDLED) return;

    let live = true;
    void getOcrManifest().then((manifest) => {
      if (live) setAvailable(manifest !== null);
    });
    return () => {
      live = false;
    };
  }, []);

  return available;
}
