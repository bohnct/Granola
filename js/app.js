// App startup + tab routing.
import * as data from './data.js';
import * as prefs from './prefs.js';
import { COMMODITIES } from './config.js';
import { h, timeAgo, toast } from './ui.js';
import { getTheme, setTheme } from './theme.js';
import bids from './bids.js';
import basis from './basis.js';

const TABS = { bids, basis };
const view = document.getElementById('view');
const banner = document.getElementById('banner');
const refreshBtn = document.getElementById('refresh');
let current = null;

// Hash is "#tab" or "#tab/rest" (e.g. "#basis/canola/DEC'26").
function route() {
  const hash = location.hash.slice(1);
  const i = hash.indexOf('/');
  let name = i < 0 ? hash : hash.slice(0, i);
  if (name === 'history') name = 'basis'; // the old History tab's links (bookmarks, home-screen shortcuts)
  return TABS[name] ? { name, sub: i < 0 ? '' : hash.slice(i + 1) } : { name: 'bids', sub: '' };
}

// keep: redraw in place (unit switch, fresh prices) at the same scroll position, instead of
// starting the page over.
async function render(keep = false) {
  const { name, sub } = route();
  const tab = TABS[name];
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === name));
  document.title = `${tab.title} · LDC Basis Tracker`;
  if (current !== name) window.scrollTo(0, 0);
  current = name;
  const y = window.scrollY;
  // Hold the page's height while the tab reloads its data, so the scroll position survives.
  if (keep) view.style.minHeight = `${view.offsetHeight}px`;
  view.replaceChildren();
  const done = tab.render(view, sub, { keep });
  drawTopbar(); // after render: a #basis/<crop>/<month> link may have switched the crop
  if (keep) {
    await done;
    view.style.minHeight = '';
    window.scrollTo(0, y);
  }
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

// Top-bar crop switch and $/MT ↔ $/bu button. History carries the crop in its URL.
const cropBar = document.getElementById('crop');
const unitBtn = document.getElementById('unit-btn');
function drawTopbar() {
  cropBar.replaceChildren(...COMMODITIES.map((c) => h('button', {
    type: 'button', class: c.key === prefs.get('com') ? 'on' : '', 'aria-selected': String(c.key === prefs.get('com')),
    onclick: () => {
      if (c.key === prefs.get('com')) return;
      prefs.set('com', c.key);
      drawTopbar();
      // A link naming the crop would switch it back, so swap the link instead.
      const { name, sub } = route();
      if (sub) location.hash = `#${name}/${c.key}`;
      else render();
    },
  }, c.short)));
  unitBtn.textContent = prefs.unitLabel();
  unitBtn.setAttribute('aria-label', prefs.get('unit') === 'bu' ? 'Units: dollars per bushel' : 'Units: dollars per tonne');
}
function toggleUnit() {
  prefs.set('unit', prefs.get('unit') === 'bu' ? 'MT' : 'bu');
  drawTopbar();
  render(true);
}

const THEMES ={ auto: 'Theme: follow phone', light: 'Theme: light', dark: 'Theme: dark' };
function cycleTheme() {
  const order = Object.keys(THEMES);
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  setTheme(next);
  toast(THEMES[next]);
}

function start() {
  data.onData(() => render(true));
  window.addEventListener('hashchange', () => render());
  refreshBtn.addEventListener('click', refresh);
  document.getElementById('theme-btn').addEventListener('click', cycleTheme);
  unitBtn.addEventListener('click', toggleUnit);
  // Refresh when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  render();
  refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
