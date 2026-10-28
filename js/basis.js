// Basis tab: every delivery month's basis charted together, how each has moved over recent weeks,
// the health-canola premium over regular canola, and a feed of every basis change.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { COMMODITIES, commodity } from './config.js';
import { h, signed, changeClass, showFirst } from './ui.js';
import { shortDate } from './chart.js';
import { monthsChart } from './monthschart.js';

const BACK = [{ label: '1 wk ago', days: 7 }, { label: '1 mo ago', days: 30 }, { label: '3 mo ago', days: 91 }];
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA');

export default {
  title: 'Basis',
  render(root) {
    const body = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
    const draw = async () => {
      const [hists, logs] = await Promise.all([
        Promise.all(COMMODITIES.map((c) => data.cashHistory(c.key))),
        Promise.all(COMMODITIES.map((c) => data.basisChanges(c.key))),
      ]);
      const byCom = Object.fromEntries(COMMODITIES.map((c, i) => [c.key, { hist: hists[i], log: logs[i] }]));
      const com = prefs.get('com');
      body.replaceChildren(...[monthsChart(com, byCom[com].hist), board(com, byCom[com].hist), premium(byCom), feed(byCom)].filter(Boolean));
    };
    root.append(body);
    draw();
  },
};

// Basis now vs the same delivery period 1 week / 1 month / 3 months ago.
function board(com, hist) {
  const div = prefs.unitDiv(com);
  const list = data.deliveries(com, hist).filter((x) => x.bid);
  if (!list.length) return h('div', { class: 'card empty' }, 'No bids posted.');
  const cell = (now, then) => (then == null
    ? h('td', { class: 'muted' }, '–')
    : h('td', {}, signed(then / div, 2),
      h('small', { class: changeClass(now - then) }, now === then ? 'unch' : `${signed((now - then) / div, 2)} since`)));
  return h('div', { class: 'card tight scroll-x' },
    h('h3', { class: 'pad' }, `${commodity(com).name} basis board (${prefs.unitLabel()})`),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Delivery'), h('th', {}, 'Now'), BACK.map((b) => h('th', {}, b.label)))),
      h('tbody', {}, list.map((x) => {
        const now = x.bid.basis;
        return h('tr', { 'data-click': '', onclick: () => { location.hash = `#history/${com}/${encodeURIComponent(x.label)}`; } },
          h('td', {}, h('b', {}, x.label)),
          h('td', {}, h('span', { class: 'big' }, signed(now / div, 2))),
          BACK.map((b) => cell(now, data.rowAt(x.rows, daysAgo(b.days))?.basis)));
      }))),
    h('p', { class: 'small muted pad' }, 'Each column is the basis LDC posted for that delivery period on that day. Green means basis has improved since.'));
}

// Health canola (Nexera) premium = Nexera basis − canola basis, matched by delivery month.
function premium(byCom) {
  const [a, b] = COMMODITIES;
  const canola = data.deliveries(a.key, byCom[a.key].hist).filter((x) => x.bid);
  const nexera = data.deliveries(b.key, byCom[b.key].hist).filter((x) => x.bid);
  const pairs = nexera.map((n) => ({ n, c: canola.find((c) => c.month && c.month === n.month) })).filter((p) => p.c);
  if (!pairs.length) return null;
  const div = prefs.unitDiv(a.key);
  const monthAgo = daysAgo(30);
  return h('div', { class: 'card tight scroll-x' },
    h('h3', { class: 'pad' }, `Health canola premium (${prefs.unitLabel()})`),
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Delivery'), h('th', {}, 'Canola'), h('th', {}, 'Nexera'), h('th', {}, 'Premium'), h('th', {}, '1 mo ago'))),
      h('tbody', {}, pairs.map(({ n, c }) => {
        const prem = n.bid.basis - c.bid.basis;
        const nThen = data.rowAt(n.rows, monthAgo)?.basis, cThen = data.rowAt(c.rows, monthAgo)?.basis;
        const then = nThen != null && cThen != null ? nThen - cThen : null;
        return h('tr', {},
          h('td', {}, h('b', {}, n.label)),
          h('td', {}, signed(c.bid.basis / div, 2)),
          h('td', {}, signed(n.bid.basis / div, 2)),
          h('td', {}, h('span', { class: 'big' }, signed(prem / div, 2))),
          then == null ? h('td', { class: 'muted' }, '–') : h('td', {}, signed(then / div, 2)));
      }))),
    h('p', { class: 'small muted pad' }, 'Both price off the same ICE canola futures, so the premium is just the difference in basis.'));
}

// Every basis change for both commodities, newest first. Before the intraday log existed,
// changes are worked out from the daily rows.
function feed(byCom) {
  const items = [];
  for (const c of COMMODITIES) {
    const { hist, log } = byCom[c.key];
    const logged = new Set(log.map((m) => `${m.label}|${m.t.slice(0, 10)}`));
    log.forEach((m) => items.push({ com: c, label: m.label, from: m.from, to: m.to, d: m.t.slice(0, 10), t: m.t }));
    for (const [label, rows] of Object.entries(hist)) {
      rows.forEach((r, i) => {
        if (i && r.basis !== rows[i - 1].basis && !logged.has(`${label}|${r.d}`)) {
          items.push({ com: c, label, from: rows[i - 1].basis, to: r.basis, d: r.d });
        }
      });
    }
  }
  items.sort((x, y) => (y.t ?? y.d).localeCompare(x.t ?? x.d));
  if (!items.length) {
    return h('div', { class: 'card tight' }, h('h3', { class: 'pad' }, 'Recent basis changes'),
      h('p', { class: 'empty small' }, 'No basis changes recorded yet. They show up here as LDC moves its basis.'));
  }
  const rows = items.slice(0, 200).map((m) => {
    const div = prefs.unitDiv(m.com.key);
    return h('div', { class: 'item', 'data-click': '', onclick: () => { location.hash = `#history/${m.com.key}/${encodeURIComponent(m.label)}`; } },
      h('div', { class: 'main' }, h('b', {}, `${m.label} · ${m.com.short}`),
        h('span', {}, m.t ? new Date(m.t).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : shortDate(m.d))),
      h('div', { class: 'amt' }, h('b', { class: changeClass(m.to - m.from) }, signed((m.to - m.from) / div, 2)),
        h('span', { class: 'small muted' }, `${signed(m.from / div, 2)} → ${signed(m.to / div, 2)}`)));
  });
  return h('div', { class: 'card tight clip' }, h('h3', { class: 'pad' }, 'Recent basis changes'), rows, showFirst(rows, 5));
}
