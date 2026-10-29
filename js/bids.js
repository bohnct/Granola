// Bids tab: LDC's current cash bids with each one's basis, the futures it prices off,
// and how both moved since the previous day.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { FACILITY } from './config.js';
import { h, num, money, signed, changeClass, timeAgo } from './ui.js';

// Change since the previous saved day; "0.00" when it didn't move. `after` adds to the same line.
const delta = (now, before, div, after = '') => h('small', { class: now != null && before != null ? changeClass(now - before) : '' },
  now != null && before != null ? (now === before ? '0.00' : signed((now - before) / div, 2)) : '', after);
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

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
    root.append(body);
    return draw();
  },
};

function table(com, hist) {
  const bids = data.cashBids(com);
  if (!bids.length) return h('div', { class: 'card empty' }, 'LDC has no bids posted for this right now.');
  const div = prefs.unitDiv(com);
  // Two lines per row so every posted month fits on one phone screen.
  return h('div', { class: 'card tight scroll-x' }, h('table', { class: 'bids' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Delivery'), h('th', {}, 'Futures'), h('th', {}, 'Basis'), h('th', {}, `Cash ${prefs.unitLabel()}`))),
      h('tbody', {}, bids.map((b) => {
        const rows = hist[b.label] ?? [];
        // Compare with the last saved day before today's row.
        const prev = rows.at(-1)?.basis === b.basis && rows.at(-1)?.fut === b.futures ? data.prevRow(rows) : rows.at(-1);
        const since = data.basisSince(rows);
        return h('tr', { 'data-click': '', onclick: () => { location.hash = `#basis/${com}/${encodeURIComponent(b.label)}`; } },
          h('td', {}, h('b', {}, b.label), h('small', {}, b.futuresSymbol ?? '')),
          h('td', {}, num(b.futures / div, 2), delta(b.futures, prev?.fut, div)),
          h('td', {}, h('span', { class: 'big' }, signed(b.basis / div, 2)),
            delta(b.basis, prev?.basis, div, since ? h('span', { class: 'since' }, ` · ${day(since)}`) : '')),
          h('td', {}, h('span', { class: 'big' }, money(b.price / div)), delta(b.price, prev?.price, div)));
      }))));
}
