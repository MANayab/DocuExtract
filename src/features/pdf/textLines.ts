import type { TextSpan } from '../../types/extraction';

/** Vertical distance (PDF points) within which two spans count as the same visual row. */
const ROW_TOLERANCE = 3;
/** Horizontal gap (PDF points) above which two spans are treated as separate columns. */
const COLUMN_GAP = 8;
/** Gaps at or below this are treated as touching glyph runs (no space inserted). */
const TOUCHING_GAP = 0.3;

/**
 * Rebuilds visual text lines from positioned PDF text spans.
 *
 * - Spans are grouped per page, so rows from different pages never merge.
 * - Rows are ordered top-to-bottom, spans left-to-right.
 * - A wide horizontal gap is emitted as two spaces so downstream parsers can
 *   tell table columns / side-by-side header fields apart.
 */
export function spansToLines(spans: TextSpan[]): string[] {
  const byPage = new Map<number, TextSpan[]>();

  for (const span of spans) {
    if (!span.text.trim()) continue;
    const list = byPage.get(span.page) ?? [];
    list.push(span);
    byPage.set(span.page, list);
  }

  const lines: string[] = [];

  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const sorted = [...(byPage.get(page) ?? [])].sort(
      (a, b) => b.y - a.y || a.x - b.x,
    );

    const rows: TextSpan[][] = [];
    let rowY = Number.NaN;

    for (const span of sorted) {
      if (rows.length === 0 || Math.abs(span.y - rowY) > ROW_TOLERANCE) {
        rows.push([span]);
        rowY = span.y;
      } else {
        rows[rows.length - 1].push(span);
      }
    }

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);

      let line = '';
      let previousEnd = Number.NaN;

      for (const span of row) {
        const text = span.text.replace(/\s+/g, ' ').trim();
        if (!text) continue;

        if (line) {
          const gap = span.x - previousEnd;
          if (gap > COLUMN_GAP) line += '  ';
          else if (gap > TOUCHING_GAP) line += ' ';
        }

        line += text;
        previousEnd = span.x + span.width;
      }

      if (line) lines.push(line);
    }
  }

  return lines;
}
