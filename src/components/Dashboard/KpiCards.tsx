import type { BatchSummary } from '../../features/batch/summary';
import { formatMoney } from '../../utils/formatting';

function totalLabel(totals: BatchSummary['totals']): { value: string; sub: string } {
  if (totals.length === 0) return { value: '—', sub: 'No invoices yet' };
  if (totals.length === 1) return { value: formatMoney(totals[0].amount, totals[0].currency), sub: 'Sum of grand totals' };

  return {
    value: 'Mixed currencies',
    sub: totals.map((t) => formatMoney(t.amount, t.currency)).join(' · '),
  };
}

export function KpiCards({ summary }: { summary: BatchSummary }) {
  const total = totalLabel(summary.totals);
  const pending = summary.inProgress + summary.needsOcr;

  return (
    <section aria-label="Batch summary" className="dx-kpis">
      <article className="dx-kpi">
        <p className="dx-kpi__label">Invoices extracted</p>
        <p className="dx-kpi__value">{summary.invoices}</p>
        <p className="dx-kpi__sub">
          from {summary.files} file{summary.files === 1 ? '' : 's'}
          {pending > 0 ? ` · ${pending} pending` : ''}
          {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
        </p>
      </article>

      <article className="dx-kpi">
        <p className="dx-kpi__label">Total value</p>
        <p className="dx-kpi__value dx-kpi__value--money">{total.value}</p>
        <p className="dx-kpi__sub">{total.sub}</p>
      </article>

      <article className={`dx-kpi${summary.needsReview > 0 ? ' dx-kpi--warn' : ''}`}>
        <p className="dx-kpi__label">Need review</p>
        <p className="dx-kpi__value">{summary.needsReview}</p>
        <p className="dx-kpi__sub">{summary.passed} passed every check</p>
      </article>

      <article className="dx-kpi">
        <p className="dx-kpi__label">Average confidence</p>
        <p className="dx-kpi__value">{summary.avgConfidence === null ? '—' : `${summary.avgConfidence}%`}</p>
        <div className="dx-kpi__meter" aria-hidden="true">
          <span style={{ width: `${summary.avgConfidence ?? 0}%` }} />
        </div>
      </article>
    </section>
  );
}
