import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processPdf } from '../../features/pipeline/processPdf';
import type { PdfExtraction } from '../../types/extraction';

const mocks = vi.hoisted(() => ({
  extractPdf: vi.fn(),
  ocrPdf: vi.fn(),
  parseInvoice: vi.fn(),
  splitInvoices: vi.fn(() => []),
}));

vi.mock('../../features/pdf/pdfTextExtractor', () => ({
  extractPdf: mocks.extractPdf,
}));
vi.mock('../../features/ocr/ocrEngine', () => ({
  ocrPdf: mocks.ocrPdf,
}));
vi.mock('../../features/extraction/invoiceParser', () => ({
  parseInvoice: mocks.parseInvoice,
}));
vi.mock('../../features/extraction/splitInvoices', () => ({
  splitInvoices: mocks.splitInvoices,
}));

const imageOnly: PdfExtraction = {
  fileName: 'scan.pdf',
  pageCount: 1,
  spans: [],
  text: '',
  pageTexts: [''],
  kind: 'image-only',
};

const ocrResult: PdfExtraction = {
  ...imageOnly,
  text: 'Invoice 123',
  pageTexts: ['Invoice 123'],
  kind: 'text-based',
  ocr: true,
};

describe('processPdf OCR language handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractPdf.mockResolvedValue(imageOnly);
    mocks.ocrPdf.mockResolvedValue(ocrResult);
  });

  it.each(['hin', 'deu'] as const)('forwards %s to Tesseract', async (language) => {
    await processPdf(
      new File(['pdf'], 'scan.pdf'),
      {
        ocr: true,
        ocrLanguage: language,
      },
      () => {},
    );

    expect(mocks.ocrPdf).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(Function),
      language,
    );
  });

  it('keeps English as the default when no language was selected', async () => {
    await processPdf(new File(['pdf'], 'scan.pdf'), { ocr: true }, () => {});

    expect(mocks.ocrPdf).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(Function),
      'eng',
    );
  });

  it('does not load OCR for a text-only PDF', async () => {
    mocks.extractPdf.mockResolvedValue({
      ...imageOnly,
      kind: 'text-based',
      text: 'Invoice 123',
      pageTexts: ['Invoice 123'],
    });

    await processPdf(new File(['pdf'], 'text.pdf'), { ocr: false }, () => {});

    expect(mocks.ocrPdf).not.toHaveBeenCalled();
  });
});
