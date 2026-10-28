// Choices shared by every tab (crop, $/MT vs $/bu, chart range), remembered on this device.
// The crop and unit switches live in the top bar (app.js); tabs re-render when they change.
import { COMMODITIES } from './config.js';
import { buPerMt } from './data.js';

const KEY = 'prefs';
const prefs = { com: COMMODITIES[0].key, unit: 'MT', range: '3M', layer: 'basis', others: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }

export const get = (k) => prefs[k];
export function set(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* applies until the app closes */ }
}

// Divide a $/MT figure by this to show the chosen unit.
export const unitDiv = (com = prefs.com) => (prefs.unit === 'bu' ? buPerMt(com) : 1);
export const unitLabel = () => (prefs.unit === 'bu' ? '$/bu' : '$/MT');
