import type { Invoice, InvoiceItem } from '../../types/invoice';
import { confidenceBand } from '../../utils/formatting';

type NumericKey = 'quantity' | 'unitPrice' | 'discount' | 'taxRate' | 'taxAmount' | 'lineTotal';

const COLUMNS: { key: NumericKey; label: string }[] = [
  { key: 'quantity', label: 'Qty' },
  { key: 'unitPrice', label: 'Unit price' },
  { key: 'discount', label: 'Discount' },
  { key: 'taxRate', label: 'Tax %' },
  { key: 'taxAmount', label: 'Tax amount' },
  { key: 'lineTotal', label: 'Line total' },
];

export function ExtractionTable({ invoice, onChange }: { invoice: Invoice; onChange: (i: Invoice) => void }) {
  const update = (n: number, item: InvoiceItem) => {
    const items = [...invoice.items];
    items[n] = item;
    onChange({ ...invoice, items });
  };

  return (
    <section className="dx-card" aria-labelledby="items-title">
      <div className="dx-card__head">
        <h2 id="items-title">Line items</h2>
        <span className="dx-muted dx-small">{invoice.items.length} detected</span>
      </div>

      <div className="dx-tablewrap">
        <table className="dx-table dx-table--items">
          <thead>
            <tr>
              <th scope="col">Description</th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="dx-num">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, n) => (
              <tr key={n}>
                <td>
                  <input
                    className={`dx-input dx-input--cell dx-conf-${confidenceBand(item.description.confidence).toLowerCase()}`}
                    value={item.description.value}
                    aria-label={`Description ${n + 1}`}
                    onChange={(e) => update(n, { ...item, description: { ...item.description, value: e.target.value, source: 'manual' } })}
                  />
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="dx-num">
                    <input
                      className={`dx-input dx-input--cell dx-input--num dx-conf-${confidenceBand(item[c.key].confidence).toLowerCase()}`}
                      type="number"
                      step="any"
                      value={Number(item[c.key].value)}
                      aria-label={`${c.key} ${n + 1}`}
                      onChange={(e) =>
                        update(n, { ...item, [c.key]: { ...item[c.key], value: Number(e.target.value), source: 'manual' } } as InvoiceItem)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
            {invoice.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="dx-empty">
                  No line items were detected. Totals above were still read; check them against the PDF.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
