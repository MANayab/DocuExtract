export const money = (value: number, currency = '') =>
  `${currency ? currency + ' ' : ''}${Number.isFinite(value) ? value.toFixed(2) : '—'}`;

export const confidenceBand = (n: number) => (n >= 90 ? 'HIGH' : n >= 70 ? 'MEDIUM' : 'LOW');

/** Currency-aware amount ("₹12,450.00"); falls back to "CODE 12450.00" for unknown codes. */
export function formatMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return '—';

  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
  } catch {
    return money(value, currency);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
