import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import type { Tracker } from './tracker.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

export interface HttpOptions {
  staticDir: string;
  publicConfig: Record<string, unknown>;
  heartbeatMs?: number;
}

/** Read-only HTTP API + static frontend. There are deliberately no write endpoints. */
export function createHttpServer(tracker: Tracker, opts: HttpOptions): http.Server {
  const clients = new Set<http.ServerResponse>();
  const staticRoot = resolve(opts.staticDir);

  let pending: NodeJS.Timeout | null = null;
  const broadcast = () => {
    if (pending) return;
    // coalesce bursts (join + snapshot) into one push
    pending = setTimeout(() => {
      pending = null;
      if (clients.size === 0) return;
      const payload = `event: state\ndata: ${JSON.stringify(tracker.state())}\n\n`;
      for (const res of clients) res.write(payload);
    }, 250);
  };
  tracker.onChange(broadcast);
  // Periodic push so "last update" ages and stale/offline transitions show without new data.
  setInterval(broadcast, opts.heartbeatMs ?? 15000).unref();

  const json = (res: http.ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' });
      res.end();
      return;
    }
    try {
      if (path === '/healthz') return json(res, 200, { ok: true, serverStatus: tracker.serverStatus() });
      if (path === '/api/config') return json(res, 200, opts.publicConfig);
      if (path === '/api/state') return json(res, 200, tracker.state());
      if (path === '/api/overview') return json(res, 200, tracker.overview());
      if (path === '/api/rides') return json(res, 200, tracker.rides(url.searchParams.get('include') === 'demolished'));
      if (path === '/api/history') {
        const hours = Math.min(Math.max(Number(url.searchParams.get('hours') ?? 72), 1), 24 * 30);
        return json(res, 200, tracker.history(Date.now() - hours * 3600_000));
      }
      const m = /^\/api\/players\/([0-9a-f]{16})$/.exec(path);
      if (m) {
        const detail = tracker.playerDetail(m[1]);
        return detail ? json(res, 200, detail) : json(res, 404, { error: 'unknown player' });
      }
      if (path === '/api/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        res.write(`retry: 5000\nevent: state\ndata: ${JSON.stringify(tracker.state())}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: 'not found' });
      return serveStatic(staticRoot, path, res);
    } catch (e) {
      console.error('[http]', e);
      json(res, 500, { error: 'internal error' });
    }
  });
}

function serveStatic(root: string, path: string, res: http.ServerResponse): void {
  const rel = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html'); // SPA fallback
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('frontend not built');
    return;
  }
  const immutable = file.includes(`${root}/assets/`);
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(res);
}
