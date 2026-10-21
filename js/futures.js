// Futures tab: LDC's futures feed (ICE canola; see FUTURES in config.js) with daily history.
import * as data from './data.js';
import { FUTURES } from './config.js';
import { h, num, signed, changeClass, segmented, timeAgo } from './ui.js';
import { lineChart } from './chart.js';

const state = { key: 'canola', sel: null };

export default {
  title: 'Futures',
  liveOn: ['prices'],
  render(root) {
    root.append(h('h2', {}, 'Futures'), h('p', { class: 'sub' },
      data.getLatest() ? `From LDC · delayed 10 min · updated ${timeAgo(data.getLatest().updatedAt)}` : 'Loading…'));
    const avail = FUTURES.filter((f) => data.futures(f.key).length);
    if (!avail.length) return;
    if (!avail.some((f) => f.key === state.key)) state.key = avail[0].key;

    const body = h('div');
    const draw = () => body.replaceChildren(table(), detail());
    if (avail.length > 1) {
      root.append(segmented(avail.map((f) => ({ value: f.key, label: f.name })), state.key,
        (v) => { state.key = v; state.sel = null; draw(); }));
    }
    root.append(body);
    draw();

    function meta() { return FUTURES.find((f) => f.key === state.key); }

    function table() {
      const rows = data.futures(state.key);
      if (!state.sel && rows[0]) state.sel = rows[0].symbol ?? rows[0].month;
      const m = meta();
      const d = m.unit === 'CAD/MT' ? 2 : 2;
      return h('div', { class: 'card tight scroll-x' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Month'), h('th', {}, 'Last'), h('th', {}, 'Chg'), h('th', {}, 'High'), h('th', {}, 'Low'))),
        h('tbody', {}, rows.map((r) => {
          const id = r.symbol ?? r.month;
          return h('tr', { class: state.sel === id ? 'sel' : '', 'data-click': '', onclick: () => { state.sel = id; draw(); } },
            h('td', {}, h('b', {}, r.month), h('small', {}, r.symbol ?? '')),
            h('td', {}, h('span', { class: 'big' }, num(r.last, d))),
            h('td', { class: changeClass(r.change) }, signed(r.change, d)),
            h('td', {}, num(r.high, d)),
            h('td', {}, num(r.low, d)));
        }))),
      h('p', { class: 'small muted', style: 'padding:0 14px 10px;margin:0' }, `${m.exchange} · ${m.unit}`));
    }

    function detail() {
      if (!state.sel) return '';
      const holder = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
      data.history('futures', state.key).then((hist) => {
        const rows = hist[state.sel] ?? [];
        holder.replaceChildren(lineChart(rows.map((r) => ({ d: r.d, v: r.c })),
          { digits: 2, empty: 'Daily closes are saved from launch day, so this chart fills in over time.' }));
      });
      return h('div', { class: 'card' }, h('h3', {}, `${state.sel} daily close`), holder);
    }
  },
};
