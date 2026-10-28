import type { ValidationCheck } from '../../features/validation/totalsValidator';

export function ValidationPanel({ checks }: { checks: ValidationCheck[] }) {
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  return (
    <section className="dx-card" aria-labelledby="validation-title">
      <div className="dx-card__head">
        <h2 id="validation-title">Validation</h2>
        <span className={`dx-badge ${failed ? 'dx-badge--warn' : 'dx-badge--good'}`}>
          {failed ? `${failed} to review` : 'All checks passed'}
        </span>
      </div>

      <ul className="dx-checks">
        {checks.map((c, i) => (
          <li key={i} className={`dx-check dx-check--${c.status === 'PASS' ? 'pass' : 'fail'}`}>
            <div className="dx-check__head">
              <strong>{c.check}</strong>
              <span>{c.status}</span>
            </div>
            <p>
              Expected {c.expected === null ? 'unavailable' : c.expected.toFixed(2)}, actual {c.actual === null ? 'unavailable' : c.actual.toFixed(2)}. {c.message}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
