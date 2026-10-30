import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOcrManifest } from '../../features/ocr/ocrManifest';

vi.mock('../../config/build', () => ({ OCR_BUNDLED: true }));

describe('OCR manifest recovery', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries after a missing manifest instead of caching the failure', async () => {
    const manifest = {
      engine: 'tesseract.js@5.1.1',
      lang: 'eng',
      languages: ['eng', 'hin', 'deu'],
      gzip: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => manifest });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getOcrManifest()).resolves.toBeNull();
    await expect(getOcrManifest()).resolves.toEqual(manifest);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
