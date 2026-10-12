// Calculators tab. Inputs persist in module state while the app is open.
import * as data from './data.js';
import { COMMODITIES, commodity } from './config.js';
import * as U from './units.js';
import { h, num, money, parseNum, field, numberInput, select } from './ui.js';

const state = {
  com: 'canola',
  bu: '', mt: '',
  pBu: '', pMt: '',
  fut: '', basis: '', cash: '', bidLabel: '',
  loadW: '', loadUnit: 'kg', dock: '', loadP: '', loadPUnit: '$/MT',
  binBu: '', binBid: '',
  yBu: '', yAcres: '',
  acPrice: '', acFrom: '', acYield: '', acCost: '',
  flash: false,
};

// Yield and cost per acre are remembered per commodity on this device.
const ACRE_KEY = 'calc-acre';
function loadAcre(com) {
  try { return JSON.parse(localStorage.getItem(ACRE_KEY) || '{}')[com] ?? {}; } catch { return {}; }
}
function saveAcre(com, values) {
  try {
    const all = JSON.parse(localStorage.getItem(ACRE_KEY) || '{}');
    all[com] = values;
    localStorage.setItem(ACRE_KEY, JSON.stringify(all));
  } catch { /* storage unavailable: keep values for this session only */ }
}

// Called from the Offers tab (double-tap on a bid) before switching to this tab.
export function prefillAcre({ com, pricePerBu, label }) {
  const saved = loadAcre(com);
  Object.assign(state, {
    com, acPrice: pricePerBu.toFixed(2), acFrom: label,
    acYield: saved.yield ?? state.acYield, acCost: saved.cost ?? state.acCost, flash: true,
  });
}

const fmtIn = (v, d = 3) => (v == null || !Number.isFinite(v) ? '' : String(+v.toFixed(d)));

// Two inputs that convert into each other.
function pair(aKey, bKey, aLabel, bLabel, aToB, bToA, digits) {
  const a = numberInput({ value: state[aKey], placeholder: '0' });
  const b = numberInput({ value: state[bKey], placeholder: '0' });
  a.addEventListener('input', () => { state[aKey] = a.value; const v = parseNum(a.value); state[bKey] = b.value = v == null ? '' : fmtIn(aToB(v), digits); });
  b.addEventListener('input', () => { state[bKey] = b.value; const v = parseNum(b.value); state[aKey] = a.value = v == null ? '' : fmtIn(bToA(v), digits); });
  return h('div', { class: 'grid2' }, field(aLabel, a), field(bLabel, b));
}

function card(title, sub, ...body) {
  return h('div', { class: 'card' }, h('h3', {}, title), sub ? h('p', { class: 'small muted', style: 'margin-top:-4px' }, sub) : null, ...body);
}

function resultBox() { return h('div', { class: 'result' }); }
const line = (label, value) => h('div', { class: 'line' }, h('span', { class: 'muted' }, label), h('b', {}, value));

export default {
  title: 'Calculators',
  liveOn: [],
  render(root) {
    const id = () => state.com;
    const comSel = select(COMMODITIES.map((c) => ({ value: c.id, label: c.name })), state.com, {
      onchange: (e) => {
        state.com = e.target.value;
        state.acYield = state.acCost = state.acFrom = ''; // reload this commodity's saved yield/costs
        root.replaceChildren(); this.render(root);
      },
    });
    const factor = U.buPerMt(id());
    root.append(
      h('h2', {}, 'Calculators'),
      field('Commodity', comSel, `${num(factor, 3)} bu per tonne · ${num(U.lbPerBu(id()), 2)} lb per bu (change in Settings)`),

      acreCard(),

      card('Bushels ↔ Tonnes', null,
        pair('bu', 'mt', 'Bushels', 'Tonnes (MT)', (v) => U.buToMt(v, id()), (v) => U.mtToBu(v, id()), 3)),

      card('Price: $/bu ↔ $/tonne', null,
        pair('pBu', 'pMt', '$ per bushel', '$ per tonne', (v) => U.perBuToPerMt(v, id()), (v) => U.perMtToPerBu(v, id()), 2)),

      cashCard(),
      loadCard(),
      binCard(),
      yieldCard(),
    );

    function acreCard() {
      if (!state.acYield && !state.acCost) {
        const saved = loadAcre(id());
        state.acYield = saved.yield ?? ''; state.acCost = saved.cost ?? '';
      }
      const price = numberInput({ value: state.acPrice, placeholder: '18.43' });
      const yld = numberInput({ value: state.acYield, placeholder: '50' });
      const cost = numberInput({ value: state.acCost, placeholder: 'Optional' });
      const out = resultBox();
      const calc = () => {
        Object.assign(state, { acPrice: price.value, acYield: yld.value, acCost: cost.value });
        saveAcre(id(), { yield: yld.value, cost: cost.value });
        const p = parseNum(price.value), y = parseNum(yld.value), c = parseNum(cost.value);
        if (p == null || y == null) {
          out.replaceChildren(h('span', { class: 'muted small' }, 'Enter a price and your yield. Tip: double-tap a bid on the Offers tab to fill the price.'));
          return;
        }
        const revenue = p * y;
        out.replaceChildren(
          line('Revenue per acre', `${money(revenue)}/ac`),
          line('Yield in tonnes', `${num(U.buToMt(y, id()), 3)} MT/ac`),
          c != null ? line('Profit per acre', h('span', { class: revenue - c >= 0 ? 'up' : 'down' }, `${money(revenue - c)}/ac`)) : '',
          c != null && y ? line('Break-even price', `${money(c / y)}/bu`) : '');
      };
      price.addEventListener('input', () => { state.acFrom = ''; calc(); });
      [yld, cost].forEach((el) => el.addEventListener('input', calc));
      calc();

      const el = card('Revenue per acre', state.acFrom ? `Price from LDC ${commodity(id())?.name} ${state.acFrom} bid.` : 'Price × yield. Add costs to see profit.',
        h('div', { class: 'grid2' }, field('Price $/bu', price), field('Yield bu/ac', yld)),
        field('Costs $/ac', cost, 'Seed, fert, chem, land… leave blank for revenue only.'),
        out);
      if (state.flash) {
        state.flash = false;
        el.classList.add('flash');
        requestAnimationFrame(() => {
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
          if (!yld.value) yld.focus({ preventScroll: true });
        });
      }
      return el;
    }

    function cashCard() {
      const inputs = { fut: numberInput({ value: state.fut }), basis: numberInput({ value: state.basis }), cash: numberInput({ value: state.cash }) };
      const out = resultBox();
      const bids = data.cashBids(commodity(id())?.cashBidKey ?? '');
      const lastEdited = [];
      const solve = () => {
        const v = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, parseNum(el.value)]));
        // Solve for whichever of the three was edited least recently.
        const missing = ['fut', 'basis', 'cash'].find((k) => !lastEdited.includes(k)) ?? lastEdited[0];
        if (missing === 'cash' && v.fut != null && v.basis != null) v.cash = v.fut + v.basis;
        if (missing === 'basis' && v.fut != null && v.cash != null) v.basis = v.cash - v.fut;
        if (missing === 'fut' && v.cash != null && v.basis != null) v.fut = v.cash - v.basis;
        if (v[missing] != null) { inputs[missing].value = fmtIn(v[missing], 2); state[missing] = inputs[missing].value; }
        out.replaceChildren(v.cash != null
          ? h('div', {}, line('Cash', `${money(v.cash)}/MT`), line('Cash per bushel', `${money(U.perMtToPerBu(v.cash, id()))}/bu`),
            v.basis != null ? line('Basis per bushel', `${num(U.perMtToPerBu(v.basis, id()), 2)}/bu`) : '')
          : h('span', { class: 'muted small' }, 'Enter any two values; the third is calculated.'));
      };
      for (const [k, el] of Object.entries(inputs)) {
        el.addEventListener('input', () => {
          state[k] = el.value;
          const i = lastEdited.indexOf(k);
          if (i >= 0) lastEdited.splice(i, 1);
          lastEdited.push(k);
          if (lastEdited.length > 2) lastEdited.shift();
          solve();
        });
      }
      const pick = bids.length ? select([{ value: '', label: 'Fill from LDC bid…' }, ...bids.map((b) => ({ value: b.label, label: `${b.label}: ${money(b.price)}/MT` }))], state.bidLabel, {
        onchange: (e) => {
          state.bidLabel = e.target.value;
          const b = bids.find((x) => x.label === e.target.value);
          if (!b) return;
          inputs.fut.value = state.fut = String(b.futures);
          inputs.basis.value = state.basis = String(b.basis);
          inputs.cash.value = state.cash = String(b.price);
          lastEdited.splice(0, lastEdited.length, 'fut', 'basis');
          solve();
        },
      }) : null;
      solve();
      return card('Cash = Futures + Basis', 'All in $/tonne. Enter any two.',
        pick ? field('LDC bid', pick) : null,
        h('div', { class: 'grid2' }, field('Futures $/MT', inputs.fut), field('Basis $/MT', inputs.basis)),
        field('Cash $/MT', inputs.cash), out);
    }

    function loadCard() {
      const w = numberInput({ value: state.loadW, placeholder: 'Net weight' });
      const unit = select([{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }, { value: 'MT', label: 'tonnes' }], state.loadUnit);
      const dock = numberInput({ value: state.dock, placeholder: '0' });
      const p = numberInput({ value: state.loadP, placeholder: 'Price' });
      const pUnit = select([{ value: '$/MT', label: '$/MT' }, { value: '$/bu', label: '$/bu' }], state.loadPUnit);
      const out = resultBox();
      const calc = () => {
        Object.assign(state, { loadW: w.value, loadUnit: unit.value, dock: dock.value, loadP: p.value, loadPUnit: pUnit.value });
        const weight = parseNum(w.value);
        if (weight == null) { out.replaceChildren(h('span', { class: 'muted small' }, 'Enter a scale-ticket net weight.')); return; }
        const grossMt = U.toMt(weight, unit.value, id());
        const netMt = grossMt * (1 - (parseNum(dock.value) ?? 0) / 100);
        const netBu = U.mtToBu(netMt, id());
        const price = parseNum(p.value);
        out.replaceChildren(
          line('Net tonnes', num(netMt, 3)),
          line('Net bushels', num(netBu, 1)),
          (parseNum(dock.value) ?? 0) ? line('Dockage removed', `${num(grossMt - netMt, 3)} MT`) : '',
          price != null ? line('Load value', money(netMt * U.pricePerMt(price, pUnit.value, id()))) : '');
      };
      [w, unit, dock, p, pUnit].forEach((el) => el.addEventListener('input', calc));
      calc();
      return card('Truck load / scale ticket', 'Weight → tonnes, bushels and value after dockage.',
        h('div', { class: 'grid2' }, field('Net weight', w), field('Unit', unit)),
        field('Dockage %', dock),
        h('div', { class: 'grid2' }, field('Price', p), field('Price unit', pUnit)),
        out);
    }

    function binCard() {
      const bids = data.cashBids(commodity(id())?.cashBidKey ?? '');
      const bu = numberInput({ value: state.binBu, placeholder: 'Bushels' });
      const out = resultBox();
      const bidSel = select(bids.map((b) => ({ value: b.label, label: `${b.label}: ${money(b.price)}/MT` })), state.binBid || bids[0]?.label);
      const calc = () => {
        state.binBu = bu.value; state.binBid = bidSel.value;
        const b = bids.find((x) => x.label === bidSel.value);
        const v = parseNum(bu.value);
        if (v == null || !b) { out.replaceChildren(h('span', { class: 'muted small' }, 'Enter bushels on hand.')); return; }
        const mt = U.buToMt(v, id());
        out.replaceChildren(line('Tonnes', num(mt, 3)), line('Value at bid', money(mt * b.price, 0)));
      };
      bu.addEventListener('input', calc); bidSel.addEventListener('change', calc);
      calc();
      if (!bids.length) return card('Bin value at LDC bid', `LDC doesn't post ${commodity(id()).name} bids.`);
      return card('Bin value at LDC bid', null, h('div', { class: 'grid2' }, field('Bushels', bu), field('Delivery', bidSel)), out);
    }

    function yieldCard() {
      const bu = numberInput({ value: state.yBu, placeholder: 'Bushels' });
      const ac = numberInput({ value: state.yAcres, placeholder: 'Acres' });
      const out = resultBox();
      const calc = () => {
        state.yBu = bu.value; state.yAcres = ac.value;
        const b = parseNum(bu.value), a = parseNum(ac.value);
        if (b == null || !a) { out.replaceChildren(h('span', { class: 'muted small' }, 'Enter bushels harvested and acres.')); return; }
        out.replaceChildren(line('Yield', `${num(b / a, 1)} bu/ac`), line('Tonnes per acre', num(U.buToMt(b, id()) / a, 3)),
          line('Tonnes per hectare', num(U.buToMt(b, id()) / (a * 0.404686), 3)));
      };
      [bu, ac].forEach((el) => el.addEventListener('input', calc));
      calc();
      return card('Yield', null, h('div', { class: 'grid2' }, field('Bushels', bu), field('Acres', ac)), out);
    }
  },
};
