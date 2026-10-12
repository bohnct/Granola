// Sales tab: list, add, edit and delete grain sales (stored in the Google Sheet).
import * as sheets from './sheets.js';
import * as data from './data.js';
import * as L from './ledger.js';
import { inventoryCommodities, commodity, FACILITIES, DEFAULT_FACILITY } from './config.js';
import { h, num, money, field, numberInput, select, openSheet, parseNum, toast, today, segmented } from './ui.js';

const state = { year: L.currentCropYear(), com: 'all' };
const TYPES = [
  { value: 'cash', label: 'Cash (spot)' },
  { value: 'deferred', label: 'Deferred delivery' },
  { value: 'basis', label: 'Basis contract' },
  { value: 'futures', label: 'Futures-only / HTA' },
  { value: 'other', label: 'Other' },
];

export default {
  title: 'Sales',
  liveOn: ['sheet'],
  render(root) {
    const coms = inventoryCommodities();
    const all = L.salesFor(state.year, state.com === 'all' ? null : state.com);
    const redraw = () => { root.replaceChildren(); this.render(root); };

    root.append(
      h('div', { class: 'row' }, h('h2', {}, 'Sales'),
        h('div', { class: 'right' }, h('button', { type: 'button', class: 'btn primary sm', onclick: () => editSale() }, '+ Add sale'))),
      h('div', { class: 'row' },
        select(L.years().map((y) => ({ value: String(y), label: `${y} crop` })), String(state.year),
          { onchange: (e) => { state.year = Number(e.target.value); redraw(); } })),
      segmented([{ value: 'all', label: 'All' }, ...coms.map((c) => ({ value: c.id, label: c.name }))], state.com,
        (v) => { state.com = v; redraw(); }),
    );

    const income = all.reduce((s, r) => s + r.value, 0);
    const byCom = coms.map((c) => ({ c, rows: all.filter((r) => r.commodity === c.id) })).filter((x) => x.rows.length);
    root.append(h('div', { class: 'card' }, h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, money(income, 0)), h('span', {}, `Income · ${all.length} sales`)),
      ...byCom.map(({ c, rows }) => {
        const bu = rows.reduce((s, r) => s + r.bushels, 0);
        const val = rows.reduce((s, r) => s + r.value, 0);
        return h('div', { class: 'stat' }, h('b', {}, `${money(bu ? val / bu : 0)}/bu`), h('span', {}, `${c.name}: ${num(bu, 0)} bu avg`));
      }))));

    if (!all.length) {
      root.append(h('div', { class: 'card empty' }, 'No sales recorded for this crop year yet.'));
      return;
    }
    root.append(h('div', { class: 'card tight' }, all.map((r) => h('div', {
      class: 'item', role: 'button', tabindex: 0, onclick: () => editSale(r),
    },
    h('div', { class: 'main' },
      h('b', {}, `${commodity(r.commodity)?.name ?? r.commodity} · ${r.buyer || '—'}`,
        r.delivered ? h('span', { class: 'pill ok' }, 'Delivered') : h('span', { class: 'pill' }, 'Open')),
      h('span', {}, `${r.date ?? ''} · ${TYPES.find((t) => t.value === r.type)?.label ?? r.type ?? ''}${r.deliveryMonth ? ` · ${r.deliveryMonth}` : ''}${r.contractNo ? ` · #${r.contractNo}` : ''}`)),
    h('div', { class: 'amt' }, h('b', {}, money(r.value, 0)),
      h('span', { class: 'small muted' }, `${num(r.bushels, 0)} bu @ ${money(r.pricePerBu)}`))))));
  },
};

export function editSale(existing) {
  const s = existing ? { ...existing } : {
    date: today(), year: state.year, commodity: state.com !== 'all' ? state.com : inventoryCommodities()[0].id,
    buyer: FACILITIES.find((f) => f.key === DEFAULT_FACILITY)?.name ?? '', type: 'cash', qtyUnit: 'bu', priceUnit: '$/MT', delivered: false,
  };

  const date = h('input', { type: 'date', value: s.date ?? today() });
  const com = select(inventoryCommodities().map((c) => ({ value: c.id, label: c.name })), s.commodity);
  const year = select(L.years().concat(L.currentCropYear() - 1).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a)
    .map((y) => ({ value: String(y), label: `${y} crop` })), String(s.year));
  const buyer = h('input', { type: 'text', value: s.buyer ?? '' });
  const contract = h('input', { type: 'text', value: s.contractNo ?? '' });
  const type = select(TYPES, s.type ?? 'cash');
  const delivMonth = h('input', { type: 'text', value: s.deliveryMonth ?? '', placeholder: "e.g. DEC'26" });
  const qty = numberInput({ value: s.qty == null ? '' : String(s.qty) });
  const qtyUnit = select([{ value: 'bu', label: 'bu' }, { value: 'MT', label: 'MT' }], s.qtyUnit ?? 'bu');
  const price = numberInput({ value: s.price == null ? '' : String(s.price) });
  const priceUnit = select([{ value: '$/MT', label: '$/MT' }, { value: '$/bu', label: '$/bu' }], s.priceUnit ?? '$/MT');
  const delivered = h('input', { type: 'checkbox', checked: Boolean(s.delivered) });
  const notes = h('textarea', { rows: 2 }, s.notes ?? '');
  const preview = h('div', { class: 'result' });

  // One-tap fill from today's LDC bid.
  const bidBox = h('div');
  const drawBids = () => {
    const key = commodity(com.value)?.cashBidKey;
    const bids = key ? data.cashBids(key) : [];
    bidBox.replaceChildren(bids.length ? field('Use today\'s LDC bid', select([{ value: '', label: 'Choose delivery month…' },
      ...bids.map((b) => ({ value: b.label, label: `${b.label}: ${money(b.price)}/MT (${money(b.price / b.buPerUnit)}/bu)` }))], '', {
      onchange: (e) => {
        const b = bids.find((x) => x.label === e.target.value); if (!b) return;
        price.value = String(b.price); priceUnit.value = '$/MT'; delivMonth.value = b.label;
        if (!buyer.value) buyer.value = 'LDC Yorkton';
        update();
      },
    })) : '');
  };

  const collect = () => ({
    ...s,
    date: date.value, commodity: com.value, year: Number(year.value), buyer: buyer.value.trim(),
    contractNo: contract.value.trim(), type: type.value, deliveryMonth: delivMonth.value.trim(),
    qty: parseNum(qty.value), qtyUnit: qtyUnit.value, price: parseNum(price.value), priceUnit: priceUnit.value,
    delivered: delivered.checked, notes: notes.value.trim(),
  });
  const update = () => {
    const r = collect();
    if (r.qty == null || r.price == null) { preview.replaceChildren(h('span', { class: 'muted small' }, 'Enter quantity and price.')); return; }
    const d = L.withDerived(r);
    preview.replaceChildren(
      h('div', { class: 'line' }, h('span', { class: 'muted' }, 'Quantity'), h('b', {}, `${num(d.bushels, 0)} bu · ${num(d.tonnes, 3)} MT`)),
      h('div', { class: 'line' }, h('span', { class: 'muted' }, 'Price'), h('b', {}, `${money(d.pricePerBu)}/bu · ${money(d.pricePerMt)}/MT`)),
      h('div', { class: 'line' }, h('span', { class: 'muted' }, 'Value'), h('b', {}, money(d.value))));
  };
  [qty, qtyUnit, price, priceUnit, com].forEach((el) => el.addEventListener('input', update));
  com.addEventListener('change', () => { drawBids(); update(); });
  drawBids(); update();

  const save = async () => {
    const r = collect();
    if (r.qty == null || r.price == null || !r.date) { toast('Date, quantity and price are required'); return; }
    await sheets.upsert('Sales', L.withDerived(r));
    sheet.close();
    toast(existing ? 'Sale updated' : 'Sale added');
  };
  const remove = async () => {
    if (!confirm('Delete this sale?')) return;
    await sheets.remove('Sales', existing.id);
    sheet.close();
    toast('Sale deleted');
  };

  const sheet = openSheet(existing ? 'Edit sale' : 'New sale',
    h('div', { class: 'grid2' }, field('Date', date), field('Crop year', year)),
    h('div', { class: 'grid2' }, field('Commodity', com), field('Type', type)),
    bidBox,
    h('div', { class: 'grid2' }, field('Quantity', qty), field('Unit', qtyUnit)),
    h('div', { class: 'grid2' }, field('Price', price), field('Unit', priceUnit)),
    preview,
    h('div', { style: 'height:10px' }),
    h('div', { class: 'grid2' }, field('Buyer', buyer), field('Contract #', contract)),
    field('Delivery month', delivMonth),
    h('label', { class: 'check' }, delivered, 'Delivered'),
    field('Notes', notes),
    h('div', { class: 'actions' },
      existing ? h('button', { type: 'button', class: 'btn danger', onclick: remove }, 'Delete') : null,
      h('button', { type: 'button', class: 'btn primary', onclick: save }, existing ? 'Save' : 'Add sale')));
}
