// LDC Offers tab: current cash bids for Canola and Nexera by delivery month.
import * as data from './data.js';
import { DEFAULT_FACILITY, FACILITIES } from './config.js';
import { h, num, money, segmented, timeAgo } from './ui.js';
import { lineChart } from './chart.js';
import { prefillAcre } from './calc/acre.js';

const state = { com: 'canola', unit: 'MT', sel: null, chart: 'price' };
const DOUBLE_TAP_MS = 350;
let lastTap = { label: null, at: 0 };

// iPhone Safari doesn't fire dblclick reliably, so detect two quick taps ourselves.
function onRowTap(bid, single) {
  const now = Date.now();
  if (lastTap.label === bid.label && now - lastTap.at < DOUBLE_TAP_MS) {
    lastTap = { label: null, at: 0 };
    prefillAcre({ com: state.com, pricePerBu: bid.price / bid.buPerUnit, label: bid.label });
    location.hash = '#calc/acre';
    return;
  }
  lastTap = { label: bid.label, at: now };
  single();
}

function fmtRange(start, end) {
  const f = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return start && end ? `${f(start)} – ${f(end)}` : '';
}

export default {
  title: 'LDC Offers',
  liveOn: ['prices'],
  render(root) {
    const fac = data.facility();
    const facName = FACILITIES.find((f) => f.key === DEFAULT_FACILITY)?.name;
    root.append(h('p', { class: 'sub' },
      data.getLatest() ? `${facName} cash bids · updated ${timeAgo(data.getLatest().updatedAt)} · delayed 10 min` : 'Loading…'));
    if (!fac) return;

    const coms = Object.keys(fac.cashBids);
    if (!coms.includes(state.com)) state.com = coms[0];
    const body = h('div');
    const draw = () => body.replaceChildren(table(), detail());

    root.append(
      segmented(coms.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })), state.com,
        (v) => { state.com = v; state.sel = null; draw(); }),
      segmented([{ value: 'MT', label: '$ / tonne' }, { value: 'bu', label: '$ / bushel' }], state.unit,
        (v) => { state.unit = v; draw(); }),
      body);
    draw();

    function table() {
      const bids = data.cashBids(state.com);
      if (!bids.length) return h('div', { class: 'card empty' }, 'No bids posted.');
      const perBu = state.unit === 'bu';
      return h('div', { class: 'card tight scroll-x' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Delivery'), h('th', {}, 'Basis'), h('th', {}, 'Futures'), h('th', {}, perBu ? 'Cash $/bu' : 'Cash $/MT'))),
        h('tbody', {}, bids.map((b) => {
          const f = perBu ? b.buPerUnit : 1;
          return h('tr', {
            class: state.sel === b.label ? 'sel' : '', 'data-click': '',
            onclick: () => onRowTap(b, () => { state.sel = state.sel === b.label ? null : b.label; draw(); }),
          },
          h('td', {}, h('b', {}, b.label), h('small', {}, fmtRange(b.start, b.end))),
          h('td', { class: b.basis < 0 ? 'down' : 'up' }, num(b.basis / f, perBu ? 2 : 2)),
          h('td', {}, num(b.futures / f, 2), h('small', {}, b.futuresSymbol)),
          h('td', {}, h('span', { class: 'big' }, money(b.price / f)), h('small', {}, perBu ? `${money(b.price)}/MT` : `${money(b.price / b.buPerUnit)}/bu`)));
        }))));
    }

    function detail() {
      if (!state.sel) return h('p', { class: 'small muted' }, 'Tap a delivery month for its price history. Double-tap to work out revenue per acre.');
      const card = h('div', { class: 'card' }, h('h3', {}, `${state.sel} history`));
      const holder = h('div', {}, h('p', { class: 'small muted' }, 'Loading…'));
      const which = segmented([{ value: 'price', label: 'Cash price' }, { value: 'basis', label: 'Basis' }], state.chart,
        (v) => { state.chart = v; plot(); });
      card.append(which, holder);
      let rows = [];
      const plot = () => {
        const f = state.unit === 'bu' ? (data.cashBids(state.com)[0]?.buPerUnit ?? 1) : 1;
        holder.replaceChildren(lineChart(rows.map((r) => ({ d: r.d, v: r[state.chart] / f })),
          { digits: 2, empty: 'History builds up one day at a time from launch.' }));
      };
      data.history('cashbids', state.com).then((hist) => { rows = hist[state.sel] ?? []; plot(); });
      return card;
    }
  },
};
