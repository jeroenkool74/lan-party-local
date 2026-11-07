import { h, s } from './dom.ts';
import { clock, dateTime } from './format.ts';

/**
 * Multi-series SVG line chart (time on x, one y axis starting at a nice bound).
 * Follows the dashboard's chart spec: 2px lines, hairline grid, legend for >= 2
 * series, end-dots, crosshair + one tooltip for all series, gaps when the
 * simulation was paused, and a table view.
 */
export interface Series {
  key: string;
  label: string;
  color: string;
  points: [number, number | null][]; // [timestamp ms, value]
}

export interface ChartOptions {
  format: (v: number) => string;
  formatTick?: (v: number) => string;
  height?: number;
  /** Break a line when consecutive samples are further apart than this (paused server). */
  gapMs?: number;
  emptyText?: string;
}

const PAD = { top: 12, right: 16, bottom: 26, left: 56 };

function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}

export function lineChart(series: Series[], opts: ChartOptions): HTMLElement {
  const height = opts.height ?? 240;
  const gapMs = opts.gapMs ?? 5 * 60_000;
  const root = h('div', { class: 'chart' });
  const all = series.flatMap((s) => s.points.filter((p) => p[1] !== null)) as [number, number][];

  if (series.length > 1) {
    root.append(h('ul', { class: 'legend', 'aria-label': 'Legend' },
      ...series.map((s) => h('li', null, h('span', { class: 'key-line', style: `background:${s.color}` }), s.label))));
  }
  if (all.length === 0) {
    root.append(h('p', { class: 'chart-empty' }, opts.emptyText ?? 'No history yet. Samples are recorded every minute while the park is running.'));
    return root;
  }

  const plot = h('div', { class: 'plot', style: `height:${height}px` });
  const tooltip = h('div', { class: 'tooltip', role: 'status', hidden: true });
  plot.append(tooltip);
  root.append(plot);

  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 60_000; x1 += 60_000; }
  let y0 = Math.min(0, ...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) y1 = y0 + 1;
  const step = niceStep(y1 - y0, 4);
  y0 = Math.floor(y0 / step) * step;
  y1 = Math.ceil(y1 / step) * step;

  const draw = () => {
    plot.querySelector('svg')?.remove();
    const width = Math.max(240, plot.clientWidth);
    const iw = width - PAD.left - PAD.right;
    const ih = height - PAD.top - PAD.bottom;
    const X = (t: number) => PAD.left + ((t - x0) / (x1 - x0)) * iw;
    const Y = (v: number) => PAD.top + ih - ((v - y0) / (y1 - y0)) * ih;
    const svg = s('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' });
    svg.setAttribute('aria-label', `Line chart of ${series.map((s) => s.label).join(', ')}`);

    // y grid + ticks
    for (let v = y0; v <= y1 + step / 2; v += step) {
      const y = Y(v);
      svg.append(s('line', { x1: PAD.left, x2: width - PAD.right, y1: y, y2: y, class: v === 0 ? 'axis' : 'grid' }));
      const t = s('text', { x: PAD.left - 8, y: y + 4, class: 'tick', 'text-anchor': 'end' });
      t.textContent = (opts.formatTick ?? opts.format)(v);
      svg.append(t);
    }
    // x ticks (time)
    const n = Math.max(2, Math.min(6, Math.floor(iw / 110)));
    for (let i = 0; i <= n; i++) {
      const t = x0 + ((x1 - x0) * i) / n;
      const lbl = s('text', { x: X(t), y: height - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === n ? 'end' : 'middle' });
      lbl.textContent = clock(t);
      svg.append(lbl);
    }
    // lines, broken at gaps
    for (const sr of series) {
      let d = '';
      let prev: number | null = null;
      for (const [t, v] of sr.points) {
        if (v === null) { prev = null; continue; }
        d += `${prev === null || t - prev > gapMs ? 'M' : 'L'}${X(t).toFixed(1)},${Y(v).toFixed(1)}`;
        prev = t;
      }
      svg.append(s('path', { d, class: 'series', stroke: sr.color }));
      const last = [...sr.points].reverse().find((p) => p[1] !== null);
      if (last) svg.append(s('circle', { cx: X(last[0]), cy: Y(last[1]!), r: 4, fill: sr.color, class: 'end-dot' }));
    }
    // crosshair layer
    const cross = s('line', { y1: PAD.top, y2: PAD.top + ih, class: 'crosshair', visibility: 'hidden' });
    const hit = s('rect', { x: PAD.left, y: PAD.top, width: iw, height: ih, fill: 'transparent', tabindex: 0 });
    svg.append(cross, hit);
    const times = [...new Set(xs)].sort((a, b) => a - b);
    const showAt = (t: number) => {
      const x = X(t);
      cross.setAttribute('x1', String(x));
      cross.setAttribute('x2', String(x));
      cross.setAttribute('visibility', 'visible');
      tooltip.replaceChildren(h('div', { class: 'tt-time' }, dateTime(t)));
      const rows = series
        .map((sr) => ({ sr, p: [...sr.points].reverse().find((p) => p[0] <= t && p[1] !== null) }))
        .filter((r) => r.p && t - r.p[0] <= gapMs)
        .sort((a, b) => b.p![1]! - a.p![1]!);
      for (const { sr, p } of rows) {
        tooltip.append(h('div', { class: 'tt-row' }, h('span', { class: 'key-line', style: `background:${sr.color}` }),
          h('strong', null, opts.format(p![1]!)), h('span', { class: 'tt-label' }, sr.label)));
      }
      tooltip.hidden = false;
      const left = Math.min(Math.max(x + 12, 0), width - tooltip.offsetWidth - 4);
      tooltip.style.left = `${x > width * 0.6 ? x - tooltip.offsetWidth - 12 : left}px`;
    };
    const nearest = (px: number) => {
      const t = x0 + ((px - PAD.left) / iw) * (x1 - x0);
      let best = times[0];
      for (const c of times) if (Math.abs(c - t) < Math.abs(best - t)) best = c;
      return best;
    };
    let focusIdx = times.length - 1;
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      showAt(nearest(e.clientX - r.left));
    });
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); tooltip.hidden = true; });
    hit.addEventListener('focus', () => showAt(times[focusIdx]));
    hit.addEventListener('blur', () => { cross.setAttribute('visibility', 'hidden'); tooltip.hidden = true; });
    hit.addEventListener('keydown', (e) => {
      const k = (e as KeyboardEvent).key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      focusIdx = Math.min(times.length - 1, Math.max(0, focusIdx + (k === 'ArrowRight' ? 1 : -1)));
      showAt(times[focusIdx]);
      e.preventDefault();
    });
    plot.prepend(svg);
  };

  const ro = new ResizeObserver(() => draw());
  ro.observe(plot);
  queueMicrotask(draw);

  // table view: values stay reachable without hovering
  const times = [...new Set(xs)].sort((a, b) => b - a).slice(0, 60);
  const table = h('table', { class: 'data-table compact' },
    h('thead', null, h('tr', null, h('th', null, 'Time'), ...series.map((s) => h('th', { class: 'num' }, s.label)))),
    h('tbody', null, ...times.map((t) => h('tr', null, h('td', null, dateTime(t)),
      ...series.map((sr) => {
        const p = sr.points.find((q) => q[0] === t);
        return h('td', { class: 'num' }, p && p[1] !== null ? opts.format(p[1]) : '—');
      })))));
  root.append(h('details', { class: 'table-view' }, h('summary', null, 'Show as table'), table));
  return root;
}
