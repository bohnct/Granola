// Minimal SVG time chart (no library). One y-axis; every series shares it.
// series: [{name, points: [{d:'YYYY-MM-DD', v:number}], cls?, color?, step?, muted?, bars?}]
//   cls:   's1' | 's2' fixed styles (cash / futures);  color: a CSS color for picked series
//   muted: grey context line, left out of the legend and the values box
//   band:  [{d, lo, hi}] shaded day range (low to high) behind the line
//   bars:  daily OHLC bars like Barchart; points also carry o, h, l, c (v is the close)
import { h, num } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

const ms = (d) => new Date(`${d}T12:00:00`).getTime();
export const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' });

// "Nice" tick step for a value range.
function step(range, target = 4) {
  const raw = range / target, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
}

// Draw at the card's real width so text stays a readable size on any screen.
const chartWidth = () => Math.max(300, (document.getElementById('view')?.clientWidth ?? 370) - 62);

const landscape = () => window.innerWidth > window.innerHeight && window.innerHeight <= 500;
// Taller on wide screens. On a landscape phone the chart fills the screen between the top and
// bottom bars (scroll down a little and it's all chart).
function chartHeight(height, W) {
  if (landscape()) return Math.max(150, window.innerHeight - 112);
  return Math.round(W > 500 ? height * 1.3 : height);
}

// Charts on screen redraw themselves when the screen is resized or the phone is turned,
// leaving the rest of the page (picked months, open lists, scroll position) as it is.
const live = new Set();
let resizeTimer = null;
let lastSize = '';
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const size = `${window.innerWidth}x${window.innerHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    for (const c of live) {
      if (!c.box.isConnected) live.delete(c);
      else c.box.replaceChildren(c.draw());
    }
  }, 150);
});

export function timeChart(series, opts = {}) {
  lastSize = `${window.innerWidth}x${window.innerHeight}`;
  const box = h('div', { class: 'chart-box' });
  const draw = () => drawChart(series, opts);
  box.append(draw());
  live.add({ box, draw });
  return box;
}

// Full-screen view of one chart. It covers the whole app, the page can't scroll behind it,
// and it redraws to fit when the phone turns. ×, the phone's Back, or Esc closes it.
export function focusChart(title, series, opts = {}) {
  lastSize = `${window.innerWidth}x${window.innerHeight}`;
  const body = h('div', { class: 'focus-body' });
  const close = () => history.back();
  const sheet = h('div', { class: 'focus', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'focus-head' }, h('b', {}, title),
      h('button', { type: 'button', class: 'icon-btn focus-close', 'aria-label': 'Close full screen', onclick: close }, '×')),
    body);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  // An extra history entry, so the phone's Back button closes the view instead of leaving the app.
  history.pushState({ focus: true }, '');
  window.addEventListener('popstate', () => {
    sheet.remove();
    document.documentElement.classList.remove('focused');
    window.removeEventListener('keydown', onKey);
  }, { once: true });
  window.addEventListener('keydown', onKey);
  document.documentElement.classList.add('focused');
  document.body.append(sheet);
  const draw = () => drawChart(series, { ...opts, fit: () => ({ w: body.clientWidth, h: body.clientHeight }) });
  body.append(draw());
  live.add({ box: body, draw });
}

// fit: () => ({w, h}) draws at exactly that size (the full-screen view) instead of the card's.
function drawChart(series, { digits = 2, zero = false, empty = 'Not enough history yet.', height = 200, endLabels = false, extra = null, fit = null } = {}) {
  series = series.map((sr) => ({ ...sr, points: sr.points.filter((p) => p.v != null && Number.isFinite(p.v)),
    band: sr.band?.filter((b) => Number.isFinite(b.lo) && Number.isFinite(b.hi)) }))
    .filter((sr) => sr.points.length);
  const all = series.flatMap((sr) => sr.points);
  const dates = [...new Set(all.map((p) => p.d))].sort();
  if (dates.length < 2) {
    const one = all[0];
    return h('p', { class: 'small muted' }, empty, one ? ` First reading: ${num(one.v, digits)} on ${shortDate(one.d)}.` : '');
  }

  const main = series.filter((sr) => !sr.muted);
  const labelled = endLabels && main.length <= 4;
  const withLegend = main.length > 1 && !endLabels;
  const box = fit?.();
  const W = box ? Math.max(260, box.w) : chartWidth();
  const H = box ? Math.max(120, box.h - (withLegend ? 26 : 0)) : chartHeight(height, W);
  const L = 44, R = labelled ? 62 : 10, T = 10, B = 22;
  const bands = series.flatMap((sr) => sr.band ?? []);
  let min = Math.min(...all.map((p) => p.l ?? p.v), ...bands.map((b) => b.lo));
  let max = Math.max(...all.map((p) => p.h ?? p.v), ...bands.map((b) => b.hi));
  if (zero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { min -= 1; max += 1; }
  const st = step(max - min);
  min = Math.floor(min / st) * st; max = Math.ceil(max / st) * st;
  const t0 = ms(dates[0]), t1 = ms(dates.at(-1));
  const x = (d) => L + ((ms(d) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const tickDigits = st < 1 ? digits : 0;
  const f1 = (v) => v.toFixed(1);

  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': `${main.map((sr) => sr.name).join(', ')} chart` });
  for (let i = 0; min + i * st <= max + st / 2; i++) {
    // Multiply rather than add so rounding can't turn 0 into "-0.00".
    let v = Math.round((min + i * st) / st) * st;
    if (Math.abs(v) < st / 1e6) v = 0;
    svg.append(s('line', { class: v === 0 && zero ? 'grid zero' : 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      s('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, num(v, tickDigits)));
  }
  // Evenly spaced date labels; month + year once the chart spans most of a year.
  const long = t1 - t0 > 300 * 864e5;
  // Day first ("27 Jul") so a date never reads like a delivery month ("JUL'27").
  const tickFmt = (t) => (long
    ? new Date(t).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })
    : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  const nTicks = W > 500 ? 6 : 4;
  for (let i = 0; i < nTicks; i++) {
    const t = t0 + ((t1 - t0) * i) / (nTicks - 1);
    const tx = L + ((t - t0) / (t1 - t0)) * (W - L - R);
    svg.append(s('line', { class: 'tick', x1: tx, x2: tx, y1: H - B, y2: H - B + 4 }),
      s('text', { x: tx, y: H - 6, 'text-anchor': i === 0 ? 'start' : i === nTicks - 1 ? 'end' : 'middle' }, tickFmt(t)));
  }

  const pathOf = (sr) => sr.points.map((pt, i) => {
    if (!i) return `M${f1(x(pt.d))},${f1(y(pt.v))}`;
    return sr.step ? `H${f1(x(pt.d))}V${f1(y(pt.v))}` : `L${f1(x(pt.d))},${f1(y(pt.v))}`;
  }).join('');
  // Shaded day range (low to high) behind a line: along the highs, then back along the lows.
  // A step edge going back drops to the earlier day's low, then runs left to its date.
  const bandOf = (sr) => {
    const b = sr.band;
    const up = b.map((p, i) => (!i ? `M${f1(x(p.d))},${f1(y(p.hi))}`
      : sr.step ? `H${f1(x(p.d))}V${f1(y(p.hi))}` : `L${f1(x(p.d))},${f1(y(p.hi))}`)).join('');
    const down = b.slice().reverse().map((p, i) => (!i ? `L${f1(x(p.d))},${f1(y(p.lo))}`
      : sr.step ? `V${f1(y(p.lo))}H${f1(x(p.d))}` : `L${f1(x(p.d))},${f1(y(p.lo))}`)).join('');
    return `${up}${down}Z`;
  };
  // OHLC bar: low-to-high line, open tick to the left, close tick to the right.
  const gap = Math.min(...dates.slice(1).map((d, i) => x(d) - x(dates[i])));
  const tw = Math.max(1.5, Math.min(5, gap * 0.35));
  const barsOf = (sr) => sr.points.map((pt) => {
    const bx = f1(x(pt.d));
    return `M${bx},${f1(y(pt.h))}V${f1(y(pt.l))}M${f1(x(pt.d) - tw)},${f1(y(pt.o))}H${bx}M${bx},${f1(y(pt.c))}H${f1(x(pt.d) + tw)}`;
  }).join('');
  const paint = (sr) => (sr.color ? `stroke:${sr.color}` : null);

  // Bands first, then grey context, so picked lines sit on top.
  main.filter((sr) => sr.band?.length > 1).forEach((sr) => svg.append(s('path', {
    class: `band ${sr.cls ?? ''}`, style: sr.color ? `fill:${sr.color}` : null, d: bandOf(sr) })));
  series.filter((sr) => sr.muted).forEach((sr) => svg.append(s('path', { class: 'line muted', d: pathOf(sr) })));
  const cross = s('line', { class: 'cross', y1: T, y2: H - B, style: 'display:none' });
  svg.append(cross);
  const dots = main.map((sr) => {
    svg.append(s('path', { class: `${sr.bars ? 'bars' : 'line'} ${sr.cls ?? ''}`, style: paint(sr), d: sr.bars ? barsOf(sr) : pathOf(sr) }));
    const dot = s('circle', { class: `dot ${sr.cls ?? ''}`, r: 4, style: `display:none${sr.color ? `;fill:${sr.color}` : ''}` });
    svg.append(dot);
    return dot;
  });

  // Names at the end of each line, nudged apart so they don't overlap.
  if (labelled) {
    const tags = main.map((sr) => ({ sr, y: y(sr.points.at(-1).v), x: x(sr.points.at(-1).d) })).sort((a, b) => a.y - b.y);
    tags.forEach((t, i) => { if (i && t.y - tags[i - 1].y < 11) t.y = tags[i - 1].y + 11; });
    tags.forEach((t) => svg.append(s('text', { class: 'end-label', x: t.x + 6, y: t.y + 3 }, t.sr.name)));
  }

  const swatch = (sr) => h('i', { class: sr.cls ?? '', style: sr.color ? `border-color:${sr.color}` : null });
  const legend = withLegend
    ? h('div', { class: 'legend' }, main.map((sr) => h('span', {}, swatch(sr), sr.name)))
    : null;

  // Values only show while touching (or hovering) the chart, in a box over the half of the
  // chart away from the finger. Lifting the finger leaves them showing.
  const tip = h('div', { class: 'tip', hidden: true });
  const show = (d) => {
    cross.style.display = '';
    cross.setAttribute('x1', x(d)); cross.setAttribute('x2', x(d));
    const vals = {};
    const items = [];
    main.forEach((sr, i) => {
      // Value in effect on d; a series that hasn't started or has ended shows nothing.
      const p = sr.points.filter((pt) => pt.d <= d).at(-1);
      const live = p && d <= sr.points.at(-1).d;
      dots[i].style.display = live && !sr.bars ? '' : 'none';
      if (!live) return;
      dots[i].setAttribute('cx', x(sr.step ? d : p.d)); dots[i].setAttribute('cy', y(p.v));
      vals[sr.name] = p.v;
      const band = sr.band?.filter((b) => b.d <= d).at(-1);
      items.push({ sr, v: p.v, p: p.d === d ? p : null, band: band && band.hi !== band.lo ? band : null });
    });
    // With many lines, list them top to bottom the way they sit on the chart.
    if (main.length > 2) items.sort((a, b) => b.v - a.v);
    const ohlc = (p) => h('div', { class: 'ohlc' }, ['O', 'H', 'L', 'C'].map((k) => h('span', {}, `${k} `, h('b', {}, num(p[k.toLowerCase()], digits)))));
    const rows = items.map(({ sr, v, p, band }) => (sr.bars && p ? ohlc(p) : h('div', {},
      main.length > 1 ? swatch(sr) : null, main.length > 1 ? `${sr.name} ` : '', h('b', {}, num(v, digits)),
      band ? h('small', {}, ` ${num(band.lo, digits)} – ${num(band.hi, digits)}`) : null)));
    const more = extra?.(vals);
    if (more) rows.push(h('div', {}, `${more[0]} `, h('b', {}, more[1])));
    tip.replaceChildren(h('div', { class: 'tip-date' }, shortDate(d)), ...rows);
    tip.hidden = false;
    const right = x(d) < (L + W - R) / 2;
    tip.style.left = right ? '' : `${(L / W) * 100}%`;
    tip.style.right = right ? `${(R / W) * 100}%` : '';
  };
  const hide = () => {
    tip.hidden = true;
    cross.style.display = 'none';
    dots.forEach((dot) => { dot.style.display = 'none'; });
  };
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const t = t0 + ((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * (t1 - t0);
    show(dates.reduce((best, d) => (Math.abs(ms(d) - t) < Math.abs(ms(best) - t) ? d : best)));
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  // A mouse leaving clears it; a finger lifting (or the page scrolling) leaves the reading up.
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  return h('div', {}, legend, h('div', { class: 'plot' }, svg, tip));
}
