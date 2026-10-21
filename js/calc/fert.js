// Fertilizer blend: nutrient targets (lb/ac) → product rates, blend grade and cost.
import * as U from '../units.js';
import { h, num, money, parseNum, field, numberInput, select } from '../ui.js';
import { card, resultBox, line, hint, remember } from './common.js';

const store = remember('calc-fert');

// Analysis as % N, P2O5, K2O, S. `dry: false` products are applied separately, not in the blend.
export const PRODUCTS = {
  urea:      { name: 'Urea',              grade: '46-0-0',    n: 46, p: 0,  k: 0,  s: 0,  dry: true },
  esn:       { name: 'ESN',               grade: '44-0-0',    n: 44, p: 0,  k: 0,  s: 0,  dry: true },
  anhydrous: { name: 'Anhydrous ammonia', grade: '82-0-0',    n: 82, p: 0,  k: 0,  s: 0,  dry: false },
  uan:       { name: 'UAN',               grade: '28-0-0',    n: 28, p: 0,  k: 0,  s: 0,  dry: false },
  map:       { name: 'MAP',               grade: '11-52-0',   n: 11, p: 52, k: 0,  s: 0,  dry: true },
  potash:    { name: 'Potash',            grade: '0-0-60',    n: 0,  p: 0,  k: 60, s: 0,  dry: true },
  as:        { name: 'Ammonium sulphate', grade: '21-0-0-24', n: 21, p: 0,  k: 0,  s: 24, dry: true },
};
const N_SOURCES = ['urea', 'esn', 'anhydrous', 'uan'];

// S comes from ammonium sulphate and P from MAP; both add N, so the N source only makes up the rest.
export function solveBlend({ n = 0, p = 0, k = 0, s = 0 }, nSource) {
  const rates = { as: s / 0.24, map: p / 0.52, potash: k / 0.60 };
  const nSupplied = rates.as * 0.21 + rates.map * 0.11;
  rates[nSource] = Math.max(0, n - nSupplied) / (PRODUCTS[nSource].n / 100);
  return { rates, extraN: Math.max(0, nSupplied - n) };
}

export function renderFert(root) {
  const s = { n: '', p: '', k: '', s: '', nSrc: 'urea', acres: '', prices: {}, ...store.load() };
  const target = { n: numberInput({ value: s.n, placeholder: '0' }), p: numberInput({ value: s.p, placeholder: '0' }),
    k: numberInput({ value: s.k, placeholder: '0' }), s: numberInput({ value: s.s, placeholder: '0' }) };
  const nSrc = select(N_SOURCES.map((id) => ({ value: id, label: `${PRODUCTS[id].name} ${PRODUCTS[id].grade}` })), s.nSrc);
  const acres = numberInput({ value: s.acres, placeholder: 'Optional' });
  const prices = {};
  const priceGrid = h('div', { class: 'grid2' });
  const out = resultBox();

  function drawPrices() {
    priceGrid.replaceChildren(...[nSrc.value, 'map', 'potash', 'as'].map((id) => {
      prices[id] ??= numberInput({ value: s.prices[id] ?? '', placeholder: '$/tonne' });
      prices[id].oninput = calc;
      return field(`${PRODUCTS[id].name} $/MT`, prices[id]);
    }));
  }

  function calc() {
    Object.assign(s, { n: target.n.value, p: target.p.value, k: target.k.value, s: target.s.value, nSrc: nSrc.value, acres: acres.value,
      prices: { ...s.prices, ...Object.fromEntries(Object.entries(prices).map(([id, el]) => [id, el.value])) } });
    store.save(s);
    const t = Object.fromEntries(Object.entries(target).map(([key, el]) => [key, parseNum(el.value) ?? 0]));
    if (!t.n && !t.p && !t.k && !t.s) { out.replaceChildren(hint('Enter how many lb/ac of each nutrient you want to apply.')); return; }

    const { rates, extraN } = solveBlend(t, nSrc.value);
    const a = parseNum(acres.value);
    const used = Object.entries(rates).filter(([, lb]) => lb > 0.05);
    const mtPerLb = U.KG_PER_LB / 1000;
    let costAc = 0, priced = true;
    const rows = used.map(([id, lb]) => {
      const price = parseNum(prices[id]?.value);
      const c = price != null ? lb * mtPerLb * price : null;
      if (c == null) priced = false; else costAc += c;
      const pr = PRODUCTS[id];
      return h('tr', {}, h('td', {}, pr.name, h('small', {}, pr.grade)), h('td', {}, num(lb, 0)),
        h('td', {}, c != null ? money(c) : '–'), a ? h('td', {}, num(lb * a * mtPerLb, 1)) : null);
    });
    const table = h('table', { class: 'mini' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Product'), h('th', {}, 'lb/ac'), h('th', {}, '$/ac'), a ? h('th', {}, 'MT') : null)),
      h('tbody', {}, rows));

    // Blend grade: nutrients as % of the dry products' total weight.
    const dry = used.filter(([id]) => PRODUCTS[id].dry);
    const dryLb = dry.reduce((sum, [, lb]) => sum + lb, 0);
    const pct = (key) => (dryLb ? dry.reduce((sum, [id, lb]) => sum + lb * PRODUCTS[id][key], 0) / dryLb : 0);
    const separate = used.filter(([id]) => !PRODUCTS[id].dry);

    out.replaceChildren(table,
      h('hr', { class: 'split' }),
      dryLb ? line('Dry blend', `${num(dryLb, 0)} lb/ac`) : '',
      dryLb ? line('Blend grade', `${num(pct('n'), 0)}-${num(pct('p'), 0)}-${num(pct('k'), 0)}-${num(pct('s'), 0)}`) : '',
      separate.length ? line(`${PRODUCTS[separate[0][0]].name}`, 'applied separately') : '',
      priced && used.length ? line('Cost per acre', `${money(costAc)}/ac`) : '',
      a && dryLb ? line(`Dry blend for ${num(a, 0)} ac`, `${num(dryLb * a * mtPerLb, 2)} MT`) : '',
      a && priced && used.length ? line(`Total cost for ${num(a, 0)} ac`, money(costAc * a, 0)) : '',
      extraN > 0.5 ? h('p', { class: 'small down', style: 'margin:8px 0 0' },
        `The MAP and ammonium sulphate already supply ${num(extraN, 0)} lb/ac more N than your target.`) : '',
      !priced ? h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'Add prices to see cost per acre.') : '');
  }

  Object.values(target).forEach((el) => el.addEventListener('input', calc));
  acres.addEventListener('input', calc);
  nSrc.addEventListener('change', () => { drawPrices(); calc(); });
  drawPrices(); calc();

  root.append(
    card('Target (lb/ac actual nutrient)', null,
      h('div', { class: 'grid2' }, field('N', target.n), field('P₂O₅', target.p)),
      h('div', { class: 'grid2' }, field('K₂O', target.k), field('S', target.s))),
    card('Products', null,
      field('Nitrogen source', nSrc),
      priceGrid,
      field('Acres', acres, 'Optional. Shows tonnes to order and total cost.')),
    card('Blend', null, out),
    h('p', { class: 'small muted' }, 'P comes from MAP 11-52-0 and S from ammonium sulphate 21-0-0-24. The N they carry is counted, and the nitrogen source makes up the rest. Prices are per metric tonne of product.'),
  );
}
