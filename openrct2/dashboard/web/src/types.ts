export type ServerStatus = 'online' | 'telemetry-unavailable' | 'offline' | 'starting';
export type SimState = 'running' | 'paused' | 'unknown';

export interface Overview {
  serverStatus: ServerStatus;
  telemetry: { live: boolean; connected: boolean; lastUpdate: number | null; ageSeconds: number | null; plugin: string | null };
  simState: SimState;
  gameDate: string | null;
  parkName: string | null;
  onlineCount: number;
  knownPlayers: number;
  attractions: number;
  guests: number | null;
  parkRating: number | null;
  ffa: { ownership: boolean; economy: boolean; plugins: string[] } | null;
}

export interface Player {
  id: string;
  name: string;
  online: boolean;
  isAdmin: boolean;
  group: string | null;
  money: number | null;
  attractions: number;
  demolished: number;
  totalProfit: number;
  guestsEntertained: number;
  bestAttraction: { id: string; name: string; excitement: number | null } | null;
  firstSeen: number;
  lastSeen: number | null;
}

export type Owner = { kind: 'player'; id: string; name: string } | { kind: 'released' } | { kind: 'park' };

export interface Ride {
  uid: string;
  rideId: number;
  name: string;
  owner: Owner;
  classification: 'ride' | 'stall' | 'facility' | null;
  objectName: string | null;
  excitement: number | null;
  intensity: number | null;
  nausea: number | null;
  totalProfit: number;
  profitPerHour: number | null;
  totalCustomers: number;
  guestsOnRide: number | null;
  status: string | null;
  age: number | null;
  price: number | null;
  deletedAt: number | null;
}

export interface State {
  overview: Overview;
  players: Player[];
  rides: Ride[];
}

export interface PlayerDetail {
  player: Player;
  rides: Ride[];
  history: { ts: number; money: number | null; attractions: number; profit: number; guests: number }[];
}

export interface History {
  fields: string[];
  series: Record<string, [number, number | null, number, number, number][]>;
}

export interface PublicConfig {
  title: string;
  currencySymbol: string;
  snapshotIntervalMs: number;
}
