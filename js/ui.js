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

export function timeAgo(iso) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

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


export function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// Long record lists show their first n rows; a button under them reveals the rest.
// Put the returned button inside an element with class "clip".
export function showFirst(rows, n = 5) {
  rows.forEach((r, i) => r.classList.toggle('extra', i >= n));
  if (rows.length <= n) return null;
  const label = () => `Show all ${rows.length}`;
  const btn = h('button', { type: 'button', class: 'more' }, label());
  btn.addEventListener('click', () => {
    const box = btn.closest('.clip');
    const open = box.classList.toggle('open');
    btn.textContent = open ? 'Show fewer' : label();
    if (!open) box.scrollIntoView({ block: 'nearest' });
  });
  return btn;
}

// A chart card's title row. Tapping the title opens its settings; `note` is a short summary of
// what's set. onFocus adds a button that opens the chart full screen.
export function chartTitle(text, onOpen, note = null, onFocus = null) {
  return h('div', { class: 'chart-head' },
    h('button', { type: 'button', class: 'chart-title', onclick: onOpen, 'aria-haspopup': 'dialog' },
      h('span', {}, text, note ? h('small', {}, note) : null),
      h('i', { class: 'gear', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>' })),
    onFocus ? h('button', { type: 'button', class: 'gear focus-btn', onclick: onFocus, 'aria-label': `${text} full screen`,
      html: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>' }) : null);
}

// Bottom sheet of chart settings. fields() lists the rows and is called again after every
// change, so options can depend on each other. Each change applies to the chart right away.
//   {type: 'seg', label, options, value, set}  {type: 'check', label, value, set}  {type: 'action', label, run}
export function openSettings(title, fields) {
  const body = h('div', { class: 'sheet-body' });
  const row = (f) => {
    if (f.type === 'seg') {
      return h('div', { class: 'sheet-row' }, h('span', {}, f.label), segmented(f.options, f.value, (v) => { f.set(v); draw(); }));
    }
    if (f.type === 'check') {
      return h('label', { class: 'sheet-row sheet-check' }, h('span', {}, f.label),
        h('input', { type: 'checkbox', checked: !!f.value, onchange: (e) => { f.set(e.target.checked); draw(); } }));
    }
    return h('button', { type: 'button', class: 'linkbtn sheet-action', onclick: () => { f.run(); draw(); } }, f.label);
  };
  const draw = () => body.replaceChildren(...fields().filter(Boolean).map(row));
  const dlg = h('dialog', { class: 'sheet', 'aria-label': `${title} settings` },
    h('div', { class: 'sheet-inner' },
      h('div', { class: 'sheet-head' }, h('b', {}, title),
        h('button', { type: 'button', class: 'linkbtn', onclick: () => dlg.close() }, 'Done')),
      body));
  // A tap outside the sheet (on the dimmed page) closes it.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove());
  draw();
  document.body.append(dlg);
  dlg.showModal();
}
