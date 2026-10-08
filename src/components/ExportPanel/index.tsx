import { useState } from 'react';
import { saveAs } from 'file-saver';
import type { Invoice } from '../../types/invoice';
import type { ValidationCheck } from '../../features/validation/totalsValidator';
import { invoiceToCsv } from '../../features/export/csvExporter';
import { invoiceToJson } from '../../features/export/jsonExporter';

export function ExportPanel({ invoice, checks }: { invoice: Invoice; checks: ValidationCheck[] }) {
  const [error, setError] = useState('');
  const name = invoice.extraction.sourceFile.replace(/\.pdf$/i, '') || 'invoice';

  const downloadXlsx = async () => {
    setError('');
    try {
      // Loaded on demand: the Excel library is large and only needed for this button.
      const { invoiceToXlsx } = await import('../../features/export/xlsxExporter');
      saveAs(await invoiceToXlsx(invoice, checks), `${name}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The Excel file could not be created.');
    }
  };

  return (
    <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Export</h2>
      <p className="mt-1 text-sm text-slate-500">
        Review your data and validations before using exports for accounting or tax purposes.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white" onClick={downloadXlsx}>
          Download XLSX
        </button>
        <button className="rounded-lg border px-4 py-2" onClick={() => saveAs(invoiceToCsv(invoice), `${name}.csv`)}>
          Download CSV
        </button>
        <button className="rounded-lg border px-4 py-2" onClick={() => saveAs(invoiceToJson(invoice), `${name}.json`)}>
          Download JSON
        </button>
      </div>
    </section>
  );
}
