import { OCR_MAX_PAGES, OCR_MAX_PIXELS, OCR_RENDER_SCALE } from '../../config/limits';
import { AppError } from '../../types/errors';
import type { PdfExtraction, TextSpan } from '../../types/extraction';
import { loadPdf } from '../pdf/pdfLoader';
import { spansToLines } from '../pdf/textLines';
import { getOcrManifest, ocrAssetBase } from './ocrManifest';

interface OcrWord {
  text: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OcrPageData {
  words?: OcrWord[];
  blocks?: { paragraphs?: { lines?: { words?: OcrWord[] }[] }[] }[];
}

/** Words from a Tesseract result (v5 exposes `words`; newer versions nest them in `blocks`). */
export function collectWords(data: OcrPageData): OcrWord[] {
  if (Array.isArray(data.words) && data.words.length) return data.words;

  const words: OcrWord[] = [];

  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) words.push(...(line.words ?? []));
    }
  }

  return words;
}

/**
 * Converts OCR words (canvas pixels, origin top-left) into text spans in PDF
 * points with the origin bottom-left, so the normal extractor can read them.
 */
export function wordsToSpans(
  words: OcrWord[],
  page: number,
  pageHeightPoints: number,
  scale: number,
): TextSpan[] {
  const spans: TextSpan[] = [];

  for (const word of words) {
    const text = (word.text ?? '').trim();
    if (!text) continue;

    const { x0, y0, x1, y1 } = word.bbox;

    spans.push({
      text,
      x: x0 / scale,
      y: pageHeightPoints - (y0 + y1) / 2 / scale,
      width: (x1 - x0) / scale,
      height: (y1 - y0) / scale,
      page,
    });
  }

  return spans;
}

const MIN_OCR_CHARACTERS = 20;

/**
 * Reads a scanned PDF locally: pdf.js renders each page to a canvas, Tesseract
 * (worker, WASM core and language data all served from this site) recognises
 * the words, and they come back as positioned spans like any text PDF.
 */
export async function ocrPdf(
  file: File,
  onProgress: (percent: number, label: string) => void,
  language = 'eng',
  pagesToOcr?: number[],
): Promise<PdfExtraction> {
  const manifest = await getOcrManifest();

  if (!manifest) {
    throw new AppError(
      'OCR_UNAVAILABLE',
      'OCR is not installed in this build. See docs/OCR.md to bundle the Tesseract files (no CDN is used).',
    );
  }

  if (!manifest.languages.includes(language)) {
    throw new AppError(
      'OCR_UNAVAILABLE',
      `OCR language "${language}" is not bundled in this build.`,
    );
  }

  const pdf = await loadPdf(await file.arrayBuffer()).catch(() => {
    throw new AppError('PDF_CORRUPT', 'The PDF could not be opened.');
  });

  const pageNumbers =
    pagesToOcr?.length ? pagesToOcr : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  if (pageNumbers.length > OCR_MAX_PAGES) {
    await pdf.destroy();
    throw new AppError('TOO_MANY_PAGES', `OCR is limited to ${OCR_MAX_PAGES} pages per PDF.`);
  }

  let pageIndex = 0;
  const pageCount = pdf.numPages;
  const overall = (fraction: number) => ((pageIndex + fraction) / pageNumbers.length) * 100;

  const { createWorker } = await import('tesseract.js');
  const dir = ocrAssetBase();

  const options = {
    workerPath: `${dir}/worker.min.js`,
    corePath: `${dir}/core`,
    langPath: `${dir}/lang`,
    gzip: manifest.gzip,
    workerBlobURL: false,
    cacheMethod: 'none',
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(overall(m.progress), `OCR page ${pageNumbers[pageIndex]} (${pageIndex + 1} of ${pageNumbers.length})`);
      }
    },
  };

  onProgress(0, 'Loading OCR engine');

  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;

  try {
    worker = await createWorker(
      language,
      1,
      options as unknown as Parameters<typeof createWorker>[2],
    );

    try {
      await worker.setParameters({ preserve_interword_spaces: '1' } as never);
    } catch {
      // Optional tuning only.
    }

    const spans: TextSpan[] = [];
    const pageTexts: string[] = [];

    for (pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      onProgress(overall(0), `Rendering page ${pageIndex + 1} of ${pageCount}`);

      const page = await pdf.getPage(pageIndex + 1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(
        OCR_RENDER_SCALE,
        Math.sqrt(OCR_MAX_PIXELS / (base.width * base.height)),
      );
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new AppError('EXTRACTION_FAILED', 'This browser cannot render pages for OCR.');
      }

      await page.render({ canvasContext: context, viewport }).promise;

      const result = (await worker.recognize(canvas)) as unknown as { data: OcrPageData };
      const pageSpans = wordsToSpans(collectWords(result.data), pageIndex + 1, base.height, scale);

      spans.push(...pageSpans);
      pageTexts.push(spansToLines(pageSpans).join('\n'));

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    const text = pageTexts.join('\n');

    if (text.replace(/\s/g, '').length < MIN_OCR_CHARACTERS) {
      throw new AppError('EXTRACTION_FAILED', 'OCR could not read any text from this scan.');
    }

    onProgress(100, 'OCR complete');

    return {
      fileName: file.name,
      pageCount,
      spans,
      text,
      pageTexts,
      kind: 'text-based',
      ocr: true,
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      'OCR_UNAVAILABLE',
      `OCR failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    await worker?.terminate();
    await pdf.destroy();
  }
}
