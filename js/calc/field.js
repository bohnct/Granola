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

  // Operation picker: category → machine → size, all tap buttons (no long scrolling list).
  const op = { value: rateById(s.op) ? s.op : '' };
  const pick = { group: RATE_GROUPS.find((g) => g.items.some((r) => r.id === op.value)) ?? RATE_GROUPS[0], name: rateById(op.value)?.name ?? '' };
  const machineChips = h('div', { class: 'chips' });
  const sizeChips = h('div', { class: 'chips' });
  const chip = (label, on, onclick) => h('button', { type: 'button', class: on ? 'chip on' : 'chip', onclick }, label);
  const groupSeg = segmented(RATE_GROUPS.map((g) => ({ value: g.group, label: g.short })), pick.group.group, (v) => {
    pick.group = RATE_GROUPS.find((g) => g.group === v);
    pick.name = '';
    drawPicker();
  });
  groupSeg.classList.add('tight');
  function drawPicker() {
    const names = [...new Set(pick.group.items.map((r) => r.name))];
    machineChips.replaceChildren(...names.map((n) => chip(n, n === pick.name, () => {
      pick.name = n;
      const sizes = pick.group.items.filter((r) => r.name === n);
      if (sizes.length === 1) choose(sizes[0].id); else drawPicker();
    })));
    const sizes = pick.name ? pick.group.items.filter((r) => r.name === pick.name) : [];
    sizeChips.replaceChildren(...sizes.map((r) => chip(r.size, r.id === op.value, () => choose(r.id))));
    sizeChips.hidden = !sizes.length;
  }
  function choose(id) {
    op.value = id;
    const r = rateById(id);
    perAc.value = r.perAc != null ? r.perAc.toFixed(2) : '';
    perHr.value = r.perHr.toFixed(2);
    drawPicker(); showGuide(); calc();
  }
  const speed = numberInput({ value: s.speed, placeholder: '5' });
  const width = numberInput({ value: s.width, placeholder: '60' });
  const acres = numberInput({ value: s.acres, placeholder: '160' });
  const eff = numberInput({ value: s.eff, placeholder: '80' });
  const perAc = numberInput({ value: s.perAc, placeholder: '$/acre' });
  const perHr = numberInput({ value: s.perHr, placeholder: '$/hour' });
  const guideNote = h('span', {});
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
      ? `${r.name}, ${r.size}: ${r.perAc != null ? `${money(r.perAc)}/ac, ` : ''}${money(r.perHr)}/hr${r.acPerHr ? `, ${r.acPerHr} ac/hr` : ''}. Edit the rates below if you agreed on something else.`
      : `Pick a machine and size to fill in the ${GUIDE.name} rates, or type your own below.`;
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

  [speed, width, acres, eff, perAc, perHr].forEach((el) => el.addEventListener('input', calc));
  drawPicker(); showGuide(); calc();

  root.append(
    card('Field work', null, groupSeg, machineChips, sizeChips, h('p', { class: 'small muted', style: 'margin:8px 0 0' }, guideNote)),
    card('Job', null,
      h('div', { class: 'field' }, speedLabel, h('div', { class: 'grid2' }, speed, unitSeg)),
      h('div', { class: 'grid2' }, field('Width (ft)', width), field('Acres', acres)),
      field('Field efficiency %', eff, 'Time lost to turns, overlap and filling. The guide uses 80%.')),
    card('Custom rate', null,
      h('div', { class: 'grid2' }, field('$ per acre', perAc), field('$ per hour', perHr)),
      out),
    h('p', { class: 'small muted' }, `Rates from the ${GUIDE.name} (Saskatchewan Agriculture). Pulled implements include a suitably sized tractor; self-propelled machines include their own engine. Every rate includes fuel, a $28/hr operator and a 15% margin. A farmer-to-farmer guideline, not commercial pricing.`),
  );
}
