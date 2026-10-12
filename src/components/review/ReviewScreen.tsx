import type { ExportEntry } from '../../features/export/workbookModel';
import type { InvoiceAnalysis } from '../../features/validation/analysis';
import type { BatchRecord } from '../../types/batch';
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
}

export function ReviewScreen({ record, invoice, analysis, position, onBack, onPrev, onNext, onChange }: Props) {
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

      <div className="dx-stack">
        <InvoicePreview invoice={invoice} onChange={onChange} />
        <ExtractionTable invoice={invoice} onChange={onChange} />
        <ValidationPanel checks={analysis.checks} />
        <ExportPanel entries={[entry]} scope="one" flagged={analysis.status === 'REVIEW' ? 1 : 0} />
      </div>
    </div>
  );
}
