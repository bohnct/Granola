// Grain drying: weight after drying from one moisture % to another.
import { COMMODITIES } from '../config.js';
import * as U from '../units.js';
import { h, num, parseNum, field, numberInput, select } from '../ui.js';
import { card, resultBox, line, hint, remember } from './common.js';

const store = remember('calc-drying');
const UNITS = [{ value: 'MT', label: 'tonnes' }, { value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }, { value: 'bu', label: 'bushels' }];

// Dry matter stays the same: dry = wet × (100 − wet%) ÷ (100 − target%).
export const driedWeight = (wet, fromPct, toPct) => (wet * (100 - fromPct)) / (100 - toPct);

export function renderDrying(root) {
  const s = { com: 'canola', w: '', unit: 'MT', from: '', to: '10', loss: '', ...store.load() };
  const com = select(COMMODITIES.map((c) => ({ value: c.id, label: c.name })), s.com);
  const w = numberInput({ value: s.w, placeholder: 'Wet weight' });
  const unit = select(UNITS, s.unit);
  const from = numberInput({ value: s.from, placeholder: '14' });
  const to = numberInput({ value: s.to, placeholder: '10' });
  const loss = numberInput({ value: s.loss, placeholder: '0' });
  const out = resultBox();

  function calc() {
    Object.assign(s, { com: com.value, w: w.value, unit: unit.value, from: from.value, to: to.value, loss: loss.value });
    store.save(s);
    const wet = parseNum(w.value), f = parseNum(from.value), t = parseNum(to.value);
    if (wet == null || f == null || t == null) { out.replaceChildren(hint('Enter the wet weight, its moisture and the target moisture.')); return; }
    if (f < 0 || t < 0 || f >= 100 || t >= 100) { out.replaceChildren(hint('Moisture must be between 0 and 100%.')); return; }
    if (t > f) { out.replaceChildren(hint('Target moisture is higher than the starting moisture, so there is nothing to dry.')); return; }

    const id = com.value;
    const wetMt = U.toMt(wet, unit.value, id);
    const dryMt = driedWeight(wetMt, f, t) * (1 - (parseNum(loss.value) ?? 0) / 100);
    const waterKg = (wetMt - driedWeight(wetMt, f, t)) * 1000;
    const shrinkPct = ((wetMt - dryMt) / wetMt) * 100;
    const inUnit = (mt) => (unit.value === 'MT' ? mt : unit.value === 'bu' ? U.mtToBu(mt, id) : unit.value === 'kg' ? mt * 1000 : (mt * 1000) / U.KG_PER_LB);
    const label = UNITS.find((u) => u.value === unit.value).label;

    out.replaceChildren(
      line(`Dry weight (${label})`, num(inUnit(dryMt), unit.value === 'MT' ? 3 : 0)),
      line('Dry tonnes', num(dryMt, 3)),
      line('Dry bushels', num(U.mtToBu(dryMt, id), 1)),
      line('Water removed', `${num(waterKg, 0)} kg (${num(waterKg / U.KG_PER_LB, 0)} lb)`),
      line('Shrink', `${num(shrinkPct, 2)}% · ${num(f - t, 1)} points`),
      line('Shrink per point', `${num(f > t ? shrinkPct / (f - t) : 0, 2)}%`));
  }

  [com, unit].forEach((el) => el.addEventListener('change', calc));
  [w, from, to, loss].forEach((el) => el.addEventListener('input', calc));
  calc();

  root.append(
    card(null, 'Weight after taking grain down to a target moisture.',
      field('Commodity', com, 'Used for bushel conversions.'),
      h('div', { class: 'grid2' }, field('Wet weight', w), field('Unit', unit)),
      h('div', { class: 'grid2' }, field('Moisture %', from), field('Target %', to)),
      field('Handling loss %', loss, 'Optional extra loss from dust and fines in the dryer.'),
      out),
    h('p', { class: 'small muted' }, 'Dry weight = wet weight × (100 − moisture) ÷ (100 − target). Common dry targets: canola 10%, wheat 14.5%, barley 14.8%, oats 13.5%, peas 16%, flax 10%.'),
  );
}
