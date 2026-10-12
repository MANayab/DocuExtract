import type { TextSpan } from '../../types/extraction';

/** Minimum vertical distance (PDF points) within which two spans count as one visual row. */
const MIN_ROW_TOLERANCE = 3;
/** Horizontal gap (PDF points) above which two spans are treated as separate columns. */
const COLUMN_GAP = 8;
/** Gaps at or below this are treated as touching glyph runs (no space inserted). */
const TOUCHING_GAP = 0.3;

export interface LayoutCell {
  text: string;
  x0: number;
  x1: number;
}

export interface LayoutRow {
  page: number;
  /** Row position in PDF points (higher = nearer the top of the page). */
  y: number;
  cells: LayoutCell[];
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * Groups positioned text spans into visual rows of cells.
 *
 * - Spans are grouped per page, so rows from different pages never merge.
 * - Rows are ordered top-to-bottom, cells left-to-right.
 * - A wide horizontal gap starts a new cell, so table columns and side-by-side
 *   header fields stay separate.
 */
export function buildRows(spans: TextSpan[]): LayoutRow[] {
  const byPage = new Map<number, TextSpan[]>();

  for (const span of spans) {
    if (!span.text.trim()) continue;
    const list = byPage.get(span.page) ?? [];
    list.push(span);
    byPage.set(span.page, list);
  }

  const rows: LayoutRow[] = [];

  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageSpans = byPage.get(page) ?? [];
    // Scale the tolerance with the text size so OCR output (looser baselines) still groups.
    const tolerance = Math.max(MIN_ROW_TOLERANCE, median(pageSpans.map((s) => s.height)) * 0.35);
    const sorted = [...pageSpans].sort((a, b) => b.y - a.y || a.x - b.x);

    const groups: TextSpan[][] = [];
    let rowY = Number.NaN;

    for (const span of sorted) {
      if (groups.length === 0 || Math.abs(span.y - rowY) > tolerance) {
        groups.push([span]);
        rowY = span.y;
      } else {
        groups[groups.length - 1].push(span);
      }
    }

    for (const group of groups) {
      group.sort((a, b) => a.x - b.x);

      const cells: LayoutCell[] = [];
      let current: LayoutCell | undefined;
      let previousEnd = Number.NaN;

      for (const span of group) {
        const text = span.text.replace(/\s+/g, ' ').trim();
        if (!text) continue;

        const gap = span.x - previousEnd;

        if (!current || gap > COLUMN_GAP) {
          current = { text, x0: span.x, x1: span.x + span.width };
          cells.push(current);
        } else {
          current.text += (gap > TOUCHING_GAP ? ' ' : '') + text;
          current.x1 = span.x + span.width;
        }

        previousEnd = span.x + span.width;
      }

      if (cells.length) rows.push({ page, y: group[0].y, cells });
    }
  }

  return rows;
}

/** A row as one text line; cells are separated by two spaces. */
export const rowToLine = (row: LayoutRow) => row.cells.map((c) => c.text).join('  ');

/**
 * Rebuilds visual text lines from positioned PDF text spans. A wide horizontal
 * gap is emitted as two spaces so downstream parsers can tell columns apart.
 */
export function spansToLines(spans: TextSpan[]): string[] {
  return buildRows(spans).map(rowToLine);
}
