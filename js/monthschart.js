// "All delivery months" chart: every delivery period LDC has ever posted on one time axis,
// with chips to switch each month on or off. A month's line starts the day LDC first posts
// it and stops when LDC drops it, so months coming and going need no special handling.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { h, segmented, toast } from './ui.js';
import { timeChart } from './chart.js';
import { RANGES, rangeStart } from './ranges.js';

const COLORS = 8; // --c1..--c8 in app.css; more than this at once can't be told apart
const LAYERS = [
  { value: 'basis', label: 'Basis', field: 'basis', step: true, zero: true },
  { value: 'price', label: 'Cash price', field: 'price' },
  { value: 'fut', label: 'Futures', field: 'fut' },
];

// Picked months keep their colour slot while picked: [{label, slot}].
const pickedKey = (com) => `picked-${com}`;
function getPicked(com, list) {
  const saved = prefs.get(pickedKey(com));
  if (Array.isArray(saved)) return saved;
  // First visit: the first few months LDC is posting now.
  return list.filter((x) => x.bid).slice(0, 4).map((x, i) => ({ label: x.label, slot: i + 1 }));
}

export function monthsChart(com, hist) {
  const list = data.deliveries(com, hist);
  const card = h('div', { class: 'card' });
  if (!list.length) return card;

  const draw = () => {
    const div = prefs.unitDiv(com);
    const layer = LAYERS.find((l) => l.value === prefs.get('layer')) ?? LAYERS[0];
    const from = rangeStart(prefs.get('range'));
    const picked = getPicked(com, list).filter((p) => list.some((x) => x.label === p.label));
    const slotOf = new Map(picked.map((p) => [p.label, p.slot]));
    const save = (next) => { prefs.set(pickedKey(com), next); draw(); };

    const toggle = (label) => {
      if (slotOf.has(label)) return save(picked.filter((p) => p.label !== label));
      const used = new Set(picked.map((p) => p.slot));
      const slot = Array.from({ length: COLORS }, (_, i) => i + 1).find((n) => !used.has(n));
      if (!slot) return toast(`Up to ${COLORS} months at a time. Turn one off first.`);
      return save([...picked, { label, slot }]);
    };
    const pickSet = (labels) => save(labels.slice(0, COLORS).map((label, i) => ({ label, slot: i + 1 })));

    const inRange = (x) => x.rows.some((r) => r.d >= from);
    const showOthers = prefs.get('others') !== false;
    const series = list.filter(inRange).map((x) => ({
      name: x.label,
      step: layer.step,
      muted: !slotOf.has(x.label),
      color: slotOf.has(x.label) ? `var(--c${slotOf.get(x.label)})` : null,
      points: x.rows.filter((r) => r.d >= from).map((r) => ({ d: r.d, v: r[layer.field] / div })),
    })).filter((sr) => !sr.muted || showOthers);

    const chip = (x) => {
      const on = slotOf.has(x.label);
      return h('button', {
        type: 'button', class: `chip${on ? ' on' : ''}${x.bid ? '' : ' ended'}`, 'aria-pressed': String(on),
        title: x.bid ? 'Posted now' : 'No longer posted', onclick: () => toggle(x.label),
      }, h('i', { style: on ? `background:var(--c${slotOf.get(x.label)})` : null }), x.label);
    };
    const live = list.filter((x) => x.bid), old = list.filter((x) => !x.bid && inRange(x));

    card.replaceChildren(
      h('h3', {}, `All delivery months · ${layer.label} (${prefs.unitLabel()})`),
      segmented(LAYERS, layer.value, (v) => { prefs.set('layer', v); draw(); }),
      segmented(RANGES, prefs.get('range'), (v) => { prefs.set('range', v); draw(); }),
      h('div', { class: 'chip-tools' },
        h('button', { type: 'button', class: 'linkbtn', onclick: () => pickSet(live.map((x) => x.label)) }, 'Posted now'),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => save([]) }, 'Clear'),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: showOthers, onchange: (e) => { prefs.set('others', e.target.checked); draw(); } }),
          'Show others in grey')),
      h('div', { class: 'chips' }, live.map(chip)),
      old.length ? h('div', {}, h('span', { class: 'small muted' }, 'No longer posted'), h('div', { class: 'chips' }, old.map(chip))) : '',
      timeChart(series, { zero: layer.zero, height: 260, endLabels: true, empty: 'The chart needs two saved days in this range.' }),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' },
        'Each line is one delivery month. It starts when LDC first posts that month and ends when LDC stops posting it. ',
        `Pick up to ${COLORS} to colour; drag across the chart to read values.`));
  };
  draw();
  return card;
}
