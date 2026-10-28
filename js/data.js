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

function file(name, fallback) {
  if (!fileCache.has(name)) {
    fileCache.set(name, fetch(`data/history/${name}.json?t=${latest?.updatedAt ?? ''}`)
      .then((r) => (r.ok ? r.json() : fallback))
      .catch(() => fallback));
  }
  return fileCache.get(name);
}

// {label: [{d, basis, fut, price, sym?}, ...]} one row per day, oldest first.
export const cashHistory = (com) => file(`cashbids-${FACILITY.key}-${com}`, {});
// [{t, label, from, to, fut}] every basis move seen during the day, oldest first.
export const basisChanges = (com) => file(`basischanges-${FACILITY.key}-${com}`, []);

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
