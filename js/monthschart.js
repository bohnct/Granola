// "All delivery months" chart: every delivery period LDC has ever posted on one time axis.
// A month's line starts the day LDC first posts it and stops when LDC drops it, so months
// coming and going need no special handling. Up to 8 picked months are coloured; the rest
// can show as grey context. The picker groups old months by delivery year so it stays
// short after a year or more of history.
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
let pickerOpen = false; // kept across redraws while the app is open

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

    const chip = (x, { remove = false } = {}) => {
      const on = slotOf.has(x.label);
      return h('button', {
        type: 'button', class: `chip${on ? ' on' : ''}${x.bid ? '' : ' ended'}`, 'aria-pressed': String(on),
        title: x.bid ? 'Posted now' : 'No longer posted', onclick: () => toggle(x.label),
      }, h('i', { style: on ? `background:var(--c${slotOf.get(x.label)})` : null }), x.label, remove ? h('span', { class: 'x', 'aria-hidden': 'true' }, '×') : null);
    };

    // The legend: only what's picked, in delivery order.
    const shown = list.filter((x) => slotOf.has(x.label));
    const live = list.filter((x) => x.bid);
    // Months no longer posted, newest delivery year first.
    const byYear = new Map();
    list.filter((x) => !x.bid).reverse().forEach((x) => {
      const yr = x.month.slice(0, 4) || 'Other';
      byYear.set(yr, [...(byYear.get(yr) ?? []), x]);
    });

    const picker = h('details', { class: 'picker', open: pickerOpen, ontoggle: (e) => { pickerOpen = e.target.open; } },
      h('summary', {}, `Pick months · ${list.length} saved`),
      h('div', { class: 'group' }, h('span', { class: 'small muted' }, `Posted now (${live.length})`), h('div', { class: 'chips' }, live.map((x) => chip(x)))),
      [...byYear].map(([yr, xs]) => h('div', { class: 'group' },
        h('span', { class: 'small muted' }, `${yr} deliveries · no longer posted (${xs.length})`),
        h('div', { class: 'chips' }, xs.map((x) => chip(x))))));

    card.replaceChildren(
      h('h3', {}, `All delivery months · ${layer.label} (${prefs.unitLabel()})`),
      segmented(LAYERS, layer.value, (v) => { prefs.set('layer', v); draw(); }),
      segmented(RANGES, prefs.get('range'), (v) => { prefs.set('range', v); draw(); }),
      h('div', { class: 'chips showing' },
        shown.length ? shown.map((x) => chip(x, { remove: true })) : h('span', { class: 'small muted' }, 'No months picked. Use "Pick months" below.')),
      timeChart(series, { zero: layer.zero, height: 260, endLabels: true, empty: 'The chart needs two saved days in this range.' }),
      h('div', { class: 'chip-tools' },
        h('button', { type: 'button', class: 'linkbtn', onclick: () => pickSet(live.slice(0, 3).map((x) => x.label)) }, 'Next 3'),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => pickSet(live.map((x) => x.label)) }, `All posted${live.length > COLORS ? ` (first ${COLORS})` : ''}`),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => save([]) }, 'Clear'),
        h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: showOthers, onchange: (e) => { prefs.set('others', e.target.checked); draw(); } }),
          'Others in grey')),
      picker,
      h('p', { class: 'small muted', style: 'margin:8px 0 0' },
        'Each line is one delivery month, from the day LDC first posts it until LDC stops posting it. ',
        `Up to ${COLORS} can be coloured at once. Tap a coloured month to remove it. Drag across the chart to read values.`));
  };
  draw();
  return card;
}
