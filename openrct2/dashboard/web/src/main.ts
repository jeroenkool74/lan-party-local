import './style.css';
import { lineChart, type Series } from './chart.ts';
import { h } from './dom.ts';
import { ago, money, num, rating, setCurrency } from './format.ts';
import type { History, Player, PlayerDetail, PublicConfig, Ride, State } from './types.ts';

// Validated categorical slots for the dark chart surface (#17211d), fixed order.
const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const NEUTRAL = '#898781';
const MAX_CHART_SERIES = 5;

type SortKey = 'money' | 'attractions' | 'totalProfit' | 'guestsEntertained';
type RideSort = 'excitement' | 'intensity' | 'nausea' | 'totalProfit' | 'totalCustomers' | 'name' | 'owner';

const app = document.getElementById('app')!;
const ui = {
  state: null as State | null,
  config: { title: 'LAN Tycoon', currencySymbol: '€', snapshotIntervalMs: 10000 } as PublicConfig,
  history: null as History | null,
  historyAt: 0,
  connection: 'connecting' as 'connecting' | 'live' | 'lost',
  boardSort: 'money' as SortKey,
  chartMetric: 'money' as 'money' | 'attractions' | 'profit',
  chartHours: 12,
  rideSort: 'excitement' as RideSort,
  rideDesc: true,
  rideFilter: 'all' as 'all' | 'ride' | 'stall',
  detail: null as PlayerDetail | null,
  detailId: '',
  detailAt: 0,
};

// ------------------------------------------------------------------ helpers

function colorIndex(players: Player[]): Map<string, string> {
  // Colour follows the player (by first appearance), never their rank.
  const sorted = [...players].sort((a, b) => a.firstSeen - b.firstSeen || a.id.localeCompare(b.id));
  return new Map(sorted.map((p, i) => [p.id, SERIES_COLORS[i] ?? NEUTRAL]));
}

function economyOn(): boolean {
  return !!ui.state?.overview.ffa?.economy;
}

function playerLink(id: string, name: string): HTMLElement {
  return h('a', { href: `#/player/${id}`, class: 'player-link' }, name);
}

function ownerCell(r: Ride): Node {
  if (r.owner.kind === 'player') return playerLink(r.owner.id, r.owner.name);
  return h('span', { class: 'muted' }, r.owner.kind === 'released' ? 'Released' : 'Park');
}

const STATUS_META: Record<string, { label: string; icon: string; cls: string }> = {
  open: { label: 'Open', icon: '●', cls: 'good' },
  testing: { label: 'Testing', icon: '◐', cls: 'warning' },
  simulating: { label: 'Simulating', icon: '◐', cls: 'warning' },
  closed: { label: 'Closed', icon: '○', cls: 'muted' },
  broken: { label: 'Broken down', icon: '▲', cls: 'serious' },
  crashed: { label: 'Crashed', icon: '✖', cls: 'critical' },
  demolished: { label: 'Demolished', icon: '–', cls: 'muted' },
};
function statusBadge(status: string | null): HTMLElement {
  const m = STATUS_META[status ?? ''] ?? { label: status ?? 'Unknown', icon: '?', cls: 'muted' };
  return h('span', { class: `status ${m.cls}` }, h('span', { 'aria-hidden': 'true' }, m.icon), m.label);
}

function presence(p: Player): HTMLElement {
  const live = ui.state?.overview.telemetry.live;
  if (p.online) return h('span', { class: 'presence online' }, h('span', { class: 'dot' }), 'Online');
  return h('span', { class: 'presence offline', title: live ? '' : 'No live telemetry' }, h('span', { class: 'dot' }), 'Offline');
}

// ------------------------------------------------------------------ header & banner

function header(): HTMLElement {
  const o = ui.state?.overview;
  const status = o?.serverStatus ?? 'starting';
  const statusText = { online: 'Server online', 'telemetry-unavailable': 'Server up · no statistics', offline: 'Server offline', starting: 'Connecting…' }[status];
  const sim = o?.simState ?? 'unknown';
  const simText = { running: 'Simulation running', paused: o && o.onlineCount === 0 ? 'Paused · nobody online' : 'Paused', unknown: 'Simulation unknown' }[sim];
  const route = location.hash || '#/';
  return h('header', { class: 'top' },
    h('a', { class: 'brand', href: '#/' },
      h('span', { class: 'logo', 'aria-hidden': 'true' }, '🎢'),
      h('span', null, h('strong', null, ui.config.title), o?.parkName ? h('small', null, o.parkName) : null)),
    h('nav', null,
      h('a', { href: '#/', class: route === '#/' ? 'active' : '' }, 'Overview'),
      h('a', { href: '#/attractions', class: route.startsWith('#/attractions') ? 'active' : '' }, 'Attractions')),
    h('div', { class: 'pills' },
      h('span', { class: `pill ${status}` }, h('span', { class: 'dot' }), statusText),
      h('span', { class: `pill sim-${sim}` }, sim === 'paused' ? '⏸ ' : sim === 'running' ? '▶ ' : '', simText),
      ui.connection === 'lost' ? h('span', { class: 'pill offline' }, 'Dashboard reconnecting…') : null));
}

function banner(): HTMLElement | null {
  const o = ui.state?.overview;
  if (!o) return h('div', { class: 'banner info' }, 'Loading statistics…');
  const when = o.telemetry.lastUpdate ? `last update ${ago(o.telemetry.lastUpdate)}` : 'no statistics received yet';
  if (o.serverStatus === 'offline') return h('div', { class: 'banner critical' }, `The game server is offline. Showing the last known statistics (${when}).`);
  if (o.serverStatus === 'telemetry-unavailable') return h('div', { class: 'banner warning' }, `The game server is running, but statistics are not arriving. Showing the last known values (${when}).`);
  if (o.serverStatus === 'starting') return h('div', { class: 'banner info' }, `Waiting for the game server… (${when})`);
  if (o.simState === 'paused' && o.onlineCount === 0) return h('div', { class: 'banner paused' }, 'The park is paused because nobody is connected. Numbers are frozen until someone joins.');
  return null;
}

function statCard(label: string, value: string, sub?: string, extra = ''): HTMLElement {
  return h('div', { class: `card stat ${extra}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), sub ? h('div', { class: 'stat-sub' }, sub) : null);
}

function statCards(): HTMLElement {
  const o = ui.state!.overview;
  const live = o.telemetry.live;
  return h('section', { class: 'stats' },
    statCard('Players online', live ? String(o.onlineCount) : '—', `${o.knownPlayers} known players`, 'hero'),
    statCard('Attractions', num(o.attractions), 'in the park'),
    statCard('Park guests', num(o.guests), live ? 'right now' : 'last known'),
    statCard('In-game date', o.gameDate ?? '—', o.simState === 'paused' ? 'paused' : o.simState === 'running' ? 'running' : 'unknown'),
    statCard('Last update', o.telemetry.lastUpdate ? ago(o.telemetry.lastUpdate) : 'never',
      o.telemetry.lastUpdate ? new Date(o.telemetry.lastUpdate).toLocaleTimeString() : 'waiting for the server'));
}

// ------------------------------------------------------------------ leaderboard (FLIP animated)

const rowCache = new Map<string, HTMLTableRowElement>();
const lastValues = new Map<string, string>();

function sortPlayers(players: Player[], key: SortKey): Player[] {
  const v = (p: Player) => (key === 'money' ? p.money ?? Number.NEGATIVE_INFINITY : p[key]);
  return [...players].sort((a, b) => v(b) - v(a) || b.totalProfit - a.totalProfit || a.name.localeCompare(b.name));
}

function leaderboard(): HTMLElement {
  const players = ui.state!.players.filter((p) => p.attractions + p.demolished > 0 || p.money !== null || p.lastSeen);
  if (!economyOn() && ui.boardSort === 'money') ui.boardSort = 'totalProfit';
  const sorted = sortPlayers(players, ui.boardSort);
  const sortBtn = (key: SortKey, label: string) =>
    h('button', { class: ui.boardSort === key ? 'chip active' : 'chip', 'aria-pressed': String(ui.boardSort === key), onclick: () => { ui.boardSort = key; render(); } }, label);

  const card = h('section', { class: 'card board' },
    h('div', { class: 'card-head' }, h('h2', null, 'Leaderboard'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Rank by' },
        economyOn() ? sortBtn('money', 'Money') : null, sortBtn('totalProfit', 'Profit'), sortBtn('attractions', 'Attractions'), sortBtn('guestsEntertained', 'Guests'))));
  if (sorted.length === 0) {
    card.append(h('p', { class: 'empty' }, 'No players yet. Join the server and build something!'));
    return card;
  }
  const tbody = h('tbody');
  const table = h('div', { class: 'table-wrap' }, h('table', { class: 'data-table leaderboard' },
    h('thead', null, h('tr', null,
      h('th', { class: 'rank' }, '#'), h('th', null, 'Player'), h('th', null, 'Status'),
      h('th', { class: 'num' }, 'Money'), h('th', { class: 'num' }, 'Attractions'), h('th', { class: 'num', title: 'Lifetime profit of all attractions the player built, including demolished ones' }, 'Total profit'),
      h('th', { class: 'num', title: 'Total customers of their attractions' }, 'Guests entertained'), h('th', null, 'Best attraction'), h('th', null, 'Last seen'))),
    tbody));
  card.append(table);

  // FLIP: remember old row positions
  const before = new Map<string, number>();
  for (const [id, row] of rowCache) if (row.isConnected) before.set(id, row.getBoundingClientRect().top);

  const next = new Map<string, HTMLTableRowElement>();
  sorted.forEach((p, i) => {
    const row = rowCache.get(p.id) ?? h('tr');
    row.replaceChildren(
      h('td', { class: 'rank' }, h('span', { class: `medal m${i + 1}` }, String(i + 1))),
      h('td', null, playerLink(p.id, p.name), p.isAdmin ? h('span', { class: 'tag' }, 'admin') : null),
      h('td', null, presence(p)),
      valueCell(`${p.id}:money`, money(p.money)),
      valueCell(`${p.id}:attr`, num(p.attractions)),
      valueCell(`${p.id}:profit`, money(p.totalProfit)),
      valueCell(`${p.id}:guests`, num(p.guestsEntertained)),
      h('td', null, p.bestAttraction ? h('span', null, p.bestAttraction.name, h('small', { class: 'muted' }, ` ${rating(p.bestAttraction.excitement)}`)) : h('span', { class: 'muted' }, '—')),
      h('td', { class: 'muted' }, p.online ? 'now' : ago(p.lastSeen)));
    row.className = p.online ? 'is-online' : '';
    tbody.append(row);
    next.set(p.id, row);
  });
  rowCache.clear();
  for (const [k, v] of next) rowCache.set(k, v);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) requestAnimationFrame(() => {
    for (const [id, row] of next) {
      const old = before.get(id);
      if (old === undefined) continue;
      const delta = old - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 2) continue;
      row.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  });
  return card;
}

function valueCell(key: string, text: string): HTMLElement {
  const td = h('td', { class: 'num' }, text);
  const prev = lastValues.get(key);
  if (prev !== undefined && prev !== text) td.classList.add('changed');
  lastValues.set(key, text);
  return td;
}

// ------------------------------------------------------------------ top attractions + history

function topAttractions(): HTMLElement {
  const rides = ui.state!.rides.filter((r) => r.classification === 'ride' && r.excitement !== null)
    .sort((a, b) => (b.excitement ?? 0) - (a.excitement ?? 0)).slice(0, 6);
  return h('section', { class: 'card top-rides' },
    h('div', { class: 'card-head' }, h('h2', null, 'Most exciting rides'), h('a', { href: '#/attractions', class: 'more' }, 'All attractions →')),
    rides.length === 0 ? h('p', { class: 'empty' }, 'No rated rides yet. Rides get ratings after their first test run.') :
      h('ol', { class: 'ride-list' }, ...rides.map((r) => h('li', null,
        h('div', { class: 'ride-main' }, h('strong', null, r.name), h('span', { class: 'muted' }, ' by '), ownerCell(r)),
        h('div', { class: 'ride-ratings' },
          h('span', { title: 'Excitement' }, h('em', null, 'E'), rating(r.excitement)),
          h('span', { title: 'Intensity' }, h('em', null, 'I'), rating(r.intensity)),
          h('span', { title: 'Nausea' }, h('em', null, 'N'), rating(r.nausea)),
          h('span', { title: 'Total profit' }, money(r.totalProfit, { compact: true })))))));
}

async function loadHistory(force = false): Promise<void> {
  if (!force && Date.now() - ui.historyAt < 60_000) return;
  ui.historyAt = Date.now();
  try {
    ui.history = await (await fetch(`/api/history?hours=${ui.chartHours}`)).json();
    if (currentRoute().view === 'overview') renderHistorySection();
  } catch { /* keep the previous chart */ }
}

const historySlot = h('div');
function renderHistorySection(): void {
  if (!ui.state) return;
  const players = ui.state.players;
  const colors = colorIndex(players);
  const fieldIdx = { money: 1, attractions: 2, profit: 3 }[ui.chartMetric];
  const fmt = ui.chartMetric === 'attractions' ? (v: number) => num(v) : (v: number) => money(v, { compact: true });
  const byId = new Map(players.map((p) => [p.id, p]));
  const series: Series[] = Object.entries(ui.history?.series ?? {})
    .filter(([id]) => byId.has(id))
    .map(([id, pts]) => ({ key: id, label: byId.get(id)!.name, color: colors.get(id) ?? NEUTRAL, points: pts.map((p) => [p[0], p[fieldIdx] as number | null] as [number, number | null]) }))
    .filter((s) => s.points.some((p) => p[1] !== null));
  const latest = (s: Series) => [...s.points].reverse().find((p) => p[1] !== null)?.[1] ?? 0;
  series.sort((a, b) => latest(b) - latest(a));
  const shown = series.slice(0, MAX_CHART_SERIES);
  const title = { money: 'Money over time', attractions: 'Attractions over time', profit: 'Total attraction profit over time' }[ui.chartMetric];
  const chip = (m: typeof ui.chartMetric, label: string) => h('button', { class: ui.chartMetric === m ? 'chip active' : 'chip', 'aria-pressed': String(ui.chartMetric === m), onclick: () => { ui.chartMetric = m; renderHistorySection(); } }, label);
  const range = (hrs: number, label: string) => h('button', { class: ui.chartHours === hrs ? 'chip active' : 'chip', 'aria-pressed': String(ui.chartHours === hrs), onclick: () => { ui.chartHours = hrs; void loadHistory(true); renderHistorySection(); } }, label);
  historySlot.replaceChildren(
    h('div', { class: 'filters' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Time range' }, range(3, 'Last 3 h'), range(12, 'Last 12 h'), range(48, '2 days'), range(24 * 7, 'Week')),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Metric' }, economyOn() ? chip('money', 'Money') : null, chip('attractions', 'Attractions'), chip('profit', 'Profit'))),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, title), series.length > MAX_CHART_SERIES ? h('span', { class: 'muted' }, `top ${MAX_CHART_SERIES} of ${series.length} players`) : null),
      lineChart(shown, { format: fmt, height: 260 })));
}

// ------------------------------------------------------------------ views

function overviewView(): Node[] {
  if (ui.chartMetric === 'money' && !economyOn()) ui.chartMetric = 'profit';
  // The chart only redraws when history is refetched, so hovering is not interrupted by live pushes.
  if (!historySlot.hasChildNodes()) renderHistorySection();
  void loadHistory();
  return [statCards(), h('div', { class: 'grid-main' }, leaderboard(), topAttractions()), historySlot];
}

function rideTable(rides: Ride[], opts: { sortable: boolean; showOwner: boolean }): HTMLElement {
  const cols: { key: RideSort | null; label: string; num?: boolean }[] = [
    { key: 'name', label: 'Attraction' }, ...(opts.showOwner ? [{ key: 'owner' as RideSort, label: 'Owner' }] : []),
    { key: 'excitement', label: 'Excitement', num: true }, { key: 'intensity', label: 'Intensity', num: true },
    { key: 'nausea', label: 'Nausea', num: true }, { key: 'totalProfit', label: 'Total profit', num: true },
    { key: 'totalCustomers', label: 'Guests', num: true }, { key: null, label: 'Status' },
  ];
  const head = h('tr', null, ...cols.map((c) => {
    if (!opts.sortable || !c.key) return h('th', { class: c.num ? 'num' : '' }, c.label);
    const active = ui.rideSort === c.key;
    return h('th', { class: c.num ? 'num' : '', 'aria-sort': active ? (ui.rideDesc ? 'descending' : 'ascending') : 'none' },
      h('button', { class: `sort ${active ? 'active' : ''}`, onclick: () => {
        if (ui.rideSort === c.key) ui.rideDesc = !ui.rideDesc; else { ui.rideSort = c.key!; ui.rideDesc = c.key !== 'name' && c.key !== 'owner'; }
        render();
      } }, c.label, active ? (ui.rideDesc ? ' ▾' : ' ▴') : ''));
  }));
  const body = h('tbody', null, ...rides.map((r) => h('tr', { class: r.deletedAt ? 'is-deleted' : '' },
    h('td', null, h('strong', null, r.name), r.objectName && r.objectName !== r.name ? h('small', { class: 'muted block' }, r.objectName) : null),
    opts.showOwner ? h('td', null, ownerCell(r)) : null,
    h('td', { class: 'num' }, rating(r.excitement)), h('td', { class: 'num' }, rating(r.intensity)), h('td', { class: 'num' }, rating(r.nausea)),
    h('td', { class: 'num' }, money(r.totalProfit)), h('td', { class: 'num' }, num(r.totalCustomers)),
    h('td', null, statusBadge(r.status)))));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'data-table rides' }, h('thead', null, head), body));
}

function sortRides(rides: Ride[]): Ride[] {
  const k = ui.rideSort;
  const val = (r: Ride): number | string => (k === 'name' ? r.name.toLowerCase() : k === 'owner' ? (r.owner.kind === 'player' ? r.owner.name.toLowerCase() : '~') : (r[k] ?? -Infinity));
  return [...rides].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = x < y ? -1 : x > y ? 1 : 0;
    return ui.rideDesc ? -c : c;
  });
}

function attractionsView(): Node[] {
  const filtered = ui.state!.rides.filter((r) => ui.rideFilter === 'all' || (ui.rideFilter === 'ride' ? r.classification === 'ride' : r.classification !== 'ride'));
  const chip = (f: typeof ui.rideFilter, label: string) => h('button', { class: ui.rideFilter === f ? 'chip active' : 'chip', 'aria-pressed': String(ui.rideFilter === f), onclick: () => { ui.rideFilter = f; render(); } }, label);
  return [
    h('div', { class: 'filters' }, h('div', { class: 'chips', role: 'group', 'aria-label': 'Type' }, chip('all', 'All'), chip('ride', 'Rides'), chip('stall', 'Shops & facilities'))),
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Attractions'), h('span', { class: 'muted' }, `${filtered.length} in the park · click a column to sort`)),
      filtered.length ? rideTable(sortRides(filtered), { sortable: true, showOwner: true }) : h('p', { class: 'empty' }, 'No attractions yet.')),
    h('p', { class: 'footnote' }, 'Ratings are shown after a ride has been tested. Profit is the lifetime profit reported by OpenRCT2; guests is the total number of customers served.'),
  ];
}

async function loadDetail(id: string): Promise<void> {
  try {
    const res = await fetch(`/api/players/${id}`);
    ui.detail = res.ok ? await res.json() : null;
  } catch { /* keep previous */ }
  ui.detailId = id;
  ui.detailAt = Date.now();
  render();
}

function playerView(id: string): Node[] {
  if (ui.detailId !== id) { ui.detail = null; void loadDetail(id); return [h('p', { class: 'empty' }, 'Loading player…')]; }
  const d = ui.detail;
  if (!d) return [h('p', { class: 'empty' }, 'Unknown player.'), h('a', { href: '#/' }, '← Back to the overview')];
  // live values come from the pushed state; history from the detail request
  const p = ui.state?.players.find((x) => x.id === id) ?? d.player;
  const alive = sortRides(d.rides.filter((r) => !r.deletedAt));
  const gone = d.rides.filter((r) => r.deletedAt);
  const best = [...alive].filter((r) => r.excitement !== null).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 3);
  const pts = (f: 'money' | 'attractions' | 'profit') => d.history.map((x) => [x.ts, x[f]] as [number, number | null]);
  const color = colorIndex(ui.state?.players ?? [d.player]).get(id) ?? SERIES_COLORS[0];
  const mini = (title: string, f: 'money' | 'attractions' | 'profit') =>
    h('section', { class: 'card' }, h('h3', null, title),
      lineChart([{ key: f, label: title, color, points: pts(f) }], { format: f === 'attractions' ? (v) => num(v) : (v) => money(v, { compact: true }), height: 180 }));
  return [
    h('a', { href: '#/', class: 'back' }, '← Overview'),
    h('div', { class: 'player-head' }, h('h1', null, p.name), presence(p), p.isAdmin ? h('span', { class: 'tag' }, 'admin') : null,
      h('span', { class: 'muted' }, p.online ? 'online now' : `last seen ${ago(p.lastSeen)}`)),
    h('section', { class: 'stats' },
      statCard('Money', money(p.money), economyOn() ? 'individual balance' : 'economy plugin not active', 'hero'),
      statCard('Attractions', num(p.attractions), p.demolished ? `${p.demolished} demolished` : 'owned now'),
      statCard('Total profit', money(p.totalProfit), 'all attractions, lifetime'),
      statCard('Guests entertained', num(p.guestsEntertained), 'customers served'),
      statCard('Best attraction', p.bestAttraction?.name ?? '—', p.bestAttraction ? `excitement ${rating(p.bestAttraction.excitement)}` : 'no rated ride yet')),
    best.length ? h('section', { class: 'card' }, h('h2', null, 'Best performing attractions'), rideTable(best, { sortable: false, showOwner: false })) : null,
    h('div', { class: 'grid-3' }, economyOn() ? mini('Money', 'money') : null, mini('Attractions', 'attractions'), mini('Total profit', 'profit')),
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Owned attractions'), h('span', { class: 'muted' }, `${alive.length}`)),
      alive.length ? rideTable(alive, { sortable: true, showOwner: false }) : h('p', { class: 'empty' }, 'No attractions right now.')),
    gone.length ? h('details', { class: 'card' }, h('summary', null, `Demolished attractions (${gone.length})`), rideTable(gone, { sortable: false, showOwner: false })) : null,
  ].filter(Boolean) as Node[];
}

// ------------------------------------------------------------------ routing & rendering

function currentRoute(): { view: 'overview' | 'attractions' | 'player'; id?: string } {
  const hash = location.hash || '#/';
  const m = /^#\/player\/([0-9a-f]{16})$/.exec(hash);
  if (m) return { view: 'player', id: m[1] };
  if (hash.startsWith('#/attractions')) return { view: 'attractions' };
  return { view: 'overview' };
}

let renderedRoute = '';
function render(): void {
  const route = currentRoute();
  const main = h('main');
  const b = banner();
  if (ui.state) {
    const views = route.view === 'player' ? playerView(route.id!) : route.view === 'attractions' ? attractionsView() : overviewView();
    main.append(...views);
  }
  const keepScroll = renderedRoute === location.hash;
  const y = window.scrollY;
  app.replaceChildren(header(), b ?? '', main, h('footer', null,
    'Read-only statistics from the OpenRCT2 server · updates every ', String(Math.round(ui.config.snapshotIntervalMs / 1000)), ' s'));
  if (keepScroll) window.scrollTo(0, y);
  renderedRoute = location.hash;
}

function applyState(state: State): void {
  ui.state = state;
  const route = currentRoute();
  if (route.view === 'player' && ui.detailId === route.id && Date.now() - ui.detailAt > 60_000) void loadDetail(route.id!);
  render();
}

function connect(): void {
  if (!('EventSource' in window)) { poll(); return; }
  const es = new EventSource('/api/events');
  es.addEventListener('state', (e) => { ui.connection = 'live'; applyState(JSON.parse((e as MessageEvent).data)); });
  es.onerror = () => { ui.connection = 'lost'; render(); };
}

async function poll(): Promise<void> {
  try { applyState(await (await fetch('/api/state')).json()); ui.connection = 'live'; } catch { ui.connection = 'lost'; }
  setTimeout(poll, ui.config.snapshotIntervalMs);
}

window.addEventListener('hashchange', () => { if (currentRoute().view !== 'player') ui.detailId = ''; render(); window.scrollTo(0, 0); });

(async () => {
  try {
    ui.config = await (await fetch('/api/config')).json();
  } catch { /* defaults */ }
  setCurrency(ui.config.currencySymbol);
  document.title = ui.config.title;
  render();
  connect();
})();
