// Loads price data written by the GitHub Action (scripts/fetch_ldc.py).
import { DEFAULT_FACILITY } from './config.js';

let latest = null;
const historyCache = new Map();
const listeners = new Set();

export const onData = (fn) => listeners.add(fn);
export const getLatest = () => latest;

export async function loadLatest() {
  const res = await fetch(`data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`latest.json: HTTP ${res.status}`);
  latest = await res.json();
  historyCache.clear();
  listeners.forEach((fn) => fn(latest));
  return latest;
}

export function facility(key = DEFAULT_FACILITY) {
  return latest?.facilities?.[key] ?? null;
}

export const cashBids = (commodityKey, fac) => facility(fac)?.cashBids?.[commodityKey] ?? [];
export const futures = (commodityKey, fac) => facility(fac)?.futures?.[commodityKey] ?? [];

// kind: 'futures' | 'cashbids'
export async function history(kind, commodityKey, fac = DEFAULT_FACILITY) {
  const name = `${kind}-${fac}-${commodityKey}`;
  if (!historyCache.has(name)) {
    historyCache.set(name, fetch(`data/history/${name}.json?t=${latest?.updatedAt ?? ''}`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  }
  return historyCache.get(name);
}

// True when prices are older than the last trading session should allow.
export function isStale() {
  if (!latest?.updatedAt) return true;
  const age = (Date.now() - new Date(latest.updatedAt).getTime()) / 3600000;
  const day = new Date().getDay();
  const allowance = day === 1 ? 72 : day === 0 ? 48 : 26; // weekends
  return age > allowance;
}
