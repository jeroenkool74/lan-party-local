import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { createHttpServer } from './http.ts';
import { startIngest } from './ingest.ts';
import { startProbe } from './probe.ts';
import { Tracker } from './tracker.ts';

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
const tracker = new Tracker(db, { snapshotIntervalMs: cfg.snapshotIntervalMs, sampleIntervalSec: cfg.sampleIntervalSec });

const ingest = startIngest(tracker, cfg.ingestPort);
const probe = startProbe(tracker, cfg.gameHost, cfg.gamePort);
const httpServer = createHttpServer(tracker, {
  staticDir: cfg.staticDir,
  publicConfig: { title: cfg.title, currencySymbol: cfg.currencySymbol, snapshotIntervalMs: cfg.snapshotIntervalMs },
});
httpServer.listen(cfg.httpPort, '0.0.0.0', () => console.info(`[http] dashboard on :${cfg.httpPort}`));

function stop(signal: string) {
  console.info(`[main] ${signal}, shutting down`);
  clearInterval(probe);
  ingest.close();
  httpServer.closeAllConnections();
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
