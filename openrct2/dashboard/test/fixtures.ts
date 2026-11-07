import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Snapshot } from '../server/types.ts';

const require = createRequire(import.meta.url);
const pluginPath = fileURLToPath(new URL('../../plugins/lan-stats/lan-stats.js', import.meta.url));

export const plugin = require(pluginPath) as {
  collectSnapshot: (api: unknown) => Snapshot;
};

export const HASH_A = 'a'.repeat(40);
export const HASH_B = 'b'.repeat(40);
export const HASH_ADMIN = 'c'.repeat(40);

export interface MockRide {
  id: number; name: string; type: number; classification: string; status: string;
  excitement: number; intensity: number; nausea: number; totalCustomers: number; totalProfit: number;
  buildDate: number; flags?: number; profit?: number; object?: { name: string }; price?: number[];
}

export function ride(id: number, over: Partial<MockRide> = {}): MockRide {
  return {
    id, name: `Ride ${id}`, type: 52, classification: 'ride', status: 'open', excitement: 500, intensity: 400,
    nausea: 200, totalCustomers: 100, totalProfit: 1000, buildDate: 1, flags: 0, profit: 50, object: { name: 'Wooden RC' },
    price: [20], ...over,
  };
}

/** Builds the OpenRCT2 globals the plugin reads, with FFA park storage. */
export function mockApi(opts: {
  rides?: MockRide[];
  online?: { id: number; name: string; hash: string; group: number }[];
  owners?: Record<number, string>;
  profiles?: Record<string, { name: string; moneySpent: number; ridesCreated: number[]; previousTotalProfit?: number }>;
  initialDollars?: number;
  ticks?: number;
  plugins?: string[];
  noMoney?: boolean;
}) {
  const storage: Record<string, Record<string, unknown>> = {
    'ffa-ownership': { rideOwners: opts.owners ?? {} },
    'ffa-individual-economy': {
      playerProfiles: opts.profiles ?? {},
      rideProperties: {},
      initialDollars: opts.initialDollars ?? 10000,
    },
  };
  const opened: string[] = [];
  const api = {
    context: {
      apiVersion: 124,
      paused: false,
      getParkStorage(name: string) {
        opened.push(name);
        const s = storage[name] ?? {};
        return { get: (k: string, d: unknown) => (k in s ? s[k] : d) };
      },
    },
    network: {
      groups: [
        { id: 0, name: 'Admin', permissions: ['kick_player', 'chat'] },
        { id: 2, name: 'Player', permissions: ['chat', 'build_ride'] },
      ],
      players: [{ id: 0, name: 'Server', publicKeyHash: '', group: 0, ping: 0 }, ...(opts.online ?? []).map((p) => ({ ...p, publicKeyHash: p.hash, ping: 5 }))],
    },
    park: { name: 'Test Park', guests: 321, rating: 800, value: 5000, getFlag: (f: string) => (f === 'noMoney' ? !!opts.noMoney : false) },
    date: { year: 1, month: 2, day: 14, monthsElapsed: 2, ticksElapsed: opts.ticks ?? 1000 },
    map: { rides: opts.rides ?? [] },
    pluginManager: {
      plugins: (opts.plugins ?? ['ffa-ownership', 'ffa-individual-economy', 'lan-stats']).map((name) => ({ name })),
    },
  };
  return { api, opened, storage };
}

export function snapshotFrom(opts: Parameters<typeof mockApi>[0]): Snapshot {
  return plugin.collectSnapshot(mockApi(opts).api);
}
