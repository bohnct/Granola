// Calculators tab: a grid of calculators; each opens on its own page (#calc/<id>).
import { h } from './ui.js';
import { backLink } from './calc/common.js';
import { renderField } from './calc/field.js';
import { renderDrying } from './calc/drying.js';
import { renderAcre } from './calc/acre.js';
import { renderConvert } from './calc/convert.js';
import { renderFert } from './calc/fert.js';

// SVG has to go through innerHTML so it gets the SVG namespace.
const icon = (d) => h('i', { class: 'tile-icon', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>` });

// ★ Add a calculator: one entry here plus a render function in js/calc/.
const PAGES = [
  { id: 'field', title: 'Field Work', desc: 'Acres/hr, time and Sask custom rates',
    icon: '<path d="M3 20h18M5 20V9l7-4 7 4v11"/><path d="M9 20v-5h6v5"/>', render: renderField },
  { id: 'drying', title: 'Grain Drying', desc: 'Shrink from moisture % to target',
    icon: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/><path d="M9 15a3 3 0 0 0 3 3"/>', render: renderDrying },
  { id: 'acre', title: 'Acre Profit', desc: 'Revenue, profit and break-even per acre',
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', render: renderAcre },
  { id: 'fert', title: 'Fert Blend', desc: 'N-P-K-S targets to product rates and cost',
    icon: '<path d="M7 3h10l-1 5H8z"/><path d="M8 8c-2 2-3 4-3 7a7 7 0 0 0 14 0c0-3-1-5-3-7"/><path d="M9.5 15h5"/>', render: renderFert },
  { id: 'convert', title: 'Conversions', desc: 'bu↔MT, $/bu↔$/MT, basis, loads, yield',
    icon: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>', render: renderConvert },
];
const page = (sub) => PAGES.find((p) => p.id === sub);

export default {
  title: (sub) => page(sub)?.title ?? 'Calculators',
  liveOn: [],
  render(root, sub) {
    const p = page(sub);
    if (p) {
      root.append(backLink());
      p.render(root);
      return;
    }
    root.append(
      h('div', { class: 'tiles' }, PAGES.map((t) => h('a', { class: 'tile', href: `#calc/${t.id}` },
        icon(t.icon), h('b', {}, t.title), h('span', {}, t.desc)))));
  },
};
