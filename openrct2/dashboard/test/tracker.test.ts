import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../server/db.ts';
import { Tracker } from '../server/tracker.ts';
import { HASH_A, HASH_ADMIN, HASH_B, ride, snapshotFrom } from './fixtures.ts';

function setup(path = ':memory:') {
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => { now += ms; } };
  const db = openDb(path);
  const tracker = new Tracker(db, { snapshotIntervalMs: 10_000, sampleIntervalSec: 60, now: clock.now });
  tracker.setConnected(true);
  return { db, tracker, clock };
}

const alice = { id: 1, name: 'Alice', hash: HASH_A, group: 2 };
const bob = { id: 2, name: 'Bob', hash: HASH_B, group: 2 };

test('online players appear online, disconnected players stay visible as offline', () => {
  const { tracker, clock } = setup();
  tracker.ingest(snapshotFrom({ online: [alice, bob], ticks: 100 }));
  let players = tracker.state().players;
  assert.equal(players.length, 2);
  assert.ok(players.every((p) => p.online));

  clock.advance(10_000);
  tracker.ingest(snapshotFrom({ online: [alice], ticks: 200 }));
  players = tracker.state().players;
  assert.equal(players.find((p) => p.name === 'Bob')!.online, false);
  assert.equal(players.find((p) => p.name === 'Alice')!.online, true);
  assert.equal(players.find((p) => p.name === 'Bob')!.lastSeen, 1_000_000);
});

test('a rename keeps the same identity (no duplicate player)', () => {
  const { tracker, clock } = setup();
  tracker.ingest(snapshotFrom({ online: [alice] }));
  clock.advance(10_000);
  tracker.ingest(snapshotFrom({ online: [{ ...alice, name: 'Alice the Great' }] }));
  const players = tracker.state().players;
  assert.equal(players.length, 1);
  assert.equal(players[0].name, 'Alice the Great');
});

test('ownership, balances and aggregates come from FFA data', () => {
  const { tracker } = setup();
  tracker.ingest(snapshotFrom({
    online: [alice],
    rides: [ride(0, { excitement: 650, totalProfit: 2000, totalCustomers: 300 }), ride(1, { excitement: 720, totalProfit: 500, totalCustomers: 50 }), ride(2)],
    owners: { 0: HASH_A, 1: HASH_A, 2: HASH_B },
    profiles: {
      [HASH_A]: { name: 'Alice', moneySpent: 3000, ridesCreated: [0, 1] },
      [HASH_B]: { name: 'Bob', moneySpent: 0, ridesCreated: [2] },
    },
  }));
  const { players, rides } = tracker.state();
  const a = players.find((p) => p.name === 'Alice')!;
  const b = players.find((p) => p.name === 'Bob')!;
  assert.equal(a.money, 10000 - 3000 + 2500);
  assert.equal(a.attractions, 2);
  assert.equal(a.totalProfit, 2500);
  assert.equal(a.guestsEntertained, 350);
  assert.equal(a.bestAttraction!.excitement, 720);
  assert.equal(b.online, false, 'offline player known only from economy profile');
  assert.equal(b.attractions, 1);
  assert.equal(rides.find((r) => r.rideId === 2)!.owner.kind, 'player');
  assert.equal((rides.find((r) => r.rideId === 2)!.owner as { name: string }).name, 'Bob');
  // public state must never contain key hashes
  assert.ok(!JSON.stringify(tracker.state()).includes(HASH_A));
});

test('demolished rides are kept with their last totals and ride id reuse creates a new attraction', () => {
  const { tracker, clock } = setup();
  const base = { online: [alice], owners: { 0: HASH_A }, profiles: { [HASH_A]: { name: 'Alice', moneySpent: 0, ridesCreated: [0] } } };
  tracker.ingest(snapshotFrom({ ...base, rides: [ride(0, { totalProfit: 900, totalCustomers: 40, buildDate: 1 })] }));
  clock.advance(10_000);
  tracker.ingest(snapshotFrom({ ...base, rides: [] }));
  let a = tracker.state().players[0];
  assert.equal(a.attractions, 0);
  assert.equal(a.demolished, 1);
  assert.equal(a.totalProfit, 900);
  assert.equal(tracker.rides(true).find((r) => r.rideId === 0)!.status, 'demolished');

  // OpenRCT2 re-uses id 0 for a new ride built later
  clock.advance(10_000);
  tracker.ingest(snapshotFrom({ ...base, rides: [ride(0, { totalProfit: 10, buildDate: 5, name: 'New' })] }));
  a = tracker.state().players[0];
  assert.equal(a.attractions, 1);
  assert.equal(a.totalProfit, 910);
  assert.equal(tracker.rides(true).length, 2);
});

test('admin flag is taken from the group permissions', () => {
  const { tracker } = setup();
  tracker.ingest(snapshotFrom({ online: [{ id: 3, name: 'Jeroen', hash: HASH_ADMIN, group: 0 }] }));
  assert.equal(tracker.state().players[0].isAdmin, true);
});

test('paused simulation is detected from ticks and does not produce history samples', () => {
  const { tracker, clock, db } = setup();
  tracker.ingest(snapshotFrom({ online: [alice], ticks: 100, rides: [ride(0)], owners: { 0: HASH_A } }));
  assert.equal(tracker.overview().simState, 'running');
  const samples = () => (db.prepare('SELECT COUNT(*) AS n FROM samples').get() as { n: number }).n;
  assert.equal(samples(), 1);

  // everybody leaves: ticks stop advancing
  for (let i = 0; i < 12; i++) {
    clock.advance(10_000);
    tracker.ingest(snapshotFrom({ online: [], ticks: 500, rides: [ride(0)], owners: { 0: HASH_A } }));
  }
  assert.equal(tracker.overview().simState, 'paused');
  assert.equal(tracker.overview().onlineCount, 0);
  assert.equal(samples(), 1, 'no samples while paused');

  clock.advance(10_000);
  tracker.ingest(snapshotFrom({ online: [alice], ticks: 900, rides: [ride(0)], owners: { 0: HASH_A } }));
  assert.equal(tracker.overview().simState, 'running');
});

test('stale telemetry: nobody is shown online and the status says telemetry is unavailable', () => {
  const { tracker, clock } = setup();
  tracker.ingest(snapshotFrom({ online: [alice] }));
  assert.equal(tracker.overview().serverStatus, 'online');
  clock.advance(60_000);
  tracker.setGamePortOpen(true);
  assert.equal(tracker.overview().serverStatus, 'telemetry-unavailable');
  assert.equal(tracker.overview().simState, 'unknown');
  assert.equal(tracker.state().players[0].online, false);
  tracker.setGamePortOpen(false);
  assert.equal(tracker.overview().serverStatus, 'offline');
});

test('history and last snapshot survive a restart (file database)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lan-stats-'));
  const path = join(dir, 'stats.sqlite');
  try {
    const first = setup(path);
    first.tracker.ingest(snapshotFrom({ online: [alice], ticks: 1, rides: [ride(0)], owners: { 0: HASH_A } }));
    first.clock.advance(61_000);
    first.tracker.ingest(snapshotFrom({ online: [alice], ticks: 2, rides: [ride(0, { totalProfit: 5000 })], owners: { 0: HASH_A } }));
    first.db.close();

    const second = setup(path);
    second.tracker.setConnected(false);
    const state = second.tracker.state();
    assert.equal(state.players[0].name, 'Alice');
    assert.equal(state.players[0].online, false, 'no live telemetry after restart yet');
    assert.equal(state.overview.gameDate, '14 May, year 1');
    const pid = state.players[0].id;
    const detail = second.tracker.playerDetail(pid)!;
    assert.equal(detail.history.length, 2);
    assert.equal(second.tracker.history(0).series[pid].length, 2);
    second.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects malformed snapshots without touching the database', () => {
  const { tracker } = setup();
  assert.throws(() => tracker.ingest({ type: 'snapshot' } as never));
  assert.equal(tracker.state().players.length, 0);
});
