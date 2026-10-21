// Small building blocks shared by the calculator pages.
import { h, numberInput, parseNum, field } from '../ui.js';

export const fmtIn = (v, d = 3) => (v == null || !Number.isFinite(v) ? '' : String(+v.toFixed(d)));

export function card(title, sub, ...body) {
  return h('div', { class: 'card' }, title ? h('h3', {}, title) : null,
    sub ? h('p', { class: 'small muted', style: title ? 'margin-top:-4px' : 'margin-top:0' }, sub) : null, ...body);
}

export const resultBox = () => h('div', { class: 'result' });
export const line = (label, value) => h('div', { class: 'line' }, h('span', { class: 'muted' }, label), h('b', {}, value));
export const hint = (text) => h('span', { class: 'muted small' }, text);

// Two inputs that convert into each other. state[aKey]/state[bKey] keep the text.
export function pair(state, aKey, bKey, aLabel, bLabel, aToB, bToA, digits) {
  const a = numberInput({ value: state[aKey], placeholder: '0' });
  const b = numberInput({ value: state[bKey], placeholder: '0' });
  a.addEventListener('input', () => { state[aKey] = a.value; const v = parseNum(a.value); state[bKey] = b.value = v == null ? '' : fmtIn(aToB(v), digits); });
  b.addEventListener('input', () => { state[bKey] = b.value; const v = parseNum(b.value); state[aKey] = a.value = v == null ? '' : fmtIn(bToA(v), digits); });
  return h('div', { class: 'grid2' }, field(aLabel, a), field(bLabel, b));
}

// Per-device memory for a calculator's inputs.
export function remember(key) {
  return {
    load() { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } },
    save(v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
}

export const backLink = () => h('a', { class: 'back', href: '#calc' }, '‹ Calculators');
