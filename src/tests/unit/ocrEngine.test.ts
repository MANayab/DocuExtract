import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ocrPdf } from '../../features/ocr/ocrEngine';

const mocks = vi.hoisted(() => ({
  loadPdf: vi.fn(),
  getOcrManifest: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock('../../features/pdf/pdfLoader', () => ({
  loadPdf: mocks.loadPdf,
}));
vi.mock('../../features/ocr/ocrManifest', () => ({
  getOcrManifest: mocks.getOcrManifest,
  ocrAssetBase: () => '/ocr',
}));
vi.mock('tesseract.js', () => ({
  createWorker: mocks.createWorker,
}));

describe('ocrPdf engine lifecycle', () => {
  let canvas: HTMLCanvasElement;
  let page: {
    getViewport: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
  };
  let pdf: {
    numPages: number;
    getPage: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  let worker: {
    setParameters: ReturnType<typeof vi.fn>;
    recognize: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement('canvas');
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    );

    page = {
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({ promise: Promise.reject(new Error('render failed')) })),
      cleanup: vi.fn(),
    };
    pdf = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(page),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    worker = {
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn(),
      terminate: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getOcrManifest.mockResolvedValue({
      engine: 'tesseract.js@5.1.1',
      lang: 'eng',
      languages: ['eng', 'hin', 'deu'],
      gzip: true,
    });
    mocks.loadPdf.mockResolvedValue(pdf);
    mocks.createWorker.mockResolvedValue(worker);
  });

  it.each(['hin', 'deu', 'eng'] as const)(
    'passes %s to createWorker',
    async (language) => {
      await expect(
        ocrPdf(new File(['pdf'], 'scan.pdf'), () => {}, language),
      ).rejects.toThrow(/OCR failed/);

      expect(mocks.createWorker).toHaveBeenCalledWith(
        language,
        1,
        expect.objectContaining({
          workerPath: '/ocr/worker.min.js',
          corePath: '/ocr/core',
          langPath: '/ocr/lang',
        }),
      );
    },
  );



  it('recognizes only requested image-only pages and reports per-page progress', async () => {
    const onProgress = vi.fn();
    pdf.numPages = 2;
    page.render.mockReturnValue({ promise: Promise.resolve() });
    worker.recognize.mockImplementation(async () => {
      const options = mocks.createWorker.mock.calls[0][2] as {
        logger: (message: { status: string; progress: number }) => void;
      };
      options.logger({ status: 'recognizing text', progress: 0.5 });
      return {
        data: {
          words: [
            {
              text: 'Invoice number 123456',
              bbox: { x0: 10, y0: 10, x1: 90, y1: 20 },
            },
          ],
        },
      };
    });

    const result = await ocrPdf(
      new File(['pdf'], 'mixed.pdf'),
      onProgress,
      'hin',
      [2],
    );

    expect(pdf.getPage).toHaveBeenCalledOnce();
    expect(pdf.getPage).toHaveBeenCalledWith(2);
    expect(result.pageTexts[0]).toBe('');
    expect(result.pageTexts[1]).toContain('Invoice number 123456');
    expect(result.spans.every((span) => span.page === 2)).toBe(true);
    expect(onProgress).toHaveBeenCalledWith(50, expect.stringContaining('OCR page 2'));
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('stops between pages when the abort signal is raised during recognition', async () => {
    const controller = new AbortController();
    pdf.numPages = 2;
    page.render.mockReturnValue({ promise: Promise.resolve() });
    worker.recognize.mockImplementation(async () => {
      controller.abort();
      return { data: { text: '', words: [] } };
    });

    await expect(
      ocrPdf(new File(['pdf'], 'scan.pdf'), () => {}, 'eng', undefined, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(pdf.getPage).toHaveBeenCalledOnce();
    expect(worker.recognize).toHaveBeenCalledOnce();
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(pdf.destroy).toHaveBeenCalledOnce();
  });

  it('releases the canvas and terminates the worker when page rendering fails', async () => {
    await expect(ocrPdf(new File(['pdf'], 'scan.pdf'), () => {}, 'eng')).rejects.toThrow(
      /OCR failed/,
    );

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(pdf.destroy).toHaveBeenCalledOnce();
  });
});
