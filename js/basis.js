// Basis tab: every delivery month's basis charted together, the health-canola premium over
// regular canola, and one month in detail.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { COMMODITIES } from './config.js';
import { h, signed } from './ui.js';
import { monthsChart } from './monthschart.js';
import { monthPanel } from './month.js';

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString('en-CA');

export default {
  title: 'Plots',
  render(root, sub, { keep = false } = {}) {
    // Route: #basis/<commodity>/<delivery label> opens that month's detail (a tapped row).
    const [comArg, label] = sub.split('/').map(decodeURIComponent);
    if (COMMODITIES.some((c) => c.key === comArg) && comArg !== prefs.get('com')) prefs.set('com', comArg);

    const body = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
    const draw = async () => {
      const [hists, logs, futures] = await Promise.all([
        Promise.all(COMMODITIES.map((c) => data.cashHistory(c.key))),
        Promise.all(COMMODITIES.map((c) => data.basisChanges(c.key))),
        data.futuresHistory(),
      ]);
      const byCom = Object.fromEntries(COMMODITIES.map((c, i) => [c.key, { hist: hists[i], log: logs[i] }]));
      const com = prefs.get('com');
      const month = monthPanel(com, byCom[com].hist, byCom[com].log, futures, label);
      body.replaceChildren(...[monthsChart(com, byCom[com].hist), premium(byCom), month].filter(Boolean));
      // Opened from a tapped row: go to the month. A redraw in place (keep) stays put.
      if (label && month && !keep) month.scrollIntoView();
    };
    root.append(body);
    return draw();
  },
};

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
