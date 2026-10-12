// Tiny DOM + formatting helpers shared by every tab.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const nf = (min, max) => new Intl.NumberFormat('en-CA', { minimumFractionDigits: min, maximumFractionDigits: max });
const NF = { 0: nf(0, 0), 1: nf(1, 1), 2: nf(2, 2), 3: nf(3, 3) };

export function num(v, digits = 2) {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return '–';
  return NF[digits]?.format(v) ?? v.toFixed(digits);
}
export const money = (v, digits = 2) => (v == null || !Number.isFinite(v) ? '–' : `${v < 0 ? '-' : ''}$${num(Math.abs(v), digits)}`);
export const signed = (v, digits = 2) => (v == null ? '–' : `${v > 0 ? '+' : ''}${num(v, digits)}`);
export const changeClass = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

export function parseNum(s) {
  if (typeof s === 'number') return s;
  const v = parseFloat(String(s ?? '').replace(/[,$\s]/g, ''));
  return Number.isFinite(v) ? v : null;
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

export const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

// Segmented control: options = [{value,label}]
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'tablist' });
  const render = (val) => {
    wrap.replaceChildren(...options.map((o) => h('button', {
      type: 'button', class: o.value === val ? 'on' : '', 'aria-selected': String(o.value === val),
      onclick: () => { render(o.value); onChange(o.value); },
    }, o.label)));
  };
  render(value);
  return wrap;
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
}

export function numberInput(attrs = {}) {
  return h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', ...attrs });
}

export function select(options, value, attrs = {}) {
  return h('select', attrs, options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
}

// Bottom sheet dialog. Returns {dialog, close}.
export function openSheet(title, ...body) {
  const dialog = h('dialog', { class: 'sheet' },
    h('div', { class: 'sheet-head' }, h('h3', {}, title),
      h('button', { type: 'button', class: 'btn sm', onclick: () => dialog.close() }, 'Close')),
    h('div', { class: 'sheet-body' }, ...body));
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close: () => dialog.close() };
}

export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}
