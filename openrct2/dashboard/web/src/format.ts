let currency = '€';
export function setCurrency(symbol: string): void {
  currency = symbol;
}

const full = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

/** OpenRCT2 money is stored in tenths of the base currency (£/$/€ have rate 10). */
export function money(raw: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (raw === null || raw === undefined) return '—';
  const v = raw / 10;
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const body = opts.compact && abs >= 10_000 ? compact.format(abs) : full.format(abs);
  return `${sign}${currency}${body}`;
}

export function num(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined) return '—';
  return opts.compact && Math.abs(v) >= 10_000 ? compact.format(v) : full.format(v);
}

/** Ratings are fixed-point ×100 (652 = 6.52). */
export function rating(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : (v / 100).toFixed(2);
}

export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 36) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(ms: number): string {
  return new Date(ms).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
