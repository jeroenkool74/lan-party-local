import net from 'node:net';
import type { Tracker } from './tracker.ts';
import type { Snapshot } from './types.ts';

const MAX_LINE_BYTES = 8 * 1024 * 1024;

/**
 * Receives newline-delimited JSON from the lan-stats plugin. Only reachable on
 * the internal compose network (the port is not published). The plugin never
 * receives anything back, so this endpoint cannot be used to control the game.
 */
export function startIngest(tracker: Tracker, port: number, log = console): net.Server {
  let active: net.Socket | null = null;

  const server = net.createServer((sock) => {
    // The plugin keeps a single connection; a new one replaces the old one.
    if (active && active !== sock) active.destroy();
    active = sock;
    tracker.setConnected(true);
    log.info(`[ingest] plugin connected from ${sock.remoteAddress}`);
    sock.setEncoding('utf8');
    sock.setKeepAlive(true, 30_000);
    let buf = '';

    sock.on('data', (chunk: string) => {
      buf += chunk;
      if (buf.length > MAX_LINE_BYTES) {
        log.warn('[ingest] oversized message, dropping buffer');
        buf = '';
        return;
      }
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) handleLine(line);
      }
    });
    sock.on('close', () => {
      if (active === sock) {
        active = null;
        tracker.setConnected(false);
        log.info('[ingest] plugin disconnected');
      }
    });
    sock.on('error', (err) => log.warn(`[ingest] socket error: ${err.message}`));
  });

  function handleLine(line: string): void {
    let msg: { type?: string };
    try {
      msg = JSON.parse(line);
    } catch {
      // A partial write on the plugin side can corrupt one line; the next one resynchronises.
      log.warn('[ingest] ignoring malformed line');
      return;
    }
    if (msg.type === 'hello') {
      log.info(`[ingest] hello from lan-stats ${JSON.stringify(msg)}`);
    } else if (msg.type === 'snapshot') {
      try {
        tracker.ingest(msg as Snapshot);
      } catch (e) {
        log.warn(`[ingest] snapshot rejected: ${(e as Error).message}`);
      }
    }
  }

  server.listen(port, '0.0.0.0', () => log.info(`[ingest] listening on :${port}`));
  return server;
}
