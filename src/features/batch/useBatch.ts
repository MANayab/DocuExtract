import { useState, useSyncExternalStore } from 'react';
import { OCR_BUNDLED } from '../../config/build';
import { processPdf } from '../pipeline/processPdf';
import { BatchStore } from './batchStore';

/** One store for the lifetime of the page. */
export function useBatchStore() {
  const [store] = useState(() => new BatchStore(processPdf));
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return { store, records };
}

/** Build-time availability only; the manifest and models load only after Run OCR. */
export function useOcrAvailable(): boolean | null {
  return OCR_BUNDLED;
}
