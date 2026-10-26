import type { ExportEntry } from '../../features/export/workbookModel';
import type { InvoiceAnalysis } from '../../features/validation/analysis';
import type { BatchRecord } from '../../types/batch';
import { LOCALES, type LocaleCode } from '../../config/locales';
import type { Invoice } from '../../types/invoice';
import { ExportPanel } from '../ExportPanel';
import { ExtractionTable } from '../ExtractionTable';
import { InvoicePreview } from '../InvoicePreview';
import { IconAlert, IconArrowLeft } from '../layout/Icons';
import { ValidationPanel } from '../ValidationPanel';

interface Props {
  record: BatchRecord;
  invoice: Invoice;
  analysis: InvoiceAnalysis;
  position: { index: number; total: number };
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChange: (invoice: Invoice) => void;
  locale: LocaleCode;
  onLocaleChange: (locale: LocaleCode) => void;
  canReprocess: boolean;
  onReprocess: () => void;
}

export function ReviewScreen({ record, invoice, analysis, position, onBack, onPrev, onNext, onChange, locale, onLocaleChange, canReprocess, onReprocess }: Props) {
  const entry: ExportEntry = { invoice, checks: analysis.checks };

  return (
    <div className="dx-container dx-review">
      <div className="dx-review__bar">
        <button type="button" className="dx-btn dx-btn--ghost" onClick={onBack}>
          <IconArrowLeft /> All invoices
        </button>
        <div className="dx-review__nav">
          <span className="dx-muted dx-small">
            {position.index} of {position.total}
          </span>
          <button type="button" className="dx-btn dx-btn--small" onClick={onPrev} disabled={!onPrev}>
            Previous
          </button>
          <button type="button" className="dx-btn dx-btn--small" onClick={onNext} disabled={!onNext}>
            Next
          </button>
        </div>
      </div>

      <header className="dx-review__title">
        <h1>
          {invoice.invoiceNumber.value || 'Invoice'}
          <span className={`dx-badge ${analysis.status === 'PASS' ? 'dx-badge--good' : 'dx-badge--warn'}`}>
            {analysis.status === 'PASS' ? 'Validated' : 'Review'}
          </span>
        </h1>
        <p className="dx-muted">
          {record.fileName}
          {record.segment ? ` · invoice ${record.segment.index} of ${record.segment.total} in this PDF` : ''}
          {invoice.extraction.sourceType === 'ocr' ? ' · read with OCR' : ''}
        </p>
      </header>

      {analysis.reasons.length > 0 && (
        <div className="dx-alert dx-alert--warn" role="status">
          <IconAlert />
          <div>
            <p className="dx-strong">Check these before exporting</p>
            <ul>
              {analysis.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="dx-panel" aria-labelledby="review-locale-heading">
        <h2 id="review-locale-heading">Number and date format</h2>
        <label htmlFor="review-invoice-locale">Invoice locale</label>
        <select id="review-invoice-locale" value={locale} onChange={(event) => onLocaleChange(event.target.value as LocaleCode)}>
          {Object.values(LOCALES).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
        </select>
        <p className="dx-muted">Controls ambiguous dates and number separators. Review financial data before relying on it.</p>
        <button type="button" className="dx-btn" onClick={onReprocess} disabled={!canReprocess}>Reprocess with this locale</button>
        {!canReprocess && <p className="dx-muted" role="status">This invoice has manual edits or its source PDF is unavailable. Reprocessing is disabled to protect your changes.</p>}
      </section>

      <div className="dx-stack">
        <InvoicePreview invoice={invoice} onChange={onChange} />
        <ExtractionTable invoice={invoice} onChange={onChange} />
        <ValidationPanel checks={analysis.checks} />
        <ExportPanel entries={[entry]} scope="one" flagged={analysis.status === 'REVIEW' ? 1 : 0} />
      </div>
    </div>
  );
}
