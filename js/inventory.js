// Inventory tab: production, targets, sold vs unsold and income per commodity.
import * as sheets from './sheets.js';
import * as L from './ledger.js';
import * as U from './units.js';
import { inventoryCommodities, commodity } from './config.js';
import { h, num, money, segmented, field, numberInput, select, openSheet, parseNum, toast, timeAgo } from './ui.js';
import { uid } from './db.js';

const state = { year: L.currentCropYear(), unit: 'bu' };

function syncLine() {
  const s = sheets.getStatus();
  const label = !s.configured ? 'Google Sheet not connected (Settings ⚙)'
    : s.state === 'syncing' ? 'Syncing with Google Sheet…'
      : s.state === 'ok' ? `Google Sheet synced ${timeAgo(s.fetchedAt)}`
        : s.state === 'offline' ? 'Offline: changes will upload later' : `Sync error: ${s.error}`;
  return h('p', { class: `sync ${s.state}` }, h('i'), label, s.pending ? ` · ${s.pending} pending` : '');
}

export default {
  title: 'Inventory',
  liveOn: ['sheet', 'prices'],
  render(root) {
    const qty = (bu, com) => (state.unit === 'bu' ? `${num(bu, 0)} bu` : `${num(U.buToMt(bu, com), 1)} MT`);
    root.append(
      h('h2', {}, 'Inventory'), syncLine(),
      h('div', { class: 'row' },
        select(L.years().map((y) => ({ value: String(y), label: `${y} crop` })), String(state.year), {
          onchange: (e) => { state.year = Number(e.target.value); rerender(); },
        }),
        segmented([{ value: 'bu', label: 'Bushels' }, { value: 'MT', label: 'Tonnes' }], state.unit, (v) => { state.unit = v; rerender(); })),
    );
    function rerender() { root.replaceChildren(); this_.render(root); }
    const this_ = this;

    let totalIncome = 0, totalUnsoldValue = 0;
    for (const c of inventoryCommodities()) {
      const s = L.summary(state.year, c.id);
      totalIncome += s.income; totalUnsoldValue += s.unsoldValue ?? 0;
      const targets = L.targetsFor(state.year, c.id);
      root.append(h('div', { class: 'card' },
        h('div', { class: 'row' }, h('h3', { style: 'margin:0' }, c.name),
          h('div', { class: 'right' }, h('button', { type: 'button', class: 'btn sm', onclick: () => editCropYear(state.year, c.id) }, s.produced ? 'Edit' : 'Set up'))),
        s.produced ? [
          h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, s.pctSold * 100)}%` }),
            s.target ? h('span', { class: 'tgt', style: `left:${Math.min(100, (s.target / s.produced) * 100)}%` }) : null),
          h('p', { class: 'small muted', style: 'margin:0 0 10px' },
            `${num(s.pctSold * 100, 0)}% sold`, s.target ? ` · target ${qty(s.target, c.id)} (${num((s.pctTarget ?? 0) * 100, 0)}% reached)` : ''),
          h('div', { class: 'stats' },
            stat(qty(s.produced, c.id), 'Produced'),
            stat(qty(s.soldBu, c.id), `Sold (${s.count} sales)`),
            stat(qty(s.unsoldBu, c.id), 'Unsold'),
            stat(s.target ? qty(s.toTargetBu, c.id) : '–', 'Left to reach target'),
            stat(money(s.income, 0), 'Income'),
            stat(s.avgPerBu == null ? '–' : state.unit === 'bu' ? `${money(s.avgPerBu)}/bu` : `${money(s.avgPerMt)}/MT`, 'Avg sale price'),
            stat(s.unsoldValue == null ? '–' : money(s.unsoldValue, 0), s.bid ? `Unsold @ ${s.bid.label} bid` : 'Unsold value'),
            stat(qty(s.deliveredBu, c.id), 'Delivered')),
        ] : h('p', { class: 'small muted' }, `Enter your ${state.year} ${c.name.toLowerCase()} production and sales target.`),
        targets.length ? h('div', { style: 'margin-top:12px' }, h('h3', {}, 'Price targets'),
          targets.map((t) => h('div', { class: 'item', style: 'padding:8px 0' },
            h('div', { class: 'main' }, h('b', {}, `${money(Number(t.price))} ${t.priceUnit === '$/bu' ? '/bu' : '/MT'}`),
              h('span', {}, t.qty ? `${num(Number(t.qty), 0)} ${t.qtyUnit || 'bu'}` : '', t.notes ? ` · ${t.notes}` : '')),
            L.targetMet(t, c.id) ? h('span', { class: 'pill ok' }, 'Bid reached') : h('span', { class: 'pill' }, 'Waiting')))) : null,
      ));
    }
    root.append(h('div', { class: 'card' }, h('div', { class: 'stats' },
      stat(money(totalIncome, 0), `${state.year} income (all crops)`),
      stat(money(totalUnsoldValue, 0), 'Unsold value at LDC bids'))));
  },
};

function stat(value, label) { return h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label)); }

function editCropYear(year, com) {
  const name = commodity(com).name;
  const cy = L.cropYear(year, com) ?? {};
  const unitSel = select([{ value: 'bu', label: 'bu' }, { value: 'MT', label: 'MT' }], 'bu');
  const produced = numberInput({ value: cy.producedBu ? String(cy.producedBu) : '' });
  const target = numberInput({ value: cy.targetSellBu ? String(cy.targetSellBu) : '' });
  const notes = h('input', { type: 'text', value: cy.notes ?? '' });
  unitSel.addEventListener('change', () => {
    // convert the typed numbers when switching units
    for (const el of [produced, target]) {
      const v = parseNum(el.value); if (v == null) continue;
      el.value = String(+(unitSel.value === 'MT' ? U.buToMt(v, com) : U.mtToBu(v, com)).toFixed(unitSel.value === 'MT' ? 3 : 0));
    }
  });

  // Price targets
  let targets = L.targetsFor(year, com).map((t) => ({ ...t }));
  const removed = [];
  const tList = h('div');
  const drawTargets = () => tList.replaceChildren(...targets.map((t, i) => {
    const price = numberInput({ value: t.price == null ? '' : String(t.price), placeholder: 'Price' });
    const pu = select([{ value: '$/MT', label: '$/MT' }, { value: '$/bu', label: '$/bu' }], t.priceUnit || '$/MT');
    const q = numberInput({ value: t.qty == null ? '' : String(t.qty), placeholder: 'Qty' });
    const qu = select([{ value: 'bu', label: 'bu' }, { value: 'MT', label: 'MT' }], t.qtyUnit || 'bu');
    price.oninput = () => { t.price = parseNum(price.value); };
    pu.onchange = () => { t.priceUnit = pu.value; };
    q.oninput = () => { t.qty = parseNum(q.value); };
    qu.onchange = () => { t.qtyUnit = qu.value; };
    return h('div', { class: 'card', style: 'margin:8px 0;padding:10px' },
      h('div', { class: 'grid2' }, field('Target price', price), field('Unit', pu)),
      h('div', { class: 'grid2' }, field('Quantity', q), field('Unit', qu)),
      h('button', { type: 'button', class: 'btn sm danger', onclick: () => { removed.push(t); targets.splice(i, 1); drawTargets(); } }, 'Remove target'));
  }));
  drawTargets();

  const save = async () => {
    const toBu = (el) => { const v = parseNum(el.value); return v == null ? null : Math.round(U.toBu(v, unitSel.value, com)); };
    await sheets.upsert('CropYears', {
      id: L.cropYearId(year, com), year, commodity: com,
      producedBu: toBu(produced), targetSellBu: toBu(target), notes: notes.value,
    });
    for (const t of removed) if (t.id) await sheets.remove('Targets', t.id);
    for (const t of targets) {
      if (t.price == null) continue;
      await sheets.upsert('Targets', {
        id: t.id || uid(), cropYearId: L.cropYearId(year, com), commodity: com, year,
        price: t.price, priceUnit: t.priceUnit || '$/MT', qty: t.qty, qtyUnit: t.qtyUnit || 'bu', notes: t.notes ?? '',
      });
    }
    sheet.close();
    toast('Saved');
  };

  const sheet = openSheet(`${year} ${name}`,
    field('Units for the amounts below', unitSel),
    field('Total production', produced),
    field('Sales target (amount to sell)', target, 'Leave blank to treat all production as the target.'),
    field('Notes', notes),
    h('h3', { style: 'margin-top:16px' }, 'Price targets'),
    h('p', { class: 'small muted' }, 'Shows "Bid reached" when today\'s best LDC bid meets the price.'),
    tList,
    h('button', { type: 'button', class: 'btn block', onclick: () => { targets.push({ priceUnit: '$/MT', qtyUnit: 'bu' }); drawTargets(); } }, '+ Add price target'),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: save }, 'Save')));
}
