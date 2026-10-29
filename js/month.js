// Month detail on the Basis tab: one delivery period's saved days — cash price against the
// futures it prices off (as lines, optionally with each day's range, or daily bars), the basis,
// and every time LDC moved it. Works for months LDC no longer posts too.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { h, signed, changeClass, showFirst, chartTitle, openSettings } from './ui.js';
import { timeChart, focusChart, shortDate } from './chart.js';
import { RANGES, rangeStart } from './ranges.js';

const STYLES = [{ value: 'line', label: 'Lines' }, { value: 'bars', label: 'Bars' }];
const when = (t) => new Date(t).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// Its own range, so it can look further back than the chart above without changing it.
const range = () => prefs.get('monthRange') ?? '3M';
const style = () => prefs.get('style') ?? 'line';
const monthKey = (com) => `month-${com}`;

// label: the month to open (from a tapped row); otherwise the last one viewed, then the first posted.
export function monthPanel(com, hist, changes, futures, label) {
  const list = data.deliveries(com, hist);
  if (!list.length) return null;
  let cur = list.find((x) => x.label === label) ?? list.find((x) => x.label === prefs.get(monthKey(com)))
    ?? list.find((x) => x.bid) ?? list[0];

  const live = list.filter((x) => x.bid), old = list.filter((x) => !x.bid);
  const option = (x) => h('option', { value: x.label, selected: x === cur }, x.label);
  const picker = h('select', {
    'aria-label': 'Delivery period',
    onchange: (e) => {
      cur = list.find((x) => x.label === e.target.value);
      prefs.set(monthKey(com), cur.label);
      // Keep the link current without re-rendering the whole tab (which would jump the page).
      history.replaceState(null, '', `#basis/${com}/${encodeURIComponent(cur.label)}`);
      draw();
    },
  },
  live.length ? h('optgroup', { label: 'Posted now' }, live.map(option)) : null,
  old.length ? h('optgroup', { label: 'No longer posted' }, old.map(option)) : null);

  // One settings sheet for all of this month's charts; tap any of their titles.
  const settings = () => openSettings('Month charts', () => [
    { type: 'seg', label: 'Date range', options: RANGES, value: range(), set: (v) => { prefs.set('monthRange', v); draw(); } },
    { type: 'seg', label: 'Chart type', options: STYLES, value: style(), set: (v) => { prefs.set('style', v); draw(); } },
    // Lines only: shade each day's low to high behind the line.
    style() === 'line' && { type: 'check', label: 'Show daily low–high', value: !!prefs.get('band'), set: (v) => { prefs.set('band', v); draw(); } },
  ]);
  const head = h('div');
  const detail = h('div');
  const draw = () => {
    const note = [RANGES.find((r) => r.value === range())?.label, STYLES.find((s) => s.value === style()).label,
      style() === 'line' && prefs.get('band') ? 'daily low–high' : null].filter(Boolean).join(' · ');
    head.replaceChildren(chartTitle('One delivery month', settings, note));
    detail.replaceChildren(...view(com, cur, changes, futures, settings).filter(Boolean));
  };
  draw();
  return h('section', { id: 'month', class: 'month' },
    h('div', { class: 'card' }, head, h('label', { class: 'field' }, h('span', {}, 'Delivery period'), picker)),
    detail);
}

function view(com, cur, changes, futures, settings) {
  const div = prefs.unitDiv(com);
  const unit = prefs.unitLabel();
  const from = rangeStart(range());
  const rows = cur.rows.filter((r) => r.d >= from);
  const moves = changes.filter((c) => c.label === cur.label && c.t.slice(0, 10) >= from);

  if (!rows.length) {
    return [h('div', { class: 'card empty' }, cur.rows.length
      ? `Nothing saved for ${cur.label} in this range. Try a longer range.` : `Nothing saved for ${cur.label} yet.`)];
  }

  const band = !!prefs.get('band');
  // [o, h, l, c] -> the day's low/high, for the shaded range.
  const span = (rs, k) => (band ? rs.filter((r) => r[k]).map((r) => ({ d: r.d, lo: r[k][2] / div, hi: r[k][1] / div })) : null);
  const futSpan = band ? rows.map((r) => {
    const x = futures[r.sym]?.find((f) => f.d === r.d);
    return x && x.h != null && x.l != null ? { d: r.d, lo: x.l / div, hi: x.h / div } : null;
  }).filter(Boolean) : null;

  const card = chartCard(cur, settings);
  return [
    ...(style() === 'bars' ? barCards(rows, futures, div, unit, card) : [
      card(`Cash price vs futures (${unit})`, [
        { name: 'Cash', cls: 's1', points: rows.map((r) => ({ d: r.d, v: r.price / div })), band: span(rows, 'p') },
        { name: 'Futures', cls: 's2', points: rows.map((r) => ({ d: r.d, v: r.fut / div })), band: futSpan },
      ], {
        empty: 'The chart needs two saved days.',
        // The gap between the lines is the basis; show it with the values too.
        extra: (vals) => (vals.Cash != null && vals.Futures != null ? ['Basis', signed(vals.Cash - vals.Futures, 2)] : null),
      }),
      card(`Basis (${unit})`,
        [{ name: 'Basis', cls: 's1', step: true, points: rows.map((r) => ({ d: r.d, v: r.basis / div })), band: span(rows, 'b') }],
        { zero: true, height: 170, empty: 'The chart needs two saved days.' },
        'Basis = cash − futures. Higher (less negative) is better for the seller.')]),

    changesCard(moves, rows, div),
  ];
}

// A chart card for this month: title (settings + full screen), chart, optional note.
// The full-screen view names the month, since the rest of the panel isn't visible there.
const chartCard = (cur, settings) => (title, series, opts, note = null) => h('div', { class: 'card' },
  chartTitle(title, settings, null, () => focusChart(`${cur.label} · ${title}`, series, opts)),
  timeChart(series, opts),
  note ? h('p', { class: 'small muted', style: 'margin:6px 0 0' }, note) : null);

// Daily bars (open, high, low, close), one chart each for cash, futures and basis.
// Futures use the exchange's own daily bars, so they include the overnight session.
function barCards(rows, futures, div, unit, card) {
  const bar = (d, [o, hi, lo, c]) => ({ d, o: o / div, h: hi / div, l: lo / div, c: c / div, v: c / div });
  const futBar = (r) => {
    const x = futures[r.sym]?.find((f) => f.d === r.d);
    return x && x.c != null ? bar(r.d, [x.o ?? x.c, x.h ?? x.c, x.l ?? x.c, x.c]) : bar(r.d, [r.fut, r.fut, r.fut, r.fut]);
  };
  const syms = [...new Set(rows.map((r) => r.sym).filter(Boolean))];
  const bars = (title, points, opts = {}, note = null) => card(title, [{ name: title, cls: 's1', bars: true, points }],
    { empty: 'The chart needs two saved days.', ...opts }, note);
  const ok = (r, k) => r[k]?.every((v) => v != null);
  return [
    bars(`Cash price (${unit})`, rows.filter((r) => ok(r, 'p')).map((r) => bar(r.d, r.p))),
    bars(`Futures${syms.length ? ` ${syms.join(', ')}` : ''} (${unit})`, rows.filter((r) => r.fut != null).map(futBar)),
    bars(`Basis (${unit})`, rows.filter((r) => ok(r, 'b')).map((r) => bar(r.d, r.b)), { zero: true, height: 170 },
      'Each bar is one day: the line runs from the low to the high, the left tick is the first reading and the right tick the last. Days before Oct 29, 2026 have one reading.'),
  ];
}

// Every basis move, newest first. Before the intraday log existed, worked out from the daily rows.
function changesCard(moves, rows, div) {
  const list = moves.length
    ? moves.map((m) => ({ when: when(m.t), from: m.from, to: m.to }))
    : rows.flatMap((r, i) => (i && r.basis !== rows[i - 1].basis ? [{ when: shortDate(r.d), from: rows[i - 1].basis, to: r.basis }] : []));
  if (!list.length) return null;
  const trs = list.reverse().map((m) => h('tr', {},
    h('td', {}, m.when),
    h('td', {}, signed(m.from / div, 2)),
    h('td', {}, signed(m.to / div, 2)),
    h('td', { class: changeClass(m.to - m.from) }, signed((m.to - m.from) / div, 2))));
  return h('div', { class: 'card tight clip' },
    h('h3', { class: 'pad' }, `Basis changes (${list.length})`),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'From'), h('th', {}, 'To'), h('th', {}, 'Change'))),
      h('tbody', {}, trs)),
    showFirst(trs, 5));
}
