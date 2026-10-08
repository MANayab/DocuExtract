import type { PdfExtraction, TextSpan } from '../../types/extraction';
import { loadPdf } from './pdfLoader';
import { spansToLines } from './textLines';
import { MAX_PAGES, MIN_TEXT_CHARS_PER_PAGE } from '../../config/limits';
import { AppError } from '../../types/errors';

export async function extractPdf(
  file: File,
  onProgress?: (p: number) => void,
): Promise<PdfExtraction> {
  const data = await file.arrayBuffer();

  let pdf;

  try {
    pdf = await loadPdf(data);
  } catch (e) {
    if (String(e).toLowerCase().includes('password')) {
      throw new AppError(
        'PDF_ENCRYPTED',
        'This PDF is password-protected and cannot be processed without a password.',
      );
    }

    throw new AppError('PDF_CORRUPT', 'The PDF could not be opened.');
  }

  if (pdf.numPages > MAX_PAGES) {
    await pdf.destroy();

    throw new AppError('TOO_MANY_PAGES', 'PDF exceeds the 100-page limit.');
  }

  const spans: TextSpan[] = [];
  const pageTexts: string[] = [];

  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageSpans: TextSpan[] = [];

      for (const item of content.items) {
        if ('str' in item) {
          const t = item.transform;

          pageSpans.push({
            text: item.str,
            x: t[4],
            y: t[5],
            width: item.width,
            height: item.height,
            page: p,
          });
        }
      }

      spans.push(...pageSpans);
      // One real line per visual row, so label/value parsing never leaks across lines.
      pageTexts.push(spansToLines(pageSpans).join('\n'));

      page.cleanup();

      onProgress?.(Math.round((p / pdf.numPages) * 100));
    }

    const text = pageTexts.join('\n');

    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      spans,
      text,
      kind:
        text.length >= MIN_TEXT_CHARS_PER_PAGE * pdf.numPages
          ? 'text-based'
          : 'image-only',
    };
  } finally {
    await pdf.destroy();
  }
}
