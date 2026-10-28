// Bids tab: LDC's current cash bids with each one's basis, the futures it prices off,
// and how both moved since the previous day.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { FACILITY } from './config.js';
import { h, num, money, signed, changeClass, timeAgo } from './ui.js';
import { shortDate } from './chart.js';

function fmtRange(start, end) {
  const f = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return start && end ? `${f(start)} – ${f(end)}` : '';
}

const delta = (now, before, div) => (now != null && before != null && now !== before
  ? h('small', { class: changeClass(now - before) }, signed((now - before) / div, 2))
  : h('small', {}, now != null && before != null ? 'unch' : ''));

export default {
  title: 'LDC Bids',
  render(root) {
    const latest = data.getLatest();
    root.append(h('p', { class: 'sub' },
      latest ? `${FACILITY.name} · updated ${timeAgo(latest.updatedAt)} · delayed 10 min` : 'Loading…'));
    if (!latest) return;

    const body = h('div');
    const draw = async () => {
      const com = prefs.get('com');
      const hist = await data.cashHistory(com);
      body.replaceChildren(table(com, hist));
    };
    root.append(prefs.commodityPicker(draw), prefs.unitPicker(draw), body);
    draw();
  },
};

function table(com, hist) {
  const bids = data.cashBids(com);
  if (!bids.length) return h('div', { class: 'card empty' }, 'LDC has no bids posted for this right now.');
  const div = prefs.unitDiv(com);
  const perBu = div !== 1;
  return h('div', {},
    h('div', { class: 'card tight scroll-x' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Delivery'), h('th', {}, 'Futures'), h('th', {}, 'Basis'), h('th', {}, `Cash ${prefs.unitLabel()}`))),
      h('tbody', {}, bids.map((b) => {
        const rows = hist[b.label] ?? [];
        // Compare with the last saved day before today's row.
        const prev = rows.at(-1)?.basis === b.basis && rows.at(-1)?.fut === b.futures ? data.prevRow(rows) : rows.at(-1);
        const since = data.basisSince(rows);
        return h('tr', { 'data-click': '', onclick: () => { location.hash = `#history/${com}/${encodeURIComponent(b.label)}`; } },
          h('td', {}, h('b', {}, b.label), h('small', {}, fmtRange(b.start, b.end))),
          h('td', {}, num(b.futures / div, 2), h('small', {}, b.futuresSymbol ?? ''), delta(b.futures, prev?.fut, div)),
          h('td', {}, h('span', { class: 'big' }, signed(b.basis / div, 2)),
            delta(b.basis, prev?.basis, div),
            since ? h('small', {}, `since ${shortDate(since)}`) : null),
          h('td', {}, h('span', { class: 'big' }, money(b.price / div)),
            h('small', {}, perBu ? `${money(b.price)}/MT` : `${money(b.price / b.buPerUnit)}/bu`),
            delta(b.price, prev?.price, div)));
      })))),
    h('p', { class: 'small muted' },
      'Cash = futures + basis. Small numbers are the change since the previous saved day. ',
      '"Since" is when that basis was last changed. Tap a row for its full history.'));
}
