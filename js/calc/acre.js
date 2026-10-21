// Revenue and profit per acre. Yield and cost are remembered per commodity on this device.
import { COMMODITIES, commodity } from '../config.js';
import * as U from '../units.js';
import { h, num, money, parseNum, field, numberInput, select } from '../ui.js';
import { card, resultBox, line, hint, remember } from './common.js';

const store = remember('calc-acre');
const state = { com: 'canola', price: '', from: '', flash: false };

const loadAcre = (com) => store.load()[com] ?? {};
const saveAcre = (com, values) => store.save({ ...store.load(), [com]: values });

// Called from the Offers tab (double-tap on a bid) before switching to this page.
export function prefillAcre({ com, pricePerBu, label }) {
  Object.assign(state, { com, price: pricePerBu.toFixed(2), from: label, flash: true });
}

export function renderAcre(root) {
  const saved = loadAcre(state.com);
  const comSel = select(COMMODITIES.map((c) => ({ value: c.id, label: c.name })), state.com, {
    onchange: (e) => { state.com = e.target.value; state.from = ''; root.replaceChildren(); renderAcre(root); },
  });
  const price = numberInput({ value: state.price, placeholder: '18.43' });
  const yld = numberInput({ value: saved.yield ?? '', placeholder: '50' });
  const cost = numberInput({ value: saved.cost ?? '', placeholder: 'Optional' });
  const acres = numberInput({ value: saved.acres ?? '', placeholder: 'Optional' });
  const sub = h('p', { class: 'small muted', style: 'margin-top:0' });
  const out = resultBox();

  const calc = () => {
    state.price = price.value;
    saveAcre(state.com, { yield: yld.value, cost: cost.value, acres: acres.value });
    sub.textContent = state.from ? `Price from LDC ${commodity(state.com)?.name} ${state.from} bid.` : 'Price × yield. Add costs to see profit.';
    const p = parseNum(price.value), y = parseNum(yld.value), c = parseNum(cost.value), a = parseNum(acres.value);
    if (p == null || y == null) {
      out.replaceChildren(hint('Enter a price and your yield. Tip: double-tap a bid on the Offers tab to fill the price.'));
      return;
    }
    const revenue = p * y;
    const profitSpan = (v, suffix = '', digits = 2) => h('span', { class: v >= 0 ? 'up' : 'down' }, `${money(v, digits)}${suffix}`);
    const totals = a ? [
      h('hr', { class: 'split' }),
      line(`Total for ${num(a, 0)} acres`, ''),
      line('Bushels', num(y * a, 0)),
      line('Revenue', money(revenue * a, 0)),
      c != null ? line('Costs', money(c * a, 0)) : '',
      c != null ? line('Total profit', profitSpan((revenue - c) * a, '', 0)) : '',
    ] : [];
    out.replaceChildren(
      line('Revenue per acre', `${money(revenue)}/ac`),
      line('Yield in tonnes', `${num(U.buToMt(y, state.com), 3)} MT/ac`),
      c != null ? line('Profit per acre', profitSpan(revenue - c, '/ac')) : '',
      c != null && y ? line('Break-even price', `${money(c / y)}/bu`) : '',
      ...totals);
  };
  price.addEventListener('input', () => { state.from = ''; calc(); });
  [yld, cost, acres].forEach((el) => el.addEventListener('input', calc));
  calc();

  const el = card(null, null, sub,
    field('Commodity', comSel),
    h('div', { class: 'grid2' }, field('Price $/bu', price), field('Yield bu/ac', yld)),
    h('div', { class: 'grid2' }, field('Costs $/ac', cost), field('Acres', acres)),
    h('p', { class: 'small muted', style: 'margin:-4px 0 10px' }, 'Costs: seed, fert, chem, land… Add acres for whole-field totals. Both optional.'),
    out);
  root.append(el);
  if (state.flash) {
    state.flash = false;
    el.classList.add('flash');
    requestAnimationFrame(() => { if (!yld.value) yld.focus({ preventScroll: true }); });
  }
}
