// Settings sheet: Google Sheet connection + bushel weights.
import * as sheets from './sheets.js';
import { getItem, setItem } from './db.js';
import { COMMODITIES } from './config.js';
import { setOverrides, defaultBuPerMt } from './units.js';
import { h, field, numberInput, openSheet, toast, parseNum, timeAgo } from './ui.js';

export async function openSettings(onSaved) {
  const cfg = sheets.getConfig();
  const url = h('input', { type: 'url', value: cfg.url, placeholder: 'https://script.google.com/macros/s/…/exec', autocapitalize: 'off', spellcheck: false });
  const token = h('input', { type: 'password', value: cfg.token, autocomplete: 'off', autocapitalize: 'off' });
  const status = h('p', { class: 'small muted' }, statusText());

  function statusText() {
    const s = sheets.getStatus();
    if (!s.configured) return 'Not connected. Data entered is kept on this phone until you connect.';
    if (s.state === 'error') return `Error: ${s.error}`;
    return `Connected. Last synced ${timeAgo(s.fetchedAt)}${s.pending ? `, ${s.pending} change(s) pending` : ''}.`;
  }

  const save = async () => {
    status.textContent = 'Connecting…';
    const ok = await sheets.saveConfig(url.value, token.value);
    status.textContent = statusText();
    toast(ok ? 'Google Sheet connected' : 'Could not connect');
  };

  const overrides = await getItem('buPerMt', {});
  const weightInputs = COMMODITIES.map((c) => {
    const input = numberInput({ value: String(overrides[c.id] ?? c.buPerMt) });
    return { c, input };
  });
  const saveWeights = async () => {
    const map = {};
    for (const { c, input } of weightInputs) {
      const v = parseNum(input.value);
      if (v && v !== defaultBuPerMt(c.id)) map[c.id] = v;
    }
    await setItem('buPerMt', map);
    setOverrides(map);
    toast('Bushel weights saved');
    onSaved?.();
  };
  const resetWeights = () => weightInputs.forEach(({ c, input }) => { input.value = String(c.buPerMt); });

  openSheet('Settings',
    h('div', { class: 'card' },
      h('h3', {}, 'Google Sheet (inventory & sales)'),
      h('p', { class: 'small muted' }, 'Paste the Apps Script web app URL and the TOKEN you set in its Script properties. See README for setup.'),
      field('Web app URL', url),
      field('Token', token),
      status,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: save }, 'Save & connect'),
        h('button', { type: 'button', class: 'btn', onclick: async () => { await sheets.sync(); status.textContent = statusText(); } }, 'Sync now'))),
    h('div', { class: 'card' },
      h('h3', {}, 'Bushels per tonne'),
      h('p', { class: 'small muted' }, 'Used by every conversion in the app. Standard Canadian weights by default.'),
      h('div', { class: 'grid2' }, weightInputs.map(({ c, input }) => field(c.name, input))),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: saveWeights }, 'Save'),
        h('button', { type: 'button', class: 'btn', onclick: resetWeights }, 'Defaults'))),
    h('p', { class: 'small muted' }, 'Prices: LDC public web data, delayed at least 10 min. Not trading advice.'),
  );
}
