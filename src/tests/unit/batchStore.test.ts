import { describe, expect, it } from 'vitest';
import { BatchStore } from '../../features/batch/batchStore';
import type { Processor } from '../../types/batch';
import { emptyField, type Invoice } from '../../types/invoice';

const pdf = (name: string, size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'application/pdf' });

const field = <T>(value: T) => ({ value, confidence: 90, source: 'text' as const });
const party = () => ({
  name: field(''),
  address: field(''),
  taxId: field(''),
  email: field(''),
  phone: field(''),
});

const invoice = (number: string): Invoice => ({
  invoiceNumber: field(number),
  invoiceDate: field('2026-10-01'),
  dueDate: field(''),
  currency: field('INR'),
  seller: party(),
  buyer: party(),
  items: [],
  subtotal: field(0),
  discountTotal: field(0),
  taxTotal: field(0),
  shipping: field(0),
  otherCharges: field(0),
  grandTotal: field(100),
  payment: { method: emptyField(''), reference: emptyField(''), terms: emptyField('') },
  extraction: {
    sourceType: 'text',
    confidence: 90,
    warnings: [],
    sourceFile: 'x.pdf',
    pageCount: 1,
  },
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('BatchStore', () => {
  it('rejects non-PDF files and duplicates, and accepts the rest', () => {
    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [invoice('A')],
      pageCount: 1,
    }));

    const first = store.addFiles([
      pdf('a.pdf'),
      new File(['x'], 'note.txt', { type: 'text/plain' }),
    ]);
    expect(first.accepted).toBe(1);
    expect(first.rejected).toHaveLength(1);

    const again = store.addFiles([pdf('a.pdf')]);
    expect(again.accepted).toBe(0);
    expect(again.rejected[0].reason).toMatch(/already/i);
  });

  it('processes files one at a time, in order', async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;

    const processor: Processor = async (file) => {
      active++;
      maxActive = Math.max(maxActive, active);
      order.push(file.name);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { kind: 'invoices', invoices: [invoice(file.name)], pageCount: 1 };
    };

    const store = new BatchStore(processor);
    store.addFiles([pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf')]);
    await settle();
    await settle();

    expect(order).toEqual(['1.pdf', '2.pdf', '3.pdf']);
    expect(maxActive).toBe(1);
    expect(store.getSnapshot().map((r) => r.status)).toEqual(['ready', 'ready', 'ready']);
  });

  it('expands a multi-invoice PDF into several records and marks the segment', async () => {
    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [invoice('A'), invoice('B'), invoice('C')],
      pageCount: 4,
    }));

    store.addFiles([pdf('bundle.pdf')]);
    await settle();

    const records = store.getSnapshot();
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.segment?.index)).toEqual([1, 2, 3]);
    expect(records.every((r) => r.fileName === 'bundle.pdf')).toBe(true);
    expect(new Set(records.map((r) => r.id)).size).toBe(3);
  });

  it('keeps going after a failure and reports the error on that row only', async () => {
    const store = new BatchStore(async (file) => {
      if (file.name === 'bad.pdf') throw new Error('The PDF could not be opened.');
      return { kind: 'invoices', invoices: [invoice('OK')], pageCount: 1 };
    });

    store.addFiles([pdf('bad.pdf'), pdf('good.pdf')]);
    await settle();

    const [bad, good] = store.getSnapshot();
    expect(bad.status).toBe('error');
    expect(bad.error).toBe('The PDF could not be opened.');
    expect(good.status).toBe('ready');
  });

  it('parks scanned PDFs as needs-ocr, then OCRs them on request', async () => {
    const calls: { ocr: boolean; language?: string }[] = [];

    const store = new BatchStore(async (_file, options) => {
      calls.push({ ocr: options.ocr, language: options.ocrLanguage });
      return options.ocr
        ? { kind: 'invoices', invoices: [invoice('SCAN-1')], pageCount: 1 }
        : { kind: 'needs-ocr', pageCount: 1 };
    });

    store.addFiles([pdf('scan.pdf')]);
    await settle();

    const parked = store.getSnapshot()[0];
    expect(parked.status).toBe('needs-ocr');

    store.requestOcr(parked.id, 'deu');
    await settle();

    expect(calls).toEqual([
      { ocr: false, language: undefined },
      { ocr: true, language: 'deu' },
    ]);
    expect(store.getSnapshot()[0].status).toBe('ready');
  });

  it('keeps OCR language independent from invoice locale', async () => {
    const calls: { locale?: string; language?: string; ocr: boolean }[] = [];
    const store = new BatchStore(async (_file, options) => {
      calls.push({
        locale: options.locale,
        language: options.ocrLanguage,
        ocr: options.ocr,
      });
      return options.ocr
        ? { kind: 'invoices', invoices: [invoice('LANGUAGE-INDEPENDENT')], pageCount: 1 }
        : { kind: 'needs-ocr', pageCount: 1 };
    });

    store.setLocale('de-DE');
    store.addFiles([pdf('independent.pdf')]);
    await settle();
    const scanned = store.getSnapshot()[0];
    expect(scanned.status).toBe('needs-ocr');
    expect(store.getLocale()).toBe('de-DE');

    store.setLocale('en-US');
    store.requestOcr(scanned.id, 'hin');
    await settle();

    expect(calls).toEqual([
      { locale: 'de-DE', language: undefined, ocr: false },
      { locale: 'en-US', language: 'hin', ocr: true },
    ]);
    expect(store.getLocale()).toBe('en-US');
  });

  it('applies edits, removal and clear', async () => {
    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [invoice('A')],
      pageCount: 1,
    }));
    store.addFiles([pdf('a.pdf'), pdf('b.pdf')]);
    await settle();

    const [a] = store.getSnapshot();
    store.updateInvoice(a.id, invoice('EDITED'));
    expect(store.getSnapshot()[0].invoice?.invoiceNumber.value).toBe('EDITED');

    store.remove(a.id);
    expect(store.getSnapshot()).toHaveLength(1);

    store.clear();
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('ignores a result that arrives after its row was removed', async () => {
    let release: () => void = () => undefined;
    const store = new BatchStore(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ kind: 'invoices', invoices: [invoice('LATE')], pageCount: 1 });
        }),
    );

    store.addFiles([pdf('slow.pdf')]);
    await settle();
    store.remove(store.getSnapshot()[0].id);
    release();
    await settle();

    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('cancels an OCR run and allows retry without discarding the file', async () => {
    let ocrCalls = 0;
    let activeSignal: AbortSignal | undefined;
    const store = new BatchStore(async (_file, options) => {
      if (!options.ocr) return { kind: 'needs-ocr', pageCount: 2 };
      ocrCalls++;
      activeSignal = options.signal;
      if (ocrCalls === 1) {
        return new Promise((_, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('OCR was cancelled.', 'AbortError')),
            { once: true },
          );
        });
      }
      return { kind: 'invoices', invoices: [invoice('RETRIED')], pageCount: 2 };
    });

    store.addFiles([pdf('cancel.pdf')]);
    await settle();
    const scanned = store.getSnapshot()[0];
    expect(scanned.status).toBe('needs-ocr');

    store.requestOcr(scanned.id, 'hin');
    await settle();
    expect(store.getSnapshot()[0].status).toBe('processing');

    store.cancelOcr(scanned.id);
    await settle();
    expect(activeSignal?.aborted).toBe(true);
    expect(store.getSnapshot()[0].status).toBe('cancelled');

    store.requestOcr(scanned.id, 'hin');
    await settle();
    expect(ocrCalls).toBe(2);
    expect(store.getSnapshot()[0].status).toBe('ready');
    expect(store.getSnapshot()[0].invoice?.invoiceNumber.value).toBe('RETRIED');
  });

  it('notifies subscribers on every change', async () => {
    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [invoice('A')],
      pageCount: 1,
    }));
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);

    store.addFiles([pdf('a.pdf')]);
    await settle();
    unsubscribe();
    const seen = notifications;
    store.clear();

    expect(seen).toBeGreaterThan(1);
    expect(notifications).toBe(seen);
  });
  it('reprocesses an unedited invoice with the selected locale', async () => {
    const locales: string[] = [];
    const processor: Processor = async (_file, options) => {
      const locale = options.locale ?? 'en-IN';
      locales.push(locale);
      return { kind: 'invoices', invoices: [invoice(locale)], pageCount: 1 };
    };
    const store = new BatchStore(processor);
    store.addFiles([pdf('locale.pdf')]);
    await settle();

    const record = store.getSnapshot()[0];
    expect(store.canReprocess(record.id)).toBe(true);
    expect(await store.reprocessWithLocale(record.id, 'de-DE')).toBe(true);
    expect(locales).toEqual(['en-IN', 'de-DE']);
    expect(store.getSnapshot()[0].invoice?.invoiceNumber.value).toBe('de-DE');
  });

  it('reprocesses the correct segment from a multi-invoice source PDF', async () => {
    const calls: string[] = [];
    const store = new BatchStore(async (_file, options) => {
      const locale = options.locale ?? 'en-IN';
      calls.push(locale);
      return {
        kind: 'invoices',
        invoices: [invoice(`${locale}-A`), invoice(`${locale}-B`), invoice(`${locale}-C`)],
        pageCount: 4,
      };
    });

    store.addFiles([pdf('bundle.pdf')]);
    await settle();

    const second = store.getSnapshot()[1];
    expect(second.id).toBe('f1#2');
    expect(store.canReprocess(second.id)).toBe(true);
    expect(await store.reprocessWithLocale(second.id, 'de-DE')).toBe(true);
    expect(store.getSnapshot()[1].invoice?.invoiceNumber.value).toBe('de-DE-B');
    expect(calls).toEqual(['en-IN', 'de-DE']);
  });

  it('never overwrites a manually edited invoice during locale reprocessing', async () => {
    const store = new BatchStore(async () => ({
      kind: 'invoices',
      invoices: [invoice('EXTRACTED')],
      pageCount: 1,
    }));
    store.addFiles([pdf('edited.pdf')]);
    await settle();

    const record = store.getSnapshot()[0];
    store.updateInvoice(record.id, invoice('MANUAL-EDIT'));
    expect(store.canReprocess(record.id)).toBe(false);
    expect(await store.reprocessWithLocale(record.id, 'de-DE')).toBe(false);
    expect(store.getSnapshot()[0].invoice?.invoiceNumber.value).toBe('MANUAL-EDIT');
  });
});
