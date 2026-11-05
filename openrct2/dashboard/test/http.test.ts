import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.ts';
import { createHttpServer } from '../server/http.ts';
import { startIngest } from '../server/ingest.ts';
import { Tracker } from '../server/tracker.ts';
import { HASH_A, ride, snapshotFrom } from './fixtures.ts';

const quiet = { info() {}, warn() {} } as unknown as Console;

async function boot() {
  const dir = mkdtempSync(join(tmpdir(), 'lan-web-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>t</title>');
  const db = openDb(':memory:');
  const tracker = new Tracker(db, { snapshotIntervalMs: 10_000, sampleIntervalSec: 60 });
  const ingest = startIngest(tracker, 0, quiet);
  const web = createHttpServer(tracker, { staticDir: dir, publicConfig: { currencySymbol: '€' }, heartbeatMs: 60_000 });
  await new Promise<void>((r) => web.listen(0, '127.0.0.1', r));
  await new Promise<void>((r) => (ingest.listening ? r() : ingest.once('listening', r)));
  const base = `http://127.0.0.1:${(web.address() as AddressInfo).port}`;
  const ingestPort = (ingest.address() as AddressInfo).port;
  const close = () => { web.closeAllConnections(); web.close(); ingest.close(); db.close(); rmSync(dir, { recursive: true, force: true }); };
  return { tracker, base, ingestPort, close };
}

const waitFor = async (fn: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
};

test('NDJSON ingest (with a corrupted line) updates the API; write methods are rejected', async () => {
  const app = await boot();
  try {
    const sock = net.connect(app.ingestPort, '127.0.0.1');
    await new Promise((r) => sock.once('connect', r));
    const snap = snapshotFrom({ online: [{ id: 1, name: 'Alice', hash: HASH_A, group: 2 }], rides: [ride(0)], owners: { 0: HASH_A } });
    const line = JSON.stringify(snap);
    // a truncated line (partial write) followed by a good one, split across chunks
    sock.write(line.slice(0, 50) + '\n' + line.slice(0, 100));
    sock.write(line.slice(100) + '\n');
    await waitFor(() => app.tracker.isLive());

    const state = await (await fetch(`${app.base}/api/state`)).json();
    assert.equal(state.overview.serverStatus, 'online');
    assert.equal(state.players[0].name, 'Alice');
    assert.equal(state.players[0].online, true);
    assert.equal(state.rides[0].owner.name, 'Alice');

    const detail = await fetch(`${app.base}/api/players/${state.players[0].id}`);
    assert.equal(detail.status, 200);
    assert.equal((await fetch(`${app.base}/api/players/0123456789abcdef`)).status, 404);
    assert.equal((await fetch(`${app.base}/api/state`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${app.base}/api/nothing`)).status, 404);
    assert.equal((await fetch(`${app.base}/some/spa/route`)).status, 200);
    assert.equal((await fetch(`${app.base}/..%2f..%2fetc%2fpasswd`)).status, 200, 'traversal falls back to index.html');

    sock.destroy();
    await waitFor(() => !app.tracker.isLive());
    assert.equal(app.tracker.overview().telemetry.connected, false);
  } finally {
    app.close();
  }
});

test('server-sent events push the state', async () => {
  const app = await boot();
  try {
    const ctrl = new AbortController();
    const res = await fetch(`${app.base}/api/events`, { signal: ctrl.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.match(first, /event: state/);
    app.tracker.setConnected(true);
    app.tracker.ingest(snapshotFrom({ online: [{ id: 1, name: 'Zoe', hash: HASH_A, group: 2 }] }));
    let text = '';
    while (!text.includes('Zoe')) text += new TextDecoder().decode((await reader.read()).value);
    ctrl.abort();
  } finally {
    app.close();
  }
});
