// Field work: work rate, time and custom cost for a job.
import { h, num, money, parseNum, field, numberInput, segmented } from '../ui.js';
import { RATE_GROUPS, rateById, GUIDE } from './rates.js';
import { card, resultBox, line, hint, remember, fmtIn } from './common.js';

const store = remember('calc-field');
const KMH_PER_MPH = 1.609344;

// Acres per hour = mph × width (ft) × efficiency ÷ 8.25
export const acresPerHour = (mph, widthFt, effPct) => (mph * widthFt * (effPct / 100)) / 8.25;

function hoursText(hrs) {
  const total = Math.round(hrs * 60);
  const hh = Math.floor(total / 60), mm = total % 60;
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}

export function renderField(root) {
  const s = { op: '', speed: '', speedUnit: 'mph', width: '', acres: '', eff: String(GUIDE.fieldEfficiency), perAc: '', perHr: '', ...store.load() };

  const op = h('select', {},
    h('option', { value: '', selected: !s.op }, 'Choose an operation…'),
    RATE_GROUPS.map((g) => h('optgroup', { label: g.group },
      g.items.map((r) => h('option', { value: r.id, selected: r.id === s.op }, `${r.name}, ${r.size}`)))));
  const speed = numberInput({ value: s.speed, placeholder: '5' });
  const width = numberInput({ value: s.width, placeholder: '60' });
  const acres = numberInput({ value: s.acres, placeholder: '160' });
  const eff = numberInput({ value: s.eff, placeholder: '80' });
  const perAc = numberInput({ value: s.perAc, placeholder: '$/acre' });
  const perHr = numberInput({ value: s.perHr, placeholder: '$/hour' });
  const guideNote = h('small', {});
  const speedLabel = h('span', {}, `Speed (${s.speedUnit})`);
  const out = resultBox();

  const unitSeg = segmented([{ value: 'mph', label: 'mph' }, { value: 'km/h', label: 'km/h' }], s.speedUnit, (u) => {
    const v = parseNum(speed.value);
    if (v != null) speed.value = fmtIn(u === 'km/h' ? v * KMH_PER_MPH : v / KMH_PER_MPH, 1);
    s.speedUnit = u; speedLabel.textContent = `Speed (${u})`;
    calc();
  });

  function showGuide() {
    const r = rateById(op.value);
    guideNote.textContent = r
      ? `Guide: ${r.size}, ${r.perAc != null ? `${money(r.perAc)}/ac, ` : ''}${money(r.perHr)}/hr${r.acPerHr ? `, ${r.acPerHr} ac/hr` : ''}. Edit the rates below if you agreed on something else.`
      : `Pick an operation to fill in the ${GUIDE.name} rates, or type your own.`;
  }

  function calc() {
    Object.assign(s, { op: op.value, speed: speed.value, width: width.value, acres: acres.value, eff: eff.value, perAc: perAc.value, perHr: perHr.value });
    store.save(s);
    const r = rateById(op.value);
    const sp = parseNum(speed.value), w = parseNum(width.value), a = parseNum(acres.value);
    const e = parseNum(eff.value) ?? GUIDE.fieldEfficiency;
    const rAc = parseNum(perAc.value), rHr = parseNum(perHr.value);
    const mph = sp == null ? null : s.speedUnit === 'km/h' ? sp / KMH_PER_MPH : sp;
    const acHr = mph && w ? acresPerHour(mph, w, e) : null;
    const hrs = acHr && a ? a / acHr : null;

    const rows = [];
    if (acHr) rows.push(line('Your work rate', `${num(acHr, 1)} ac/hr`));
    if (acHr && r?.acPerHr) rows.push(line('Guide work rate', `${num(r.acPerHr, 0)} ac/hr`));
    if (hrs != null) rows.push(line('Time to cover', `${hoursText(hrs)} (${num(hrs, 1)} h)`));
    if (a != null && rAc != null) rows.push(line(`Cost at ${money(rAc)}/ac`, money(a * rAc)));
    if (hrs != null && rHr != null) rows.push(line(`Cost at ${money(rHr)}/hr`, money(hrs * rHr)));
    if (acHr && rHr != null) rows.push(line('Hourly rate works out to', `${money(rHr / acHr)}/ac`));
    out.replaceChildren(...(rows.length ? rows : [hint('Enter speed, width and acres. Pick an operation to fill in the custom rate.')]));
  }

  op.addEventListener('change', () => {
    const r = rateById(op.value);
    if (r) {
      perAc.value = r.perAc != null ? r.perAc.toFixed(2) : '';
      perHr.value = r.perHr.toFixed(2);
    }
    showGuide(); calc();
  });
  [speed, width, acres, eff, perAc, perHr].forEach((el) => el.addEventListener('input', calc));
  showGuide(); calc();

  root.append(
    card('Job', null,
      h('label', { class: 'field' }, h('span', {}, 'Field work'), op, guideNote),
      h('div', { class: 'field' }, speedLabel, h('div', { class: 'grid2' }, speed, unitSeg)),
      h('div', { class: 'grid2' }, field('Width (ft)', width), field('Acres', acres)),
      field('Field efficiency %', eff, 'Time lost to turns, overlap and filling. The guide uses 80%.')),
    card('Custom rate', null,
      h('div', { class: 'grid2' }, field('$ per acre', perAc), field('$ per hour', perHr)),
      out),
    h('p', { class: 'small muted' }, `Rates from the ${GUIDE.name} (Saskatchewan Agriculture). They include tractor or power unit, fuel, labour and a 15% margin, and are a farmer-to-farmer guideline, not commercial pricing.`),
  );
}
