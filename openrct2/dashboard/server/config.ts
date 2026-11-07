export interface Config {
  httpPort: number;
  ingestPort: number;
  dbPath: string;
  staticDir: string;
  /** Expected snapshot interval of the plugin; used to decide when data is stale. */
  snapshotIntervalMs: number;
  /** Wall-clock seconds between stored history samples. */
  sampleIntervalSec: number;
  gameHost: string;
  gamePort: number;
  currencySymbol: string;
  title: string;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${v}"`);
  return n;
}

export function loadConfig(): Config {
  return {
    httpPort: int('HTTP_PORT', 8080),
    ingestPort: int('INGEST_PORT', 9000),
    dbPath: process.env.DB_PATH ?? '/data/stats.sqlite',
    staticDir: process.env.STATIC_DIR ?? new URL('../web/dist', import.meta.url).pathname,
    snapshotIntervalMs: int('STATS_INTERVAL_MS', 10000),
    sampleIntervalSec: int('HISTORY_SAMPLE_SECONDS', 60),
    gameHost: process.env.GAME_HOST ?? 'openrct2',
    gamePort: int('GAME_PORT', 11753),
    currencySymbol: process.env.CURRENCY_SYMBOL ?? '€',
    title: process.env.DASHBOARD_TITLE ?? 'LAN Tycoon',
  };
}
