import type { DatabaseSync } from 'node:sqlite';
import { getMeta, publicId, setMeta, transaction } from './db.ts';
import type { ServerStatus, SimState, Snapshot, SnapshotRide } from './types.ts';

const RELEASED = 'released';
const MONTHS = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];

export interface TrackerOptions {
  snapshotIntervalMs: number;
  sampleIntervalSec: number;
  now?: () => number;
}

interface PlayerRow {
  hash: string; pid: string; name: string; first_seen: number; last_seen: number | null;
  group_name: string | null; is_admin: number; balance: number | null; money_spent: number | null;
}
interface RideRow {
  uid: string; ride_id: number; owner_hash: string | null; released: number; name: string;
  classification: string | null; first_seen: number; last_seen: number; deleted_at: number | null;
  total_profit: number; total_customers: number; excitement: number | null; data: string;
}

/** Key that survives OpenRCT2 re-using ride ids after a demolition. */
export function rideUid(r: Pick<SnapshotRide, 'id' | 'buildDate' | 'type'>): string {
  return `${r.id}:${r.buildDate ?? 'x'}:${r.type ?? 'x'}`;
}

export function formatGameDate(d: Snapshot['date']): string | null {
  if (d.year == null || d.month == null || d.day == null) return null;
  return `${d.day} ${MONTHS[d.month] ?? `month ${d.month}`}, year ${d.year}`;
}

export class Tracker {
  readonly db: DatabaseSync;
  private readonly opts: Required<TrackerOptions>;
  private last: Snapshot | null = null;
  private lastAt = 0;
  private prevTicks: number | null = null;
  private simState: SimState = 'unknown';
  private lastSampleAt = 0;
  private lastSampleTicks: number | null = null;
  private connected = false;
  private gamePortOpen: boolean | null = null;
  private listeners = new Set<() => void>();

  constructor(db: DatabaseSync, opts: TrackerOptions) {
    this.db = db;
    this.opts = { now: Date.now, ...opts };
    // Restore the last known snapshot so the dashboard has data right after a restart.
    const saved = getMeta(db, 'last_snapshot');
    if (saved) {
      try {
        this.last = JSON.parse(saved) as Snapshot;
        this.lastAt = Number(getMeta(db, 'last_snapshot_at') ?? 0);
        this.lastSampleAt = Number(getMeta(db, 'last_sample_at') ?? 0);
      } catch {
        this.last = null;
      }
    }
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* listener errors must not break ingestion */ }
    }
  }

  setConnected(connected: boolean): void {
    if (this.connected !== connected) {
      this.connected = connected;
      this.emit();
    }
  }

  setGamePortOpen(open: boolean): void {
    if (this.gamePortOpen !== open) {
      this.gamePortOpen = open;
      this.emit();
    }
  }

  /** Telemetry is live when a snapshot arrived within three intervals. */
  isLive(): boolean {
    return this.connected && this.last !== null && this.opts.now() - this.lastAt < this.opts.snapshotIntervalMs * 3;
  }

  serverStatus(): ServerStatus {
    if (this.isLive()) return 'online';
    if (this.gamePortOpen === true) return 'telemetry-unavailable';
    if (this.gamePortOpen === false) return 'offline';
    return 'starting';
  }

  ingest(snap: Snapshot): void {
    if (!snap || snap.type !== 'snapshot' || !Array.isArray(snap.rides) || !Array.isArray(snap.players)) {
      throw new Error('invalid snapshot');
    }
    const now = this.opts.now();
    const ticks = snap.date?.ticksElapsed ?? null;

    // Simulation state is derived from tick progress, not from flags: OpenRCT2's
    // "pause when empty" does not set context.paused.
    if (ticks !== null && this.prevTicks !== null) {
      this.simState = ticks !== this.prevTicks ? 'running' : 'paused';
    } else if (snap.sim?.paused) {
      this.simState = 'paused';
    } else {
      this.simState = snap.sim?.onlineCount > 0 ? 'running' : 'paused';
    }
    if (snap.sim?.paused) this.simState = 'paused';
    this.prevTicks = ticks;

    transaction(this.db, () => {
      this.upsertPlayers(snap, now);
      this.upsertRides(snap, now);
      const ranSinceLastSample = ticks === null || this.lastSampleTicks === null || ticks !== this.lastSampleTicks;
      if (now - this.lastSampleAt >= this.opts.sampleIntervalSec * 1000 && ranSinceLastSample && this.simState !== 'paused') {
        this.recordSample(snap, now);
        this.lastSampleAt = now;
        this.lastSampleTicks = ticks;
        setMeta(this.db, 'last_sample_at', String(now));
      }
      setMeta(this.db, 'last_snapshot', JSON.stringify(snap));
      setMeta(this.db, 'last_snapshot_at', String(now));
    });
    this.last = snap;
    this.lastAt = now;
    this.emit();
  }

  private upsertPlayers(snap: Snapshot, now: number): void {
    const upsertOnline = this.db.prepare(`
      INSERT INTO players(hash, pid, name, first_seen, last_seen, group_name, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hash) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen,
        group_name = excluded.group_name, is_admin = excluded.is_admin`);
    for (const p of snap.players) {
      if (!p.hash) continue;
      upsertOnline.run(p.hash, publicId(p.hash), p.name, now, now, p.group, p.isAdmin ? 1 : 0);
    }
    // Economy profiles also cover players who are offline right now.
    const ensure = this.db.prepare(`
      INSERT INTO players(hash, pid, name, first_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT(hash) DO NOTHING`);
    const setBalance = this.db.prepare('UPDATE players SET balance = ?, money_spent = ? WHERE hash = ?');
    if (snap.economy) {
      for (const [hash, e] of Object.entries(snap.economy.players)) {
        if (!hash) continue; // the server host player has no key
        ensure.run(hash, publicId(hash), e.name || 'Unknown player', now);
        setBalance.run(e.balance, e.moneySpent, hash);
      }
    }
    for (const r of snap.rides) {
      if (r.owner && r.owner !== RELEASED) {
        const name = snap.economy?.players[r.owner]?.name ?? 'Unknown player';
        ensure.run(r.owner, publicId(r.owner), name, now);
      }
    }
  }

  private upsertRides(snap: Snapshot, now: number): void {
    const upsert = this.db.prepare(`
      INSERT INTO rides(uid, ride_id, owner_hash, released, name, classification, first_seen, last_seen,
                        deleted_at, total_profit, total_customers, excitement, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET owner_hash = excluded.owner_hash, released = excluded.released,
        name = excluded.name, classification = excluded.classification, last_seen = excluded.last_seen,
        deleted_at = NULL, total_profit = excluded.total_profit, total_customers = excluded.total_customers,
        excitement = excluded.excitement, data = excluded.data`);
    const present = new Set<string>();
    for (const r of snap.rides) {
      const uid = rideUid(r);
      present.add(uid);
      const released = r.owner === RELEASED;
      upsert.run(uid, r.id, released ? null : r.owner, released ? 1 : 0, r.name, r.classification, now, now,
        r.totalProfit ?? 0, r.totalCustomers ?? 0, r.excitement, JSON.stringify(r));
    }
    // Rides that are gone were demolished (or the park was swapped). Keep them, marked deleted,
    // so lifetime totals and owner information are preserved.
    const alive = this.db.prepare('SELECT uid FROM rides WHERE deleted_at IS NULL').all() as { uid: string }[];
    const markDeleted = this.db.prepare('UPDATE rides SET deleted_at = ? WHERE uid = ?');
    for (const { uid } of alive) {
      if (!present.has(uid)) markDeleted.run(now, uid);
    }
  }

  private recordSample(snap: Snapshot, now: number): void {
    const insert = this.db.prepare('INSERT OR REPLACE INTO samples(ts, hash, money, attractions, profit, guests) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of this.playerAggregates()) {
      // Only players that own something or have an economy profile are worth charting.
      if (p.attractions === 0 && p.money === null && p.totalProfit === 0) continue;
      insert.run(now, p.hash, p.money, p.attractions, p.totalProfit, p.guestsEntertained);
    }
    const aliveCount = (this.db.prepare('SELECT COUNT(*) AS n FROM rides WHERE deleted_at IS NULL').get() as { n: number }).n;
    this.db.prepare('INSERT OR REPLACE INTO park_samples(ts, guests, rating, online, attractions, ticks) VALUES (?, ?, ?, ?, ?, ?)')
      .run(now, snap.park?.guests ?? null, snap.park?.rating ?? null, snap.players.length, aliveCount, snap.date?.ticksElapsed ?? null);
  }

  // ------------------------------------------------------------------ views

  private onlineHashes(): Set<string> {
    if (!this.isLive() || !this.last) return new Set();
    return new Set(this.last.players.map((p) => p.hash));
  }

  playerAggregates() {
    const players = this.db.prepare('SELECT * FROM players').all() as unknown as PlayerRow[];
    const rides = this.db.prepare('SELECT * FROM rides WHERE owner_hash IS NOT NULL').all() as unknown as RideRow[];
    const online = this.onlineHashes();
    const economyOn = !!this.last?.economy;
    const byOwner = new Map<string, RideRow[]>();
    for (const r of rides) {
      const list = byOwner.get(r.owner_hash!) ?? [];
      list.push(r);
      byOwner.set(r.owner_hash!, list);
    }
    return players.map((p) => {
      const owned = byOwner.get(p.hash) ?? [];
      const alive = owned.filter((r) => r.deleted_at === null);
      let best: RideRow | null = null;
      for (const r of alive) {
        if (r.excitement === null) continue;
        if (!best || r.excitement > (best.excitement ?? -1) || (r.excitement === best.excitement && r.total_profit > best.total_profit)) best = r;
      }
      return {
        hash: p.hash,
        id: p.pid,
        name: p.name,
        online: online.has(p.hash),
        isAdmin: !!p.is_admin,
        group: p.group_name,
        money: economyOn ? p.balance : null,
        attractions: alive.length,
        demolished: owned.length - alive.length,
        // Lifetime totals of everything the player built, including demolished attractions (last known values).
        totalProfit: owned.reduce((s, r) => s + r.total_profit, 0),
        guestsEntertained: owned.reduce((s, r) => s + r.total_customers, 0),
        bestAttraction: best ? { id: best.uid, name: best.name, excitement: best.excitement } : null,
        firstSeen: p.first_seen,
        lastSeen: online.has(p.hash) ? this.lastAt : p.last_seen,
      };
    });
  }

  private rideView(r: RideRow, names: Map<string, { name: string; id: string }>) {
    const d = JSON.parse(r.data) as SnapshotRide;
    const owner = r.owner_hash ? names.get(r.owner_hash) : undefined;
    return {
      uid: r.uid,
      rideId: r.ride_id,
      name: r.name,
      owner: r.released ? { kind: 'released' as const } : owner ? { kind: 'player' as const, id: owner.id, name: owner.name } : { kind: 'park' as const },
      classification: d.classification,
      objectName: d.objectName,
      excitement: d.excitement,
      intensity: d.intensity,
      nausea: d.nausea,
      totalProfit: d.totalProfit,
      profitPerHour: d.profitPerHour,
      totalCustomers: d.totalCustomers,
      guestsOnRide: d.guestsOnRide,
      status: r.deleted_at ? 'demolished' : d.crashed ? 'crashed' : d.brokenDown ? 'broken' : d.status,
      age: d.age,
      price: d.price,
      deletedAt: r.deleted_at,
    };
  }

  private nameIndex(): Map<string, { name: string; id: string }> {
    const rows = this.db.prepare('SELECT hash, pid, name FROM players').all() as { hash: string; pid: string; name: string }[];
    return new Map(rows.map((r) => [r.hash, { name: r.name, id: r.pid }]));
  }

  rides(includeDeleted = false) {
    const sql = includeDeleted ? 'SELECT * FROM rides' : 'SELECT * FROM rides WHERE deleted_at IS NULL';
    const rows = this.db.prepare(sql).all() as unknown as RideRow[];
    const names = this.nameIndex();
    return rows.map((r) => this.rideView(r, names));
  }

  overview() {
    const s = this.last;
    const known = (this.db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }).n;
    const attractions = (this.db.prepare('SELECT COUNT(*) AS n FROM rides WHERE deleted_at IS NULL').get() as { n: number }).n;
    const live = this.isLive();
    return {
      serverStatus: this.serverStatus(),
      telemetry: {
        live,
        connected: this.connected,
        lastUpdate: this.lastAt || null,
        ageSeconds: this.lastAt ? Math.round((this.opts.now() - this.lastAt) / 1000) : null,
        plugin: s?.plugin ?? null,
      },
      simState: live ? this.simState : 'unknown',
      gameDate: s ? formatGameDate(s.date) : null,
      parkName: s?.park?.name ?? null,
      onlineCount: live && s ? s.players.length : 0,
      knownPlayers: known,
      attractions,
      guests: s?.park?.guests ?? null,
      parkRating: s?.park?.rating ?? null,
      ffa: s?.ffa ?? null,
    };
  }

  /** Full public state (also pushed over SSE). Never contains key hashes. */
  state() {
    const players = this.playerAggregates().map(({ hash: _hash, ...rest }) => rest);
    return { overview: this.overview(), players, rides: this.rides(false) };
  }

  playerDetail(pid: string) {
    const row = this.db.prepare('SELECT hash FROM players WHERE pid = ?').get(pid) as { hash: string } | undefined;
    if (!row) return null;
    const agg = this.playerAggregates().find((p) => p.hash === row.hash)!;
    const names = this.nameIndex();
    const rides = (this.db.prepare('SELECT * FROM rides WHERE owner_hash = ?').all(row.hash) as unknown as RideRow[])
      .map((r) => this.rideView(r, names));
    const history = this.db.prepare('SELECT ts, money, attractions, profit, guests FROM samples WHERE hash = ? ORDER BY ts').all(row.hash);
    const { hash: _hash, ...player } = agg;
    return { player, rides, history };
  }

  history(sinceMs: number) {
    const rows = this.db.prepare(`
      SELECT s.ts, p.pid, s.money, s.attractions, s.profit, s.guests
      FROM samples s JOIN players p ON p.hash = s.hash WHERE s.ts >= ? ORDER BY s.ts`).all(sinceMs) as
      { ts: number; pid: string; money: number | null; attractions: number; profit: number; guests: number }[];
    const series: Record<string, [number, number | null, number, number, number][]> = {};
    for (const r of rows) (series[r.pid] ??= []).push([r.ts, r.money, r.attractions, r.profit, r.guests]);
    const park = this.db.prepare('SELECT ts, guests, rating, online, attractions FROM park_samples WHERE ts >= ? ORDER BY ts').all(sinceMs);
    return { fields: ['ts', 'money', 'attractions', 'profit', 'guests'], series, park };
  }
}
