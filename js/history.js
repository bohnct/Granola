// History tab: one delivery period's saved days — cash price against the futures it
// prices off, the basis between them, and every time LDC moved that basis.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { COMMODITIES } from './config.js';
import { h, num, money, signed, changeClass, segmented } from './ui.js';
import { timeChart, shortDate } from './chart.js';
import { RANGES, rangeStart } from './ranges.js';


const when = (t) => new Date(t).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default {
  title: 'History',
  render(root, sub) {
    // Route: #history/<commodity>/<delivery label>
    const [comArg, labelArg] = sub.split('/').map(decodeURIComponent);
    if (COMMODITIES.some((c) => c.key === comArg) && comArg !== prefs.get('com')) prefs.set('com', comArg);

    const body = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
    const go = (com, label) => { location.hash = `#history/${com}${label ? `/${encodeURIComponent(label)}` : ''}`; };
    root.append(prefs.commodityPicker((v) => go(v)), body);

    const com = prefs.get('com');
    Promise.all([data.cashHistory(com), data.basisChanges(com)]).then(([hist, changes]) => {
      const list = data.deliveries(com, hist);
      if (!list.length) { body.replaceChildren(h('div', { class: 'card empty' }, 'No history saved yet.')); return; }
      const cur = list.find((x) => x.label === labelArg) ?? list.find((x) => x.bid) ?? list[0];

      const live = list.filter((x) => x.bid), old = list.filter((x) => !x.bid);
      const picker = h('select', { 'aria-label': 'Delivery period', onchange: (e) => go(com, e.target.value) },
        live.length ? h('optgroup', { label: 'Posted now' }, live.map((x) => h('option', { value: x.label, selected: x === cur }, x.label))) : null,
        old.length ? h('optgroup', { label: 'No longer posted' }, old.map((x) => h('option', { value: x.label, selected: x === cur }, x.label))) : null);

      const detail = h('div');
      const draw = () => detail.replaceChildren(...view(com, cur, changes).filter(Boolean));
      body.replaceChildren(
        h('label', { class: 'field' }, h('span', {}, 'Delivery period'), picker),
        segmented(RANGES, prefs.get('range'), (v) => { prefs.set('range', v); draw(); }),
        prefs.unitPicker(draw),
        detail);
      draw();
    });
  },
};

function view(com, cur, changes) {
  const div = prefs.unitDiv(com);
  const unit = prefs.unitLabel();
  const from = rangeStart(prefs.get('range'));
  const rows = cur.rows.filter((r) => r.d >= from);
  const moves = changes.filter((c) => c.label === cur.label && c.t.slice(0, 10) >= from);

  if (!rows.length) {
    return [h('div', { class: 'card empty' }, cur.rows.length
      ? `Nothing saved for ${cur.label} in this range. Try a longer range.` : `Nothing saved for ${cur.label} yet.`)];
  }

  const bases = rows.map((r) => r.basis).filter((v) => v != null);
  const lo = rows.reduce((a, r) => (r.basis < a.basis ? r : a)), hi = rows.reduce((a, r) => (r.basis > a.basis ? r : a));
  const avg = bases.reduce((a, v) => a + v, 0) / bases.length;
  const dayMoves = rows.filter((r, i) => i && r.basis !== rows[i - 1].basis).length;
  const last = rows.at(-1);

  const stat = (label, value, note) => h('div', { class: 'stat' }, h('span', {}, label), h('b', {}, value), note ? h('span', {}, note) : null);

  return [
    h('div', { class: 'card' },
      h('h3', {}, `${cur.label} basis`, cur.bid ? null : h('span', { class: 'pill' }, 'no longer posted')),
      h('div', { class: 'stats' },
        stat(cur.bid ? 'Now' : 'Last', signed(last.basis / div, 2), shortDate(last.d)),
        stat('Average', signed(avg / div, 2), `${rows.length} days`),
        stat('Weakest', signed(lo.basis / div, 2), shortDate(lo.d)),
        stat('Strongest', signed(hi.basis / div, 2), shortDate(hi.d))),
      h('p', { class: 'small muted', style: 'margin:10px 0 0' },
        `${moves.length || dayMoves} basis change${(moves.length || dayMoves) === 1 ? '' : 's'} in this range. Basis in ${unit}.`)),

    h('div', { class: 'card' },
      h('h3', {}, `Cash price vs futures (${unit})`),
      timeChart([
        { name: 'Cash', cls: 's1', points: rows.map((r) => ({ d: r.d, v: r.price / div })) },
        { name: 'Futures', cls: 's2', points: rows.map((r) => ({ d: r.d, v: r.fut / div })) },
      ], { empty: 'The chart needs two saved days.' })),

    h('div', { class: 'card' },
      h('h3', {}, `Basis (${unit})`),
      timeChart([{ name: 'Basis', cls: 's1', step: true, points: rows.map((r) => ({ d: r.d, v: r.basis / div })) }],
        { zero: true, height: 160, empty: 'The chart needs two saved days.' }),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' }, 'Basis = cash − futures. Higher (less negative) is better for the seller.')),

    moves.length ? h('div', { class: 'card tight' },
      h('h3', { class: 'pad' }, 'Basis changes'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'From'), h('th', {}, 'To'), h('th', {}, 'Change'))),
        h('tbody', {}, moves.slice().reverse().map((m) => h('tr', {},
          h('td', {}, when(m.t)),
          h('td', {}, signed(m.from / div, 2)),
          h('td', {}, signed(m.to / div, 2)),
          h('td', { class: changeClass(m.to - m.from) }, signed((m.to - m.from) / div, 2))))))) : null,

    h('div', { class: 'card tight scroll-x' },
      h('h3', { class: 'pad' }, 'Daily record'),
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Futures'), h('th', {}, 'Basis'), h('th', {}, 'Cash'))),
        h('tbody', {}, rows.slice().reverse().map((r, i, arr) => {
          const prev = arr[i + 1];
          const moved = prev && prev.basis !== r.basis;
          return h('tr', { class: moved ? 'moved' : '' },
            h('td', {}, shortDate(r.d), r.sym ? h('small', {}, r.sym) : null),
            h('td', {}, num(r.fut / div, 2)),
            h('td', {}, signed(r.basis / div, 2),
              moved ? h('small', { class: changeClass(r.basis - prev.basis) }, signed((r.basis - prev.basis) / div, 2)) : null),
            h('td', {}, money(r.price / div)));
        })))),
  ];
}
