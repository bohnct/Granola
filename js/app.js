// App startup + tab routing.
import * as data from './data.js';
import { timeAgo, toast } from './ui.js';
import { getTheme, setTheme } from './theme.js';
import bids from './bids.js';
import history from './history.js';
import basis from './basis.js';

const TABS = { bids, history, basis };
const view = document.getElementById('view');
const banner = document.getElementById('banner');
const refreshBtn = document.getElementById('refresh');
let current = null;

// Hash is "#tab" or "#tab/rest" (e.g. "#history/canola/DEC'26").
function route() {
  const hash = location.hash.slice(1);
  const i = hash.indexOf('/');
  const name = i < 0 ? hash : hash.slice(0, i);
  return TABS[name] ? { name, sub: i < 0 ? '' : hash.slice(i + 1) } : { name: 'bids', sub: '' };
}

function render() {
  const { name, sub } = route();
  const tab = TABS[name];
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  document.getElementById('title').textContent = tab.title;
  if (current !== name) window.scrollTo(0, 0);
  current = name;
  view.replaceChildren();
  tab.render(view, sub);
}

function updateBanner() {
  const latest = data.getLatest();
  const msg = !latest ? 'LDC prices not loaded yet. Check your connection.'
    : data.isStale() ? `LDC prices last changed ${timeAgo(latest.updatedAt)}.` : '';
  banner.hidden = !msg;
  banner.textContent = msg;
}

async function refresh() {
  refreshBtn.classList.add('spin');
  try {
    await data.loadLatest();
  } catch { /* banner explains */ } finally {
    refreshBtn.classList.remove('spin');
    updateBanner();
  }
}

const THEMES = { auto: 'Theme: follow phone', light: 'Theme: light', dark: 'Theme: dark' };
function cycleTheme() {
  const order = Object.keys(THEMES);
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  setTheme(next);
  toast(THEMES[next]);
}

function start() {
  data.onData(render);
  window.addEventListener('hashchange', render);
  refreshBtn.addEventListener('click', refresh);
  document.getElementById('theme-btn').addEventListener('click', cycleTheme);
  // Refresh when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  render();
  refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
