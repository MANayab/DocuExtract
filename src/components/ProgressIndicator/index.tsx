export function ProgressIndicator({ value, label }: { value: number; label: string }) {
  return (
    <div aria-live="polite" className="dx-progress">
      <div className="dx-progress__meta">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="dx-progress__track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="dx-progress__bar" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
