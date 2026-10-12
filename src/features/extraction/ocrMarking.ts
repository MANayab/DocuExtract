import type { Invoice } from '../../types/invoice';

/** OCR output is never shown as high confidence: it is capped inside the MEDIUM band. */
export const OCR_CONFIDENCE_CAP = 75;

function visit(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(visit);
    return;
  }

  if (!node || typeof node !== 'object') return;

  const record = node as Record<string, unknown>;

  if (typeof record.confidence === 'number' && typeof record.source === 'string') {
    record.confidence = Math.min(record.confidence, OCR_CONFIDENCE_CAP);
    if (record.source === 'text') record.source = 'ocr';
    return;
  }

  Object.values(record).forEach(visit);
}

/** Marks every extracted value as OCR-derived and caps its confidence. */
export function markAsOcr(invoice: Invoice): Invoice {
  const { extraction, ...rest } = invoice;

  visit(rest);

  extraction.sourceType = 'ocr';
  extraction.confidence = Math.min(extraction.confidence, OCR_CONFIDENCE_CAP);
  extraction.warnings.push(
    'Read with OCR from a scanned PDF. Accuracy is lower than for text PDFs; review every value.',
  );

  return invoice;
}
