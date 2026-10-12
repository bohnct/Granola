// Minimal SVG line chart (no library). points: [{d:'YYYY-MM-DD', v:number}]
import { h, num } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' });

export function lineChart(points, { digits = 2, empty = 'No history yet.' } = {}) {
  const pts = points.filter((p) => p.v != null && Number.isFinite(p.v));
  if (pts.length < 2) {
    const one = pts[0];
    return h('p', { class: 'small muted' }, empty, one ? ` First point: ${num(one.v, digits)} on ${shortDate(one.d)}.` : '');
  }

  const W = 340, H = 200, L = 46, R = 10, T = 12, B = 22;
  let min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const x = (i) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);

  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Price history chart' });
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4;
    svg.append(s('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }),
      s('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end' }, num(v, digits > 1 && max - min > 20 ? 0 : digits)));
  }
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  svg.append(
    s('path', { class: 'area', d: `${path}L${x(pts.length - 1)},${H - B}L${L},${H - B}Z` }),
    s('path', { class: 'line', d: path }),
    s('text', { x: L, y: H - 6 }, shortDate(pts[0].d)),
    s('text', { x: W - R, y: H - 6, 'text-anchor': 'end' }, shortDate(pts.at(-1).d)));

  const dot = s('circle', { class: 'dot', r: 4, cx: x(pts.length - 1), cy: y(pts.at(-1).v) });
  svg.append(dot);
  const readout = h('div', { class: 'small muted right' });
  const show = (i) => {
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(pts[i].v));
    readout.textContent = `${shortDate(pts[i].d)}: ${num(pts[i].v, digits)}`;
  };
  const onMove = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    show(Math.max(0, Math.min(pts.length - 1, Math.round(((px - L) / (W - L - R)) * (pts.length - 1)))));
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  show(pts.length - 1);
  return h('div', {}, svg, readout);
}
