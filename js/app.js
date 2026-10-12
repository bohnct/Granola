// App startup + tab routing.
import * as data from './data.js';
import * as sheets from './sheets.js';
import { persist, getItem } from './db.js';
import { setOverrides } from './units.js';
import { timeAgo } from './ui.js';
import { openSettings } from './settings.js';
import offers from './offers.js';
import futures from './futures.js';
import inventory from './inventory.js';
import sales from './sales.js';
import calc from './calc.js';

const TABS = { offers, futures, inventory, sales, calc };
const view = document.getElementById('view');
const banner = document.getElementById('banner');
const refreshBtn = document.getElementById('refresh');
let current = null;

function tabFromHash() {
  const t = location.hash.slice(1);
  return TABS[t] ? t : 'offers';
}

function render() {
  const name = tabFromHash();
  const tab = TABS[name];
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  document.getElementById('title').textContent = tab.title;
  if (current !== name) window.scrollTo(0, 0);
  current = name;
  view.replaceChildren();
  tab.render(view);
}

// Re-render live tabs when new data arrives; calculators keep their inputs.
function rerender(kind) {
  const tab = TABS[current];
  if (tab?.liveOn?.includes(kind)) render();
  updateBanner();
}

function updateBanner() {
  const msgs = [];
  const latest = data.getLatest();
  if (!latest) msgs.push('LDC prices not loaded yet. Check your connection.');
  else if (data.isStale()) msgs.push(`LDC prices last changed ${timeAgo(latest.updatedAt)}.`);
  const s = sheets.getStatus();
  if (s.configured && s.state === 'error') msgs.push(`Google Sheet sync failed: ${s.error}`);
  if (s.pending && !s.configured) msgs.push(`${s.pending} change(s) saved on this phone only. Connect your Google Sheet in Settings ⚙ to upload them.`);
  else if (s.pending && s.state !== 'syncing') msgs.push(`${s.pending} change(s) waiting to upload to Google Sheet.`);
  banner.hidden = !msgs.length;
  banner.textContent = msgs.join(' ');
}

async function refreshAll() {
  refreshBtn.classList.add('spin');
  try {
    await Promise.allSettled([data.loadLatest(), sheets.sync()]);
  } finally {
    refreshBtn.classList.remove('spin');
    updateBanner();
  }
}

async function start() {
  setOverrides(await getItem('buPerMt', {}));
  data.onData(() => rerender('prices'));
  sheets.onChange(() => rerender('sheet'));
  window.addEventListener('hashchange', render);
  refreshBtn.addEventListener('click', refreshAll);
  document.getElementById('settings-btn').addEventListener('click', () => openSettings(render));
  // Refresh when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });

  render();
  await sheets.init();
  await refreshAll();
  persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
