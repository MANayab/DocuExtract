import { MAX_BATCH_FILES } from '../../config/limits';
import type { BatchRecord, OcrLanguage, Processor } from '../../types/batch';
import type { Invoice } from '../../types/invoice';
import { DEFAULT_OCR_LANGUAGE } from '../ocr/ocrLanguages';
import { validatePdfFile } from '../../utils/fileValidation';
import { DEFAULT_LOCALE, type LocaleCode } from '../../config/locales';
import { anchorsMatch, matchVendorTemplate } from '../templates/templateMatcher';
import type { VendorTemplate } from '../templates/templateSchema';

export interface AddResult {
  accepted: number;
  rejected: { name: string; reason: string }[];
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Holds the dashboard's records and runs the processing queue one file at a
 * time (bounded memory). Framework-free so it can be unit tested; React reads
 * it through useSyncExternalStore.
 */
export class BatchStore {
  private records: BatchRecord[] = [];
  private listeners = new Set<() => void>();
  private files = new Map<string, File>();
  private ocrRequested = new Map<string, OcrLanguage>();
  private ocrControllers = new Map<string, AbortController>();
  private running = false;
  private seq = 0;
  private locale: LocaleCode = DEFAULT_LOCALE;
  private manuallyEdited = new Set<string>();
  private templates: VendorTemplate[] = [];

  setLocale(locale: LocaleCode) {
    this.locale = locale;
  }

  getLocale() {
    return this.locale;
  }

  setTemplates(templates: VendorTemplate[]) {
    this.templates = [...templates];
  }

  readWithoutTemplate(id: string) {
    this.patch(id, { templateApplied: undefined });
  }

  constructor(private processor: Processor) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.records;

  private commit(next: BatchRecord[]) {
    this.records = next;
    this.listeners.forEach((l) => l());
  }

  private patch(id: string, change: Partial<BatchRecord>) {
    if (!this.records.some((r) => r.id === id)) return;
    this.commit(this.records.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }

  /** Validates and queues files; processing starts immediately. */
  addFiles(files: File[]): AddResult {
    const rejected: AddResult['rejected'] = [];
    const added: BatchRecord[] = [];
    const fileCount = () =>
      new Set(this.records.map((r) => r.id.split('#')[0])).size + added.length;

    for (const file of files) {
      try {
        validatePdfFile(file);
      } catch (e) {
        rejected.push({ name: file.name, reason: e instanceof Error ? e.message : String(e) });
        continue;
      }

      if (fileCount() >= MAX_BATCH_FILES) {
        rejected.push({
          name: file.name,
          reason: `Batch limit of ${MAX_BATCH_FILES} files reached.`,
        });
        continue;
      }

      const sameFile = (r: BatchRecord) => r.fileName === file.name && r.size === file.size;

      if (this.records.some(sameFile) || added.some(sameFile)) {
        rejected.push({ name: file.name, reason: 'This file is already in the batch.' });
        continue;
      }

      const id = `f${++this.seq}`;
      this.files.set(id, file);
      added.push({
        id,
        fileName: file.name,
        size: file.size,
        status: 'queued',
        progress: 0,
        label: 'Waiting in queue',
      });
    }

    if (added.length) {
      this.commit([...this.records, ...added]);
      void this.pump();
    }

    return { accepted: added.length, rejected };
  }

  /** Re-queues a scanned PDF to be read with OCR. */
  requestOcr(id: string, language: OcrLanguage = DEFAULT_OCR_LANGUAGE) {
    const record = this.records.find((r) => r.id === id);
    const retryable =
      record?.status === 'cancelled' || (record?.status === 'error' && record.ocrRequested);
    if (!record || (record.status !== 'needs-ocr' && !retryable)) return;

    this.ocrRequested.set(id, language);
    this.patch(id, {
      status: 'queued',
      progress: 0,
      label: 'Waiting in queue (OCR)',
      error: undefined,
      ocrRequested: true,
    });
    void this.pump();
  }

  cancelOcr(id: string) {
    const controller = this.ocrControllers.get(id);
    if (!controller || controller.signal.aborted) return;
    controller.abort();
    this.patch(id, { label: 'Cancelling OCR…' });
  }

  updateInvoice(id: string, invoice: Invoice) {
    this.manuallyEdited.add(id);
    this.patch(id, { invoice });
  }

  isManuallyEdited(id: string) {
    return this.manuallyEdited.has(id);
  }

  private sourceFileFor(id: string) {
    // Split invoice rows use IDs like f1#2, while the original PDF is f1.
    // Prefer the row mapping, then fall back to the original source ID.
    return this.files.get(id) ?? this.files.get(id.split('#')[0]);
  }

  canReprocess(id: string) {
    return Boolean(this.sourceFileFor(id)) && !this.manuallyEdited.has(id);
  }

  async reprocessWithLocale(id: string, locale: LocaleCode): Promise<boolean> {
    const record = this.records.find((item) => item.id === id);
    const file = this.sourceFileFor(id);
    if (!record || !file || !record.invoice || this.manuallyEdited.has(id)) return false;

    const previousStatus = record.status;
    this.setLocale(locale);
    this.patch(id, { label: 'Reprocessing with selected locale', error: undefined });
    try {
      const result = await this.processor(
        file,
        { ocr: this.ocrRequested.has(id), locale, ocrLanguage: this.ocrRequested.get(id) },
        () => {},
      );
      if (result.kind !== 'invoices') {
        this.patch(id, { label: record.label, status: previousStatus });
        return false;
      }
      const index = Math.max(0, (record.segment?.index ?? 1) - 1);
      const invoice = result.invoices[index];
      if (!invoice || this.manuallyEdited.has(id)) {
        this.patch(id, { label: record.label, status: previousStatus });
        return false;
      }
      this.patch(id, {
        invoice,
        pageCount: result.pageCount,
        label: 'Reprocessed with selected locale',
        status: 'ready',
        progress: 100,
      });
      return true;
    } catch (error) {
      this.patch(id, {
        label: record.label,
        status: previousStatus,
        error: error instanceof Error ? error.message : 'Reprocessing failed.',
      });
      return false;
    }
  }

  remove(id: string) {
    this.ocrControllers.get(id)?.abort();
    this.ocrControllers.delete(id);
    this.files.delete(id);
    this.ocrRequested.delete(id);
    this.manuallyEdited.delete(id);
    this.commit(this.records.filter((r) => r.id !== id));
  }

  clear() {
    this.ocrControllers.forEach((controller) => controller.abort());
    this.ocrControllers.clear();
    this.files.clear();
    this.ocrRequested.clear();
    this.manuallyEdited.clear();
    this.commit([]);
  }

  private async pump() {
    if (this.running) return;
    this.running = true;

    try {
      for (;;) {
        const next = this.records.find((r) => r.status === 'queued');
        if (!next) break;
        await this.run(next);
      }
    } finally {
      this.running = false;
    }
  }

  private async run(record: BatchRecord) {
    const file = this.files.get(record.id);

    if (!file) {
      this.patch(record.id, { status: 'error', error: 'The file is no longer available.' });
      return;
    }

    const useOcr = this.ocrRequested.has(record.id);
    const controller = useOcr ? new AbortController() : undefined;
    if (controller) this.ocrControllers.set(record.id, controller);
    this.patch(record.id, {
      status: 'processing',
      progress: 2,
      label: useOcr ? 'Starting OCR' : 'Opening PDF',
      ocrRequested: useOcr,
    });

    try {
      const result = await this.processor(
        file,
        {
          ocr: useOcr,
          locale: this.locale,
          ocrLanguage: this.ocrRequested.get(record.id),
          signal: controller?.signal,
        },
        (percent, label) => this.patch(record.id, { progress: clamp(percent), label }),
      );

      const index = this.records.findIndex((r) => r.id === record.id);
      if (index < 0) return; // removed while processing

      if (result.kind === 'needs-ocr') {
        this.patch(record.id, {
          status: 'needs-ocr',
          progress: 100,
          label: 'Scanned PDF - OCR needed',
          pageCount: result.pageCount,
        });
        return;
      }

      const total = result.invoices.length;
      const ready: BatchRecord[] = result.invoices.map((invoice, k) => {
        const template = matchVendorTemplate(invoice, this.templates);
        const templateApplied =
          template && anchorsMatch(invoice, template)
            ? { id: template.id, name: template.name }
            : undefined;
        return {
        id: total > 1 ? `${record.id}#${k + 1}` : record.id,
        fileName: record.fileName,
        size: record.size,
        status: 'ready',
        progress: 100,
        label: 'Ready',
        invoice,
        pageCount: result.pageCount,
        segment: total > 1 ? { index: k + 1, total } : undefined,
        templateApplied,
      };
      });

      if (ready.length === 0) {
        this.patch(record.id, {
          status: 'error',
          error: 'No invoice could be read from this PDF.',
        });
        return;
      }

      const next = [...this.records];
      next.splice(index, 1, ...ready);
      this.commit(next);
      this.files.delete(record.id);
      for (const item of ready) {
        this.files.set(item.id, file);
        if (useOcr) this.ocrRequested.set(item.id, this.ocrRequested.get(record.id) ?? 'eng');
      }
      if (ready.length > 1) this.ocrRequested.delete(record.id);
    } catch (e) {
      if (controller?.signal.aborted) {
        this.patch(record.id, {
          status: 'cancelled',
          label: 'OCR cancelled',
          error: undefined,
        });
      } else {
        this.patch(record.id, {
          status: 'error',
          progress: 100,
          label: 'Failed',
          error: e instanceof Error ? e.message : 'This PDF could not be processed.',
        });
      }
    } finally {
      if (controller) this.ocrControllers.delete(record.id);
    }
  }
}
