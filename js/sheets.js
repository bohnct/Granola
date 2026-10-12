// Google Sheet storage for inventory + sales, via the Apps Script web app in
// google-apps-script/Code.gs. Changes are applied locally first, queued, and
// sent when online, so the app keeps working with poor signal.
import { getItem, setItem, uid } from './db.js';

export const TABLES = ['CropYears', 'Targets', 'Sales'];

let config = null; // {url, token}
let data = { CropYears: [], Targets: [], Sales: [], fetchedAt: null };
let queue = [];
let status = { state: 'idle', error: null };
const listeners = new Set();

export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(data, status));
export const rows = (table) => data[table] ?? [];
export const getStatus = () => ({ ...status, pending: queue.length, fetchedAt: data.fetchedAt, configured: isConfigured() });
export const isConfigured = () => Boolean(config?.url && config?.token);
export const getConfig = () => ({ url: '', token: '', ...config });

export async function init() {
  config = await getItem('sheetConfig', null);
  data = await getItem('sheetCache', data);
  queue = await getItem('sheetQueue', []);
  emit();
  window.addEventListener('online', () => sync());
  if (isConfigured()) sync();
}

export async function saveConfig(url, token) {
  config = { url: url.trim(), token: token.trim() };
  await setItem('sheetConfig', config);
  return sync();
}

async function call(body) {
  const res = await fetch(config.url, {
    method: 'POST',
    // text/plain keeps this a "simple" request, so the browser skips a CORS preflight
    // that Apps Script can't answer.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: config.token }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Google Sheet: HTTP ${res.status}`);
  const out = await res.json();
  if (!out.ok) throw new Error(`Google Sheet: ${out.error}`);
  return out;
}

const persist = () => Promise.all([setItem('sheetCache', data), setItem('sheetQueue', queue)]);

let syncing = null;
export function sync() {
  if (!isConfigured()) return Promise.resolve(false);
  syncing ??= (async () => {
    status = { state: 'syncing', error: null }; emit();
    try {
      while (queue.length) {
        await call(queue[0]);
        queue.shift();
        await setItem('sheetQueue', queue);
      }
      const out = await call({ action: 'list' });
      data = { fetchedAt: new Date().toISOString() };
      for (const t of TABLES) data[t] = (out[t] ?? []).map(normalize);
      // Changes made while this sync was running are still queued; keep them visible.
      for (const op of queue) applyLocal(op);
      await persist();
      status = { state: 'ok', error: null };
      if (queue.length) setTimeout(sync, 0);
      return true;
    } catch (err) {
      status = { state: navigator.onLine ? 'error' : 'offline', error: err.message };
      return false;
    } finally {
      syncing = null;
      emit();
    }
  })();
  return syncing;
}

// Sheets hands back numbers/booleans as typed values but blanks as ''.
function normalize(r) {
  const o = {};
  for (const [k, v] of Object.entries(r)) o[k] = v === '' ? null : v;
  if (typeof o.delivered === 'string') o.delivered = o.delivered.toUpperCase() === 'TRUE';
  return o;
}

function applyLocal(op) {
  if (op.action === 'delete') {
    data[op.table] = data[op.table].filter((x) => x.id !== op.id);
  } else {
    const list = data[op.table];
    const i = list.findIndex((x) => x.id === op.row.id);
    if (i >= 0) list[i] = op.row; else list.push(op.row);
  }
}

async function enqueue(op) {
  applyLocal(op);
  queue.push(op);
  await persist(); emit();
  sync();
}

export async function upsert(table, row) {
  const r = { ...row, id: row.id || uid() };
  await enqueue({ action: 'upsert', table, row: r });
  return r;
}

export const remove = (table, id) => enqueue({ action: 'delete', table, id });
