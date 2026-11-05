// Wire format sent by plugins/lan-stats/lan-stats.js (schema 1).

export interface SnapshotRide {
  id: number;
  name: string;
  type: number | null;
  objectName: string | null;
  classification: 'ride' | 'stall' | 'facility' | null;
  status: string | null;
  brokenDown: boolean;
  crashed: boolean;
  excitement: number | null;
  intensity: number | null;
  nausea: number | null;
  totalCustomers: number;
  totalProfit: number;
  profitPerHour: number | null;
  incomePerHour: number | null;
  guestsOnRide: number | null;
  runningCost: number | null;
  value: number | null;
  buildDate: number | null;
  age: number | null;
  downtime: number | null;
  reliability: number | null;
  price: number | null;
  /** public key hash, the string "released", or null (park-owned / unknown) */
  owner: string | null;
  ownerSource: string | null;
}

export interface SnapshotPlayer {
  id: number;
  hash: string;
  name: string;
  group: string | null;
  isAdmin: boolean;
  ping: number | null;
}

export interface Snapshot {
  type: 'snapshot';
  schema: number;
  plugin: string;
  apiVersion: number | null;
  ffa: { ownership: boolean; economy: boolean; plugins: string[] };
  date: { year: number | null; month: number | null; day: number | null; monthsElapsed: number | null; ticksElapsed: number | null };
  sim: { paused: boolean | null; onlineCount: number };
  park: { name: string | null; guests: number | null; rating: number | null; value: number | null };
  players: SnapshotPlayer[];
  economy: null | {
    initialDollars: number;
    players: Record<string, { name: string; balance: number; moneySpent: number; ridesCreated: number }>;
  };
  rides: SnapshotRide[];
}

export type SimState = 'running' | 'paused' | 'unknown';
export type ServerStatus = 'online' | 'telemetry-unavailable' | 'offline' | 'starting';
