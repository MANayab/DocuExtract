import type { BatchRecord, OcrLanguage } from '../../types/batch';
import { analyzeInvoice } from '../../features/validation/analysis';
import { confidenceBand, formatBytes, formatMoney } from '../../utils/formatting';
import { IconFile, IconScan, IconTrash } from '../layout/Icons';

interface Props {
  records: BatchRecord[];
  duplicates: Set<string>;
  /** null while checking, false when this build ships without OCR data. */
  ocrAvailable: boolean | null;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onOcr: (id: string, language: OcrLanguage) => void;
  onCancel: (id: string) => void;
  ocrLanguage: OcrLanguage;
  onClear: () => void;
}

function StatusCell({
  record,
  ocrAvailable,
  onOcr,
  onCancel,
  ocrLanguage,
}: {
  record: BatchRecord;
  ocrAvailable: boolean | null;
  onOcr: (id: string, language: OcrLanguage) => void;
  onCancel: (id: string) => void;
  ocrLanguage: OcrLanguage;
}) {
  switch (record.status) {
    case 'queued':
      return <span className="dx-badge dx-badge--idle">Queued</span>;

    case 'processing':
      return (
        <div className="dx-rowprogress" aria-live="polite">
          <div className="dx-rowprogress__track">
            <span style={{ width: `${record.progress}%` }} />
          </div>
          <span className="dx-rowprogress__label">{record.label}</span>
          {record.ocrRequested && (
            <button
              type="button"
              className="dx-btn dx-btn--small dx-btn--ghost"
              onClick={() => onCancel(record.id)}
            >
              Cancel OCR
            </button>
          )}
        </div>
      );

    case 'needs-ocr':
      return (
        <div className="dx-statusstack">
          <span className="dx-badge dx-badge--info">Scanned PDF</span>
          <button
            type="button"
            className="dx-btn dx-btn--small"
            onClick={() => onOcr(record.id, ocrLanguage)}
            disabled={ocrAvailable === false}
            title={
              ocrAvailable === false
                ? 'OCR files are not bundled in this build (see docs/OCR.md)'
                : 'Read this scan with OCR'
            }
          >
            <IconScan /> Run OCR
          </button>
        </div>
      );

    case 'cancelled':
      return (
        <div className="dx-statusstack">
          <span className="dx-badge dx-badge--warn">Cancelled</span>
          <button
            type="button"
            className="dx-btn dx-btn--small"
            onClick={() => onOcr(record.id, ocrLanguage)}
          >
            Retry OCR
          </button>
        </div>
      );

    case 'error':
      return (
        <div className="dx-statusstack">
          <span className="dx-badge dx-badge--bad">Failed</span>
          <span className="dx-rowerror">{record.error}</span>
          {record.ocrRequested && (
            <button
              type="button"
              className="dx-btn dx-btn--small"
              onClick={() => onOcr(record.id, ocrLanguage)}
            >
              Retry OCR
            </button>
          )}
        </div>
      );

    default: {
      const analysis = record.invoice ? analyzeInvoice(record.invoice) : undefined;
      if (!analysis) return null;

      return analysis.status === 'PASS' ? (
        <span className="dx-badge dx-badge--good">Validated</span>
      ) : (
        <div className="dx-statusstack" title={analysis.reasons.join('\n')}>
          <span className="dx-badge dx-badge--warn">Review</span>
          <span className="dx-rowhint">{analysis.reasons[0]}</span>
        </div>
      );
    }
  }
}

export function ResultsTable({
  records,
  duplicates,
  ocrAvailable,
  onOpen,
  onRemove,
  onOcr,
  onCancel,
  ocrLanguage,
  onClear,
}: Props) {
  return (
    <section className="dx-card" aria-labelledby="results-title">
      <div className="dx-card__head">
        <h2 id="results-title">Invoices</h2>
        <button type="button" className="dx-link" onClick={onClear}>
          Clear all
        </button>
      </div>

      <div className="dx-tablewrap">
        <table className="dx-table">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Invoice</th>
              <th scope="col">Seller</th>
              <th scope="col" className="dx-num">
                Total
              </th>
              <th scope="col">Confidence</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="dx-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const invoice = record.invoice;
              const ready = record.status === 'ready' && invoice;
              const pages = invoice?.extraction.pageCount ?? record.pageCount;

              return (
                <tr key={record.id} className={record.status === 'error' ? 'is-error' : undefined}>
                  <td>
                    <div className="dx-filecell">
                      <span className="dx-filecell__icon">
                        <IconFile />
                      </span>
                      <div>
                        <p className="dx-filecell__name" title={record.fileName}>
                          {record.fileName}
                        </p>
                        <p className="dx-filecell__meta">
                          {record.segment
                            ? `Invoice ${record.segment.index} of ${record.segment.total} · `
                            : ''}
                          {formatBytes(record.size)}
                          {pages ? ` · ${pages} page${pages === 1 ? '' : 's'}` : ''}
                          {invoice?.extraction.sourceType === 'ocr' ? ' · OCR' : ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td>
                    {ready ? (
                      <>
                        <p className="dx-strong">{invoice.invoiceNumber.value || '—'}</p>
                        <p className="dx-muted dx-small">
                          {invoice.invoiceDate.value || 'No date'}
                        </p>
                        {record.templateApplied && (
                          <span className="dx-chip">
                            Template applied: {record.templateApplied.name}
                          </span>
                        )}
                        {duplicates.has(record.id) && (
                          <span className="dx-chip">Possible duplicate</span>
                        )}
                      </>
                    ) : (
                      <span className="dx-muted">—</span>
                    )}
                  </td>

                  <td>
                    {ready ? (
                      invoice.seller.name.value || <span className="dx-muted">—</span>
                    ) : (
                      <span className="dx-muted">—</span>
                    )}
                  </td>

                  <td className="dx-num dx-strong">
                    {ready ? (
                      formatMoney(invoice.grandTotal.value, invoice.currency.value)
                    ) : (
                      <span className="dx-muted">—</span>
                    )}
                  </td>

                  <td>
                    {ready ? (
                      <div
                        className={`dx-conf dx-conf--${confidenceBand(invoice.extraction.confidence).toLowerCase()}`}
                      >
                        <div className="dx-conf__track">
                          <span style={{ width: `${invoice.extraction.confidence}%` }} />
                        </div>
                        <span>{invoice.extraction.confidence}%</span>
                      </div>
                    ) : (
                      <span className="dx-muted">—</span>
                    )}
                  </td>

                  <td>
                    <StatusCell
                      record={record}
                      ocrAvailable={ocrAvailable}
                      onOcr={onOcr}
                      onCancel={onCancel}
                      ocrLanguage={ocrLanguage}
                    />
                  </td>

                  <td>
                    <div className="dx-actions">
                      {ready && (
                        <button
                          type="button"
                          className="dx-btn dx-btn--small dx-btn--ghost"
                          onClick={() => onOpen(record.id)}
                          aria-label={`Review ${record.fileName}`}
                        >
                          Review
                        </button>
                      )}
                      <button
                        type="button"
                        className="dx-iconbtn"
                        onClick={() => onRemove(record.id)}
                        aria-label={`Remove ${record.fileName}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
