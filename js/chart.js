// Minimal SVG time chart (no library). One y-axis; every series shares it.
// series: [{name, points: [{d:'YYYY-MM-DD', v:number}], cls?, color?, step?, muted?}]
//   cls:   's1' | 's2' fixed styles (cash / futures);  color: a CSS color for picked series
//   muted: grey context line, left out of the legend and the readout
import { h, num } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

const ms = (d) => new Date(`${d}T12:00:00`).getTime();
export const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' });

// "Nice" tick step for a value range.
function step(range, target = 4) {
  const raw = range / target, mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
}

// Draw at the card's real width so text stays a readable size on any screen.
const chartWidth = () => Math.max(300, Math.min(690, (document.getElementById('view')?.clientWidth ?? 370) - 62));

export function timeChart(series, { digits = 2, zero = false, empty = 'Not enough history yet.', height = 200, endLabels = false } = {}) {
  series = series.map((sr) => ({ ...sr, points: sr.points.filter((p) => p.v != null && Number.isFinite(p.v)) }))
    .filter((sr) => sr.points.length);
  const all = series.flatMap((sr) => sr.points);
  const dates = [...new Set(all.map((p) => p.d))].sort();
  if (dates.length < 2) {
    const one = all[0];
    return h('p', { class: 'small muted' }, empty, one ? ` First reading: ${num(one.v, digits)} on ${shortDate(one.d)}.` : '');
  }

  const main = series.filter((sr) => !sr.muted);
  const labelled = endLabels && main.length <= 4;
  const W = chartWidth(), H = height, L = 44, R = labelled ? 62 : 10, T = 10, B = 22;
  let min = Math.min(...all.map((p) => p.v)), max = Math.max(...all.map((p) => p.v));
  if (zero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { min -= 1; max += 1; }
  const st = step(max - min);
  min = Math.floor(min / st) * st; max = Math.ceil(max / st) * st;
  const t0 = ms(dates[0]), t1 = ms(dates.at(-1));
  const x = (d) => L + ((ms(d) - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const tickDigits = st < 1 ? digits : 0;

  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': `${main.map((sr) => sr.name).join(', ')} chart` });
  for (let v = min; v <= max + st / 2; v += st) {
    svg.append(s('line', { class: v === 0 && zero ? 'grid zero' : 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      s('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, num(v, tickDigits)));
  }
  svg.append(s('text', { x: L, y: H - 6 }, shortDate(dates[0])),
    s('text', { x: W - R, y: H - 6, 'text-anchor': 'end' }, shortDate(dates.at(-1))));

  const pathOf = (sr) => sr.points.map((pt, i) => {
    if (!i) return `M${x(pt.d).toFixed(1)},${y(pt.v).toFixed(1)}`;
    return sr.step ? `H${x(pt.d).toFixed(1)}V${y(pt.v).toFixed(1)}` : `L${x(pt.d).toFixed(1)},${y(pt.v).toFixed(1)}`;
  }).join('');
  const paint = (sr) => (sr.color ? `stroke:${sr.color}` : null);

  // Grey context first so picked lines sit on top.
  series.filter((sr) => sr.muted).forEach((sr) => svg.append(s('path', { class: 'line muted', d: pathOf(sr) })));
  const cross = s('line', { class: 'cross', y1: T, y2: H - B });
  svg.append(cross);
  const dots = main.map((sr) => {
    svg.append(s('path', { class: `line ${sr.cls ?? ''}`, style: paint(sr), d: pathOf(sr) }));
    const dot = s('circle', { class: `dot ${sr.cls ?? ''}`, r: 4, style: sr.color ? `fill:${sr.color}` : null });
    svg.append(dot);
    return dot;
  });

  // Names at the end of each line, nudged apart so they don't overlap.
  if (labelled) {
    const tags = main.map((sr) => ({ sr, y: y(sr.points.at(-1).v), x: x(sr.points.at(-1).d) })).sort((a, b) => a.y - b.y);
    tags.forEach((t, i) => { if (i && t.y - tags[i - 1].y < 11) t.y = tags[i - 1].y + 11; });
    tags.forEach((t) => svg.append(s('text', { class: 'end-label', x: t.x + 6, y: t.y + 3 }, t.sr.name)));
  }

  const swatch = (sr) => h('i', { class: sr.cls ?? '', style: sr.color ? `border-color:${sr.color}` : null });
  const legend = main.length > 1 && !endLabels
    ? h('div', { class: 'legend' }, main.map((sr) => h('span', {}, swatch(sr), sr.name)))
    : null;
  const readout = h('div', { class: 'readout small' });
  const show = (d) => {
    cross.setAttribute('x1', x(d)); cross.setAttribute('x2', x(d));
    const parts = [h('b', {}, shortDate(d))];
    main.forEach((sr, i) => {
      // Value in effect on d; a series that hasn't started or has ended shows nothing.
      const p = sr.points.filter((pt) => pt.d <= d).at(-1);
      const live = p && d <= sr.points.at(-1).d;
      dots[i].style.display = live ? '' : 'none';
      if (live) { dots[i].setAttribute('cx', x(sr.step ? d : p.d)); dots[i].setAttribute('cy', y(p.v)); }
      if (live || main.length <= 2) {
        parts.push(h('span', {}, main.length > 1 ? swatch(sr) : null, main.length > 1 ? `${sr.name} ` : '', h('b', {}, live ? num(p.v, digits) : '–')));
      }
    });
    readout.replaceChildren(...parts);
  };
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const t = t0 + ((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * (t1 - t0);
    show(dates.reduce((best, d) => (Math.abs(ms(d) - t) < Math.abs(ms(best) - t) ? d : best)));
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointerleave', () => show(dates.at(-1)));
  show(dates.at(-1));
  return h('div', {}, legend, svg, readout);
}
