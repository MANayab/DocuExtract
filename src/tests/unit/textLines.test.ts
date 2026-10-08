import { describe, expect, it } from 'vitest';
import { spansToLines } from '../../features/pdf/textLines';
import type { TextSpan } from '../../types/extraction';

const span = (text: string, x: number, y: number, page = 1): TextSpan => ({
  text,
  x,
  y,
  width: text.length * 5,
  height: 10,
  page,
});

describe('spansToLines', () => {
  it('puts each visual row on its own line, top to bottom', () => {
    const lines = spansToLines([
      span('Invoice Date:', 50, 760),
      span('17/09/2026', 118, 760),
      span('Invoice No:', 50, 780),
      span('INV-1', 108, 780),
    ]);

    expect(lines).toEqual(['Invoice No: INV-1', 'Invoice Date: 17/09/2026']);
  });

  it('marks wide horizontal gaps as column breaks (two spaces)', () => {
    const lines = spansToLines([span('Qty', 50, 700), span('Rate', 300, 700)]);

    expect(lines).toEqual(['Qty  Rate']);
  });

  it('never merges rows from different pages', () => {
    const lines = spansToLines([span('Page one row', 50, 700, 1), span('Page two row', 50, 700, 2)]);

    expect(lines).toEqual(['Page one row', 'Page two row']);
  });

  it('ignores blank spans', () => {
    expect(spansToLines([span(' ', 10, 10), span('', 20, 10)])).toEqual([]);
  });
});
