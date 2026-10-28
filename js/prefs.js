// Choices shared by every tab (commodity, $/MT vs $/bu), remembered on this device.
import { COMMODITIES } from './config.js';
import { segmented } from './ui.js';
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

export const commodityPicker = (onChange) => segmented(
  COMMODITIES.map((c) => ({ value: c.key, label: c.short })), prefs.com, (v) => { set('com', v); onChange(v); });

export const unitPicker = (onChange) => segmented(
  [{ value: 'MT', label: '$ / tonne' }, { value: 'bu', label: '$ / bushel' }], prefs.unit, (v) => { set('unit', v); onChange(v); });
