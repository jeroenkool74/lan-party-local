import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HASH_A, HASH_ADMIN, HASH_B, mockApi, plugin, ride } from './fixtures.ts';

test('excludes the invisible server player and flags admins by kick_player permission', () => {
  const { api } = mockApi({
    online: [
      { id: 1, name: 'Alice', hash: HASH_A, group: 2 },
      { id: 3, name: 'Jeroen', hash: HASH_ADMIN, group: 0 },
    ],
  });
  const s = plugin.collectSnapshot(api);
  assert.deepEqual(s.players.map((p) => p.name), ['Alice', 'Jeroen']);
  assert.equal(s.players[0].isAdmin, false);
  assert.equal(s.players[1].isAdmin, true);
  assert.equal(s.sim.onlineCount, 2);
});

test('reads ownership from ffa-ownership and balances mirror ffa-individual-economy', () => {
  const { api } = mockApi({
    rides: [ride(0, { totalProfit: 1500 }), ride(1, { totalProfit: -300 }), ride(2, { type: 36, totalProfit: -80, classification: 'facility' })],
    owners: { 0: HASH_A, 1: HASH_A, 2: HASH_B },
    profiles: {
      [HASH_A]: { name: 'Alice', moneySpent: 4000, ridesCreated: [0, 1] },
      [HASH_B]: { name: 'Bob', moneySpent: 500, ridesCreated: [2] },
    },
    initialDollars: 10000,
  });
  const s = plugin.collectSnapshot(api);
  assert.equal(s.rides[0].owner, HASH_A);
  assert.equal(s.rides[0].ownerSource, 'ffa-ownership');
  assert.equal(s.rides[2].owner, HASH_B);
  // Alice: 10000 - 4000 + (1500 - 300)
  assert.equal(s.economy!.players[HASH_A].balance, 7200);
  // Bob: toilets never count negative profit: 10000 - 500 + 0
  assert.equal(s.economy!.players[HASH_B].balance, 9500);
});

test('released rides and unrated rides', () => {
  const { api } = mockApi({ rides: [ride(4, { excitement: 0xffff, intensity: -1 })], owners: { 4: 'released' } });
  const s = plugin.collectSnapshot(api);
  assert.equal(s.rides[0].owner, 'released');
  assert.equal(s.rides[0].excitement, null);
  assert.equal(s.rides[0].intensity, null);
});

test('broken down and crashed flags are decoded', () => {
  const { api } = mockApi({ rides: [ride(1, { flags: 1 << 7 }), ride(2, { flags: 1 << 10 })] });
  const s = plugin.collectSnapshot(api);
  assert.equal(s.rides[0].brokenDown, true);
  assert.equal(s.rides[1].crashed, true);
});

test('does not open park storage of plugins that are not loaded (that would create entries in the save)', () => {
  const { api, opened } = mockApi({ plugins: ['lan-stats'], rides: [ride(0)] });
  const s = plugin.collectSnapshot(api);
  assert.deepEqual(opened, []);
  assert.equal(s.economy, null);
  assert.equal(s.rides[0].owner, null);
  assert.equal(s.ffa.ownership, false);
});

test('economy is reported as inactive when the park has no money', () => {
  const { api } = mockApi({ noMoney: true, profiles: { [HASH_A]: { name: 'Alice', moneySpent: 1, ridesCreated: [] } } });
  assert.equal(plugin.collectSnapshot(api).economy, null);
});

test('snapshot survives missing optional API properties', () => {
  const { api } = mockApi({ rides: [ride(0)] });
  const r = api.map.rides[0] as unknown as Record<string, unknown>;
  Object.defineProperty(r, 'object', { get() { throw new Error('no object'); } });
  delete r.profit;
  const s = plugin.collectSnapshot(api);
  assert.equal(s.rides[0].objectName, null);
  assert.equal(s.rides[0].profitPerHour, null);
});

test('the server host profile (empty key hash) is not reported as a player', () => {
  const { api } = mockApi({ profiles: { '': { name: 'Server', moneySpent: 0, ridesCreated: [] }, [HASH_A]: { name: 'Alice', moneySpent: 0, ridesCreated: [] } } });
  assert.deepEqual(Object.keys(plugin.collectSnapshot(api).economy!.players), [HASH_A]);
});

test('undefined money values (INT64_MIN) are reported as null, not as huge negative numbers', () => {
  const { api } = mockApi({ rides: [ride(5, { profit: -9223372036854775808 })] });
  const s = plugin.collectSnapshot(api);
  assert.equal(s.rides[0].profitPerHour, null);
  assert.equal(s.rides[0].totalProfit, 1000);
});
