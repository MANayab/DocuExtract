import { useState } from 'react';
import { saveAs } from 'file-saver';
import { invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { invoicesToJson } from '../../features/export/jsonExporter';
import type { ExportEntry } from '../../features/export/workbookModel';
import { IconDownload } from '../layout/Icons';

interface Props {
  entries: ExportEntry[];
  /** Used in file names and headings: "all invoices" or "this invoice". */
  scope: 'all' | 'one';
  flagged: number;
}

const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

export function ExportPanel({ entries, scope, flagged }: Props) {
  const [error, setError] = useState('');
  const base = `docuextract-${scope === 'all' ? 'invoices' : 'invoice'}-${stamp()}`;
  const empty = entries.length === 0;

  const downloadXlsx = async () => {
    setError('');
    try {
      // Loaded on demand: the Excel library is large and only needed for this button.
      const { invoicesToXlsx } = await import('../../features/export/xlsxExporter');
      saveAs(await invoicesToXlsx(entries), `${base}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The Excel file could not be created.');
    }
  };

  return (
    <section className="dx-card dx-export" aria-labelledby={`export-title-${scope}`}>
      <div>
        <h2 id={`export-title-${scope}`}>{scope === 'all' ? 'Export all invoices' : 'Export this invoice'}</h2>
        <p className="dx-muted dx-small">
          {empty
            ? 'Nothing to export yet.'
            : `${entries.length} invoice${entries.length === 1 ? '' : 's'} ready.`}
          {flagged > 0 ? ` ${flagged} flagged for review are marked in the Status column.` : ''}
        </p>
        {error && <p role="alert" className="dx-error-text">{error}</p>}
      </div>

      <div className="dx-export__buttons">
        <button type="button" className="dx-btn dx-btn--primary" disabled={empty} onClick={downloadXlsx}>
          <IconDownload /> Download Excel
        </button>
        <button type="button" className="dx-btn" disabled={empty} onClick={() => saveAs(invoicesToCsv(entries), `${base}.csv`)}>
          CSV · invoices
        </button>
        <button type="button" className="dx-btn" disabled={empty} onClick={() => saveAs(lineItemsToCsv(entries), `${base}-line-items.csv`)}>
          CSV · line items
        </button>
        <button type="button" className="dx-btn" disabled={empty} onClick={() => saveAs(invoicesToJson(entries), `${base}.json`)}>
          JSON
        </button>
      </div>
    </section>
  );
}
