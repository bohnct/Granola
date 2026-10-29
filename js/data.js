// Loads price data written by the GitHub Action (scripts/fetch_ldc.py).
import { FACILITY, BU_PER_MT } from './config.js';

let latest = null;
const fileCache = new Map();
const listeners = new Set();

export const onData = (fn) => listeners.add(fn);
export const getLatest = () => latest;

export async function loadLatest() {
  const res = await fetch(`data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`latest.json: HTTP ${res.status}`);
  latest = await res.json();
  fileCache.clear();
  listeners.forEach((fn) => fn(latest));
  return latest;
}

const facility = () => latest?.facilities?.[FACILITY.key] ?? null;
export const cashBids = (com) => facility()?.cashBids?.[com] ?? [];
export const buPerMt = (com) => cashBids(com)[0]?.buPerUnit ?? BU_PER_MT;

// Fetch a history file; null when it isn't there.
function file(name) {
  if (!fileCache.has(name)) {
    fileCache.set(name, fetch(`data/history/${name}.json?t=${latest?.updatedAt ?? ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null));
  }
  return fileCache.get(name);
}

// A day as stored: {d, sym, f, b: [o,h,l,c], p: [o,h,l,c]} (basis and cash for the day).
// Screens use the close as basis/price; b and p carry the day's range for the bar charts.
const day = (r) => ({ d: r.d, sym: r.sym ?? null, fut: r.f, basis: r.b?.[3], price: r.p?.[3], b: r.b, p: r.p });
// Files from before Oct 29, 2026 had one reading a day; the Action converts them on its next run.
const oldDay = (r) => ({ ...r, sym: r.sym ?? null, b: [r.basis, r.basis, r.basis, r.basis], p: [r.price, r.price, r.price, r.price] });

const store = async (com) => {
  const cur = await file(`${FACILITY.key}-${com}`);
  if (cur) return cur;
  const [bids, changes] = await Promise.all([file(`cashbids-${FACILITY.key}-${com}`), file(`basischanges-${FACILITY.key}-${com}`)]);
  return { bids: bids ?? {}, changes: changes ?? [], old: true };
};

// {label: [{d, basis, fut, price, sym, b, p}, ...]} one row per day, oldest first.
export const cashHistory = (com) => store(com).then((s) => Object.fromEntries(
  Object.entries(s.bids ?? {}).map(([label, rows]) => [label, rows.map(s.old ? oldDay : day)])));
// [{t, label, from, to, fut}] every basis move seen during the day, oldest first.
export const basisChanges = (com) => store(com).then((s) => s.changes ?? []);
// {contract: [{d, o, h, l, c}]} exchange daily bars for canola futures (both crops price off them).
export const futuresHistory = async () => (await file(`${FACILITY.key}-futures`))
  ?? (await file(`futures-${FACILITY.key}-canola`)) ?? {};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// LDC labels look like "DEC'26", "JUNE'27", "SEPT 27". Returns "2027-06" or null.
export function labelMonth(label) {
  const m = /^([A-Z]{3})[A-Z]*\W*\s*(\d{2})\b/i.exec(label ?? '');
  const i = m ? MONTHS.indexOf(m[1].toUpperCase()) : -1;
  return i < 0 ? null : `20${m[2]}-${String(i + 1).padStart(2, '0')}`;
}

// Every delivery period ever seen, in delivery order. Ones LDC no longer posts are "expired".
export function deliveries(com, hist) {
  const live = new Map(cashBids(com).map((b) => [b.label, b]));
  const labels = new Set([...live.keys(), ...Object.keys(hist)]);
  return [...labels].map((label) => ({
    label,
    month: labelMonth(label) ?? live.get(label)?.start?.slice(0, 7) ?? '',
    bid: live.get(label) ?? null,
    rows: hist[label] ?? [],
  })).sort((a, b) => a.month.localeCompare(b.month) || a.label.localeCompare(b.label));
}

// Last row on or before date d (YYYY-MM-DD).
export function rowAt(rows, d) {
  let hit = null;
  for (const r of rows) { if (r.d <= d) hit = r; else break; }
  return hit;
}

// The day before the newest row, to show day-over-day change.
export const prevRow = (rows) => rows.at(-2) ?? null;

// Date the basis last changed, from the daily rows.
export function basisSince(rows) {
  for (let i = rows.length - 1; i > 0; i--) if (rows[i].basis !== rows[i - 1].basis) return rows[i].d;
  return rows[0]?.d ?? null;
}

// True when prices are older than the last trading session should allow.
export function isStale() {
  if (!latest?.updatedAt) return true;
  const age = (Date.now() - new Date(latest.updatedAt).getTime()) / 3600000;
  const day = new Date().getDay();
  const allowance = day === 1 ? 72 : day === 0 ? 48 : 26; // weekends
  return age > allowance;
}
